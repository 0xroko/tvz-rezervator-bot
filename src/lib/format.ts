import { envConfig } from "@/config/envConfig";
import { Appointment } from "@/types/bot";
import { format } from "date-fns";
import hr from "date-fns/locale/hr";
import { z } from "zod";

export const fmtDate = (date: Date | number) => {
	return format(date, "H:mm d.M.yyyy", { locale: hr });
};

export const fmtZodError = (parsed: z.SafeParseError<any>, join = "\n") => {
	return parsed.error.errors
		.map((e, i) => i + 1 + ". " + e.message + " " + e.path + "")
		.join(join);
};

type PrintKeys = {
	[key in keyof Partial<Appointment>]: string;
};

interface FmtAppointmentOptions {
	valueFormat?: [string, string];
	short?: boolean;
}

export const fmtAppointment = (
	appointment: Appointment,
	options?: FmtAppointmentOptions
) => {
	const valueFormat = options?.valueFormat || ["<b>", "</b>"];

	let str = "";

	let printKeys = {
		id: "ID",
		url: "URL",
		timestamp: "Time",
	} as PrintKeys;

	if (!options?.short) {
		printKeys = {
			...printKeys,
			groupText: "Group Text",
			appointmentText: "Appointment Text",
		} as PrintKeys;
	}

	Object.keys(printKeys).forEach((key) => {
		let value = (appointment as any)[key];
		let printKey = (printKeys as any)[key];
		if (key === "timestamp") value = fmtDate(value);

		str += `${printKey}: ${valueFormat[0]}${value}${valueFormat[1]}\n`;
	});

	return str;
};

export const fmtTelegramLink = () => {
	const id = envConfig.get("TG_SECRET")?.split(":")[0];
	return `https://web.telegram.org/z/#${id}`;
};
