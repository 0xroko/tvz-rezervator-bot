import { appData, modifyAppData } from "@/lib/appSettings";
import { fmtAppointment, fmtZodError } from "@/lib/format";
import { logger } from "@/lib/log";
import { Appointment, CommandFn } from "@/types/bot";
import { isAfter, isValid, parse } from "date-fns";
import { hr } from "date-fns/locale";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { config } from "../../config";
import { autoScheduleCommand } from "./auto";

export const nanoid = customAlphabet("1234567890abcdef", 3);

const zodUrl = z
	.string()
	.url("Invalid")
	.startsWith("https://moj.tvz.hr/", "Url must start with https://moj.tvz.hr/");

export const zodDateParse = (date: string, ctx: Zod.RefinementCtx) => {
	try {
		const d = parse(date, "HH:mm-d.M.yyyy", new Date(), {
			locale: hr,
		});

		if (!isValid(d)) throw config.errors.INVALID_DATE;

		// check if date is in the past
		if (!isAfter(d, new Date())) throw config.errors.DATE_IN_PAST_NOT_ALLOWED;
		return d;
	} catch (error) {
		if (error === config.errors.DATE_IN_PAST_NOT_ALLOWED) {
			ctx.addIssue({
				code: "invalid_date",
				message: "Cannot Schedule appointment reservation in the past",
			});
			return z.NEVER;
		}
		ctx.addIssue({
			code: "invalid_date",
			message:
				'Invalid date format, please use following format: "15:01-03.02.2022"',
		});
		return z.NEVER;
	}
};

const scheduleType = z.enum(["manual", "auto"]);

const scheduleInputSchema = z
	.object({
		url: zodUrl,
		groupText: z.string().optional(),
		appointmentText: z.string().optional(),
		timestamp: z.string().optional(),
	})
	.transform((t, ctx) => {
		// check if groupText and appointmentText and timestamp or none of them are provided
		if (t.groupText || t.appointmentText || t.timestamp) {
			if (!(t.groupText && t.appointmentText && t.timestamp)) {
				ctx.addIssue({
					code: "invalid_date",
					message:
						"If you provided groupText or appointmentText or timestamp, you must provide all of them",
				});
				return z.NEVER;
			}
			console.log(t.timestamp);

			const date = zodDateParse(t.timestamp, ctx);
			return {
				url: t.url,
				groupText: t.groupText,
				appointmentText: t.appointmentText,
				timestamp: date,
				type: scheduleType.Values.manual,
			};
		}
		return {
			url: t.url,
			type: scheduleType.Values.auto,
		};
	});

export type ScheduleCommandInput = z.infer<typeof scheduleInputSchema>;

export const scheduleCommand: CommandFn<ScheduleCommandInput> = async (
	msg,
	argss,
	helpers
) => {
	logger.debug(argss);

	const { sendHtmlMessage, sendTextMessage } = helpers;
	const args = scheduleInputSchema.safeParse(argss);

	if (!args.success) {
		await sendTextMessage(`Errors: \n${fmtZodError(args)}`);
		await sendHtmlMessage(
			'Example usage \n<code>/schedule https://moj.tvz.hr/studijrac/predmet/124260</code> or\n<code>/schedule https://moj.tvz.hr/studijrac/predmet/124260 "​2​2./​2​3." "SRIJEDA 10:00" 17:35-7.2.2023</code>'
		);
		return;
	}

	const hasSameUrl = appData
		.get("appointments")
		.filter((s) => s.url.includes(args.data.url));

	if (hasSameUrl.length > 0) {
		await sendHtmlMessage(
			`⚠ You already have appointment reservations for this url (new appointment reservation will be scheduled)! \nAppointment reservations with same url: ${hasSameUrl
				.map((a) => "<b>" + a.id + "</b>")
				.join(", ")}`
		);
	}

	if (args.data.type === "auto") {
		await autoScheduleCommand(msg, args.data, helpers);
		return;
	}

	const id = nanoid();

	const newAppointment: Appointment = {
		id: id,
		staus: "scheduled",
		appointmentText: args.data.appointmentText!,
		timestamp: args.data.timestamp!,
		groupText: args.data.groupText!,
		url: args.data.url,
	};

	modifyAppData((d) => {
		d.appointments.push(newAppointment);
	});

	const message = `✔ Successfuly scheduled appointment reservation: \n${fmtAppointment(
		newAppointment
	)}`;
	await sendHtmlMessage(message);
};
