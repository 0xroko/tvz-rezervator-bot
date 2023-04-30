import { appData, modifyAppData } from "@/lib/appSettings";
import { CommandFn } from "@/types/bot";

export const lockCommand: CommandFn = async (
  msg,
  args,
  { sendTextMessage, sendMDMessage }
) => {
  const chatId = msg.chat.id;
  const telegramSettings = appData.get("telegram");
  if (!telegramSettings.chatId) {
    modifyAppData((d) => {
      d.telegram.chatId = chatId;
      d.telegram.lockedBy = msg.from;
    });

    await sendMDMessage(
      `Now locked by *${msg.from?.first_name}* (you), to unlock run /unlock`
    );
  } else {
    if (telegramSettings.chatId === chatId) {
      await sendMDMessage(`Already locked by *you*, to unlock run /unlock`);
    } else {
      await sendTextMessage(
        `Sorry this chat is locked by ${telegramSettings.lockedBy?.first_name}!`
      );
    }
  }
};
