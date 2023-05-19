import { helpText } from "@/config/index";
import { CommandInput, Commands, TelegramHelper } from "@/types/bot";
import TelegramBot from "node-telegram-bot-api";
import { bot } from "../../main";
import { appData } from "./appSettings";
import { logger } from "./log";

const ensureLockedFn = async (
  msg: TelegramBot.Message,
  sendMessage: TelegramHelper["sendTextMessage"]
) => {
  const currentId = appData.get("telegram").chatId;

  if (!currentId) {
    await sendMessage(
      "This action requires locking the bot, please run /lock and try again"
    );

    return false;
  }

  if (currentId !== msg.chat.id) {
    await sendMessage("Sorry this chat is locked by another user!");
    return false;
  }
  return true;
};

export const createTelgramHelper = (
  chatId: string | number | undefined
): TelegramHelper => {
  return {
    sendTextMessage: async (message, options) => {
      if (!chatId) {
        chatId = appData.get("telegram").chatId ?? "";
      }

      return await bot.sendMessage(chatId, message, {
        disable_web_page_preview: true,
        ...options,
      });
    },
    sendMDMessage: async (message, options) => {
      if (!chatId) {
        chatId = appData.get("telegram").chatId ?? "";
      }
      return await bot.sendMessage(chatId, message, {
        disable_web_page_preview: true,
        parse_mode: "Markdown",
        ...options,
      });
    },
    sendHtmlMessage: async (message, options) => {
      if (!chatId) {
        chatId = appData.get("telegram").chatId ?? "";
      }
      return await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...options,
      });
    },
    sendPhoto: async (photo) => {
      if (!chatId) {
        chatId = appData.get("telegram").chatId ?? "";
      }
      return await bot.sendPhoto(chatId, photo, {});
    },
  };
};

// telegram helper for locked chat
export const globalTelegramHelper = createTelgramHelper(undefined);

export async function configureBotCommands({
  bot,
  commands,
  message,
  onReschedule,
  commandInput: res,
}: {
  commandInput: CommandInput;
  commands: Commands;
  message: TelegramBot.Message;
  bot: TelegramBot;
  onReschedule: () => Promise<void>;
}): Promise<void> {
  const command = res._[0];
  const args = Object.keys(res).reduce((acc, key) => {
    if (key === "_") return acc;
    if (key === "$0") return acc;
    return {
      ...acc,
      [key]: res[key],
    };
  }, {});

  const tgHelper = createTelgramHelper(message.chat.id);

  if (command in commands) {
    logger.info(`command '${command}', args: `, args);

    if (commands[command].lockRequired) {
      const isLocked = await ensureLockedFn(message, tgHelper.sendTextMessage);
      if (!isLocked) return;
    }

    try {
      await commands[command].fn(message, args, tgHelper);
    } catch (error: any) {
      logger.error(error, "Error occured while running command: ", command);
      tgHelper.sendHtmlMessage(
        `⛔ Error occured while running <b>${command}</b>\n<code>${error.message}</code>`
      );
    }

    if (commands[command].rescheduleRequired) {
      await onReschedule();
    }
  } else {
    await tgHelper.sendMDMessage(
      `Unkonwn command '''${command}''' \n` + helpText
    );
  }
}
