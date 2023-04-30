import { appData } from "@/lib/appSettings";
import { fmtAppointment } from "@/lib/format";
import { CommandFn } from "@/types/bot";

export const listCommand: CommandFn = async (
	msg,
	args,
	{ sendHtmlMessage, sendTextMessage }
) => {
	const appointments = appData.get("appointments");
	if (appointments.length === 0) {
		await sendTextMessage(
			"😢 No scheduled appointment reservations found! Add one with /schedule"
		);
	} else {
		let outMsg = "📃 List of all scheduled appointment reservations:\n";
		appointments.forEach((e, i) => {
			outMsg += "---------------------\n";
			outMsg += fmtAppointment(e);
		});
		await sendHtmlMessage(outMsg);
	}
};
