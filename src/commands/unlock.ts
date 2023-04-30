import { appData, modifyAppData } from "@/lib/appSettings";
import { CommandFn } from "@/types/bot";

export const unlockCommand: CommandFn = async (
	msg,
	args,
	{ sendTextMessage }
) => {
	const currentId = appData.get("telegram").chatId;

	if (msg.chat.id === currentId) {
		modifyAppData((s) => {
			s.telegram.chatId = undefined;
		});
		await sendTextMessage(
			"Chat unlocked! Careful now anyone can lock it and will have full control over the bot"
		);
	} else {
		await sendTextMessage("You can't unlock the chat you didn't lock!");
	}
};
