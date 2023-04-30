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
