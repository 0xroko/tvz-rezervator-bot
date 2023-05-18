require("dotenv").config();
import { deleteCommand } from "@/commands/delete";
import { listCommand } from "@/commands/list";
import { lockCommand } from "@/commands/lock";
import { scheduleCommand } from "@/commands/schedule";
import { unlockCommand } from "@/commands/unlock";
import { envConfig, validateEnvConfig } from "@/config/envConfig";
import { configureBotCommands } from "@/lib/configureBotCommands";
import { fmtTelegramLink } from "@/lib/format";
import { logger } from "@/lib/log";
import { reservationScheduler } from "@/lib/scheduler";
import { cliParse, ifAliasReplaceWithCmd, yargsBot } from "@/lib/yargs";
import TelegramBot from "node-telegram-bot-api";

export let bot: TelegramBot;

const {
  rescheduleAppointmentReservationJobs,
  scheduleAppointmentReservationJobs,
} = reservationScheduler({});

const botMain = async () => {
  logger.info("Starting bot...");

  bot = new TelegramBot(envConfig.get("TG_SECRET")!, {
    polling: true,
  });

  await scheduleAppointmentReservationJobs();

  logger.info(`Bot started, chat link: ${fmtTelegramLink()}`);

  bot.onText(/\/(.+)/, async (msg, match) => {
    // ignore messages older than 2 seconds
    if (Date.now() - msg.date * 1000 > 1000 * 2) {
      return;
    }

    // TODO migrate from yargs to zod parsing since yargs functionality isn't needed
    const res = ifAliasReplaceWithCmd(yargsBot.parseSync(match?.[1] ?? ""));

    await configureBotCommands({
      commands: {
        lock: {
          fn: lockCommand,
          lockRequired: false,
        },
        unlock: {
          fn: unlockCommand,
          lockRequired: true,
        },
        list: {
          fn: listCommand,
          lockRequired: true,
        },
        schedule: {
          fn: scheduleCommand,
          lockRequired: true,
          rescheduleRequired: true,
        },
        delete: {
          fn: deleteCommand,
          lockRequired: true,
          rescheduleRequired: true,
        },
        // telegram default command
        start: {
          fn: async (msg, args, helpers) => {
            helpers.sendTextMessage(
              "To start using the bot run /lock first! \n\nWhy /lock​ing? Locking 'saves' your chat id, so the bot can message you even when you don't send any commands, also it prevents other users from using the bot."
            );
          },
          lockRequired: false,
        },
        help: {
          fn: async (msg, args, helpers) => {
            // trick to get all help text
            yargsBot.parseSync("");
            const helpText = await yargsBot.getHelp();
            helpers.sendMDMessage("```\n" + helpText + "```");
          },
          lockRequired: false,
        },
      },
      commandInput: res,
      message: msg,
      bot,
      onReschedule: rescheduleAppointmentReservationJobs,
    });
  });
};

import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import iconv from "iconv-lite";

export const defaultHeaders = {
  "Content-Type": "application/x-www-form-urlencoded",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "en-US,en;q=0.9,hr-HR;q=0.8,hr;q=0.7,bs;q=0.6",
  "cache-control": "max-age=0",
  "content-type": "application/x-www-form-urlencoded",
  "sec-ch-ua":
    '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24";"Samo testam bota nije nista maliciozno ionako znate tko sam :D";v="0"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  Referer: "https://moj.tvz.hr/",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const decodeAxiosResponseData = (data: any) => {
  const decoded = iconv.decode(data, "cp1250");
  return decoded;
};

export const jar = new CookieJar();
export const axiosInstance = axios.create({ jar, withCredentials: true });
export const client = wrapper(axiosInstance);

declare module "axios" {
  interface AxiosRequestConfig {
    jar?: CookieJar;
  }
}

const main = async () => {
  // cli parse will parse args and exit if needed
  await cliParse();

  // exit if env vars are not set
  validateEnvConfig();

  try {
    await botMain();
  } catch (err) {
    logger.error(err);
  }
};

main();
