import { modifyAppData } from "@/lib/appSettings";
import { fmtAppointment } from "@/lib/format";
import { logger } from "@/lib/log";
import { Appointment, CommandFn } from "@/types/bot";
import { login } from "actions/login";
import TelegramBot from "node-telegram-bot-api";
import { chromium, ElementHandle, Page } from "playwright";
import { z } from "zod";
import { nanoid, zodDateParse } from ".";
import { bot } from "../../../main";

const autoScheduleSchema = z.object({
	url: z
		.string()
		.url("Invalid")
		.startsWith(
			"https://moj.tvz.hr/",
			"Url must start with https://moj.tvz.hr/"
		),
});

const timestampAutoScheduleSchema = z.string().transform((val, ctx) => {
	const date = zodDateParse(val, ctx);
	return {
		timestamp: date,
	};
});

const breakInSubArrays = <T>(arr: T[], size: number) => {
	const result = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
};

interface Skupina {
	elment: ElementHandle<SVGElement | HTMLElement>;
	title: string;
}

export const findGroups = async (page: Page, url: string) => {
	await Promise.all([
		page.waitForNavigation(),
		page.locator("text=Rezervacija labosa").click(),
	]);

	const skupineElements = await page.$$("text=Skupina: >> .. >> ..");

	let skupine: Skupina[] = [];

	for (const skupinaElement of skupineElements) {
		const headingElm = await skupinaElement.$(".col-xs-10");

		let text = await headingElm?.evaluate((el) => el.childNodes[0].textContent);

		if (text) {
			text = text?.replace("Skupina:", "");
			skupine.push({
				elment: skupinaElement,
				title: text,
			});
		}
	}

	return skupine;
};

interface AppointmentSelect {
	elment: ElementHandle<SVGElement | HTMLElement>;
	title: string;
}

// skupina.element must the same as the one returned by findSkupine
const findAppointments = async (page: Page, skupina: Skupina) => {
	const button = await skupina.elment.$("input[type=submit]");

	await Promise.all([page.waitForNavigation(), button?.click()]);
	const appointmentElements = await page.$$(
		"text=Rezervacija termina u skupini >> .. >> .. >> .panel"
	);

	const appointments: AppointmentSelect[] = [];

	for (const appointmentElement of appointmentElements) {
		const headingElm = await appointmentElement.$(".col-xs-10");
		let text = await headingElm?.textContent();

		text = text?.replace("Termin:", "");
		text = text?.split("maks.studena")[0];
		if (text)
			appointments.push({
				elment: appointmentElement,
				title: text,
			});
	}

	return appointments;
};

export type AutoScheduleCommand = z.infer<typeof autoScheduleSchema>;

export const cancelOption = {
	text: "❌ Cancel",
	callback_data: "cancel",
};

// most of this needs a refactor
export const autoScheduleCommand: CommandFn<AutoScheduleCommand> = async (
	msg,
	args,
	{ sendTextMessage, sendMDMessage, sendHtmlMessage }
) => {
	const queryMesg = await sendHtmlMessage("🔃 Loading...");

	const editQueryMsg = async (
		text: string,
		options?: TelegramBot.EditMessageTextOptions | undefined
	) => {
		if (options?.reply_markup?.inline_keyboard.length === 0) {
			options.reply_markup.inline_keyboard = [];
		}
		await bot.editMessageText(text, {
			chat_id: queryMesg.chat.id,
			parse_mode: "HTML",
			disable_web_page_preview: true,
			message_id: queryMesg.message_id,
			...options,
		});
	};

	const browser = await chromium.launch({
		headless: true,
	});

	logger.info("Browser launched");

	const page = await browser.newPage();

	try {
		await login(page, args.url);
	} catch (error) {
		await editQueryMsg("Login failed!");
		return;
	}

	try {
		await page.locator("text=Rezervacija labosa").isVisible();
	} catch (error) {
		await editQueryMsg("❌ Aborting due to error!");
		throw new Error("Given url does not contain Rezervacija labosa tab");
	}

	const skupine = await findGroups(page, args.url);

	logger.info("Found groups %o", skupine);
	if (skupine.length === 0) {
		await editQueryMsg("No groups found!");
		return;
	}

	const skupinaQueryKeyboard: any[] = [];

	for (const skupina of skupine) {
		skupinaQueryKeyboard.push({
			text: skupina.title,
			callback_data: `group_${skupine.indexOf(skupina)}`,
		});
	}

	await editQueryMsg("📃 Following groups were found, select to proceed", {
		reply_markup: {
			inline_keyboard: breakInSubArrays(
				[...skupinaQueryKeyboard, cancelOption],
				1
			),
		},
	});

	let appointments: AppointmentSelect[] = [];
	let skupinaIndex = -1;

	// TODO: not sure if there is even a date present on the page
	let foundTimestampOnPage = false;

	const callbackQueryPromise = new Promise<void>((resolve, reject) => {
		bot.on("callback_query", async (callbackMsg) => {
			try {
				// ignore callback if it's from a different message
				if (callbackMsg.message?.message_id !== queryMesg.message_id) return;

				const action = callbackMsg.data?.split("_")[0];

				switch (action) {
					case "group":
						skupinaIndex = parseInt(callbackMsg.data?.split("_")[1] ?? "NaN");

						const skupina = skupine[skupinaIndex];

						logger.info(`Selected group: ${skupina.title}`);

						try {
							appointments = await findAppointments(page, skupina);
						} catch (error) {
							throw new Error("");
						}

						let appointmentOptions: any[] = [];

						for (const appointment of appointments) {
							appointmentOptions.push({
								text: appointment.title,
								callback_data: `appointment_${appointments.indexOf(
									appointment
								)}`,
							});
						}

						await editQueryMsg(
							"📃 Following appointments were found, select to proceed",
							{
								reply_markup: {
									inline_keyboard: breakInSubArrays(
										[...appointmentOptions, cancelOption],
										1
									),
								},
							}
						);

						break;
					case "appointment":
						const appointmentIndex = parseInt(
							callbackMsg.data?.split("_")[1] ?? "NaN"
						);

						let dateQueryMsg =
							"<b>Reply</b> to this message with a time and date for the appointment reservation (11:34-12.2.2023)";
						await editQueryMsg(dateQueryMsg, {
							reply_markup: {
								inline_keyboard: [[cancelOption]],
							},
						});

						bot.onReplyToMessage(
							callbackMsg.message?.chat.id!,
							callbackMsg.message?.message_id!,
							async (msg) => {
								const parsedTimestampSchema =
									timestampAutoScheduleSchema.safeParse(msg.text ?? "");
								if (!parsedTimestampSchema.success) {
									await editQueryMsg(
										dateQueryMsg + " \n\n<b>Invalid date format (try again)</b>"
									);
								} else {
									const newAppointment: Appointment = {
										appointmentText: appointments[appointmentIndex].title,
										groupText: skupine[skupinaIndex].title,
										url: args.url,
										id: nanoid(),
										staus: "scheduled",
										timestamp: parsedTimestampSchema.data.timestamp,
									};

									modifyAppData((data) => {
										data.appointments.push(newAppointment);
									});
									await editQueryMsg("Done!");
									await sendHtmlMessage(
										`✔ Successfuly scheduled appointment reservation\n${fmtAppointment(
											newAppointment
										)}`,
										{}
									);
									// date is found and valid
									resolve();
								}
							}
						);

						break;
					case "cancel":
						await editQueryMsg("❌ Canceled registration!", {});
						resolve();
						break;
				}
			} catch (error) {
				await editQueryMsg("❌ Aborting!", {});

				reject(error);
			}
		});
	});

	await callbackQueryPromise;
	await browser.close();
};
