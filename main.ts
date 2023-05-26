require("dotenv").config();
import { deleteCommand } from "@/commands/delete";
import { listCommand } from "@/commands/list";
import { lockCommand } from "@/commands/lock";
import { scheduleCommand } from "@/commands/schedule";
import { unlockCommand } from "@/commands/unlock";
import { envConfig, validateEnvConfig } from "@/config/envConfig";
import { config, helpText } from "@/config/index";
import { configureBotCommands } from "@/lib/configureBotCommands";
import { fmtTelegramLink } from "@/lib/format";
import { fmtLogTimeStamp, logger } from "@/lib/log";
import { reservationScheduler } from "@/lib/scheduler";
import { cliParse, ifAliasReplaceWithCmd, yargsBot } from "@/lib/yargs";
import TelegramBot from "node-telegram-bot-api";
import { exit } from "process";

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

  bot.on("polling_error", (err) => {
    exit(config.RESTART_CODE);
  });

  await scheduleAppointmentReservationJobs();

  logger.info(`Bot started, chat link: ${fmtTelegramLink()}`);

  bot.onText(/\/(.+)/, async (msg, match) => {
    const nowDate = Date.now() / 1000;
    // ignore messages older than 5 seconds
    if (nowDate - msg?.date > 5) {
      logger.debug(
        `Ignoring message '${msg?.text}' from ${
          msg.from?.first_name
        } because it's too old (${fmtLogTimeStamp(msg?.date * 1000)})`
      );
      return;
    }

    // note needs to return a command
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
            helpers.sendMDMessage(
              // prettier-ignore
              "To start using the bot run /lock first! \n\n*Why /lock​ing?*\nLocking 'saves' your chat id, so the bot can message you even when you don't send any commands, also it prevents other users from using the bot. \n\n*Help*\nRun /help command to see all available commands."
            );
          },
          lockRequired: false,
        },
        help: {
          fn: async (msg, args, helpers) => {
            helpers.sendMDMessage(helpText);
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
