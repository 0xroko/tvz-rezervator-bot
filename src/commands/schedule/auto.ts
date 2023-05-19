import { modifyAppData } from "@/lib/appSettings";
import { client, jar } from "@/lib/axios";
import { fmtAppointment } from "@/lib/format";
import { logger } from "@/lib/log";
import { Appointment as AppAppointment, CommandFn } from "@/types/bot";
import { login } from "actions/login";
import { load } from "cheerio";
import TelegramBot from "node-telegram-bot-api";
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

interface SerializedField {
  name: string;
  value: string;
}

// asume admin won't change form data during selection
interface Group {
  form: SerializedField[];
  title: string;
}

interface Appointment {
  form: SerializedField[];
  status: string;
  title: string;
}

const getSkupine = async (url: string) => {
  const skupine: Group[] = [];

  const cookie = jar?.getCookieStringSync(url).split("=")[0];

  const labo = await client.post(url, `TVZ=${cookie}&supporttype=labo`);

  const $ = load(labo.data);
  const match = $("div:contains('Rezervacija termina za studente')").last();

  const parent = match.parent();
  // find all "panel-body" elements inside the parent
  const panelBody = parent.find(".panel-body");

  // loop through all panel-body elements
  for (let el of panelBody) {
    // get the text of the element
    let text = $(el).text();
    text = text?.replace("Skupina:", "");
    text = text?.split(", broj grupa")[0];
    // if the text contains "Rezervacija termina za studente"

    // find the form element inside the panel-body
    const form = $(el).find("form");

    // get all the form data from the form
    const formData = form.serializeArray();

    skupine.push({
      form: formData,
      title: text,
    });
  }

  return skupine;
};

const getAppointments = async (url: string, skupina: Group) => {
  const cookie = jar?.getCookieStringSync(url).split("=")[0];
  const appointments: Appointment[] = [];
  const urlEncodedFormData = skupina.form
    .map((x) => `${x.name}=${x.value}`)
    .join("&");

  const tem = await client.post(url, urlEncodedFormData, {});

  const $term = load(tem.data);

  // find elemnt that contains "Rezervacija termina"
  const term = $term("div:contains('Rezervacija termina')").last();

  // get the parent of the element
  const termParent = term.parent();

  // find all "panel-body" elements inside the parent
  const termPanelBody = termParent.find(".panel");

  // loop through all panel-body elements
  for (let elt of termPanelBody) {
    // get the text of the element
    let text = $term(elt).find(".col-xs-10").text();

    text = text?.replace("Termin:", "");
    text = text?.split(", maks.studena")[0];
    const statusText = $term(elt).find(".col-xs-2").text();
    // type="submit" and get the value of the button
    const statusBtn = $term(elt)
      .find(".col-xs-2")
      .find("button[type='submit']")[0]?.attribs["value"];

    // find the form element inside the panel-body
    const form = $term(elt).find("form");

    // get all the form data from the form
    const formData = form.serializeArray();

    appointments.push({
      form: formData,
      title: text,
      status: statusText ?? statusBtn ?? "N/A",
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

  logger.info("Browser launched");

  await login(args.url);

  const skupine: Group[] = await getSkupine(args.url);

  logger.info("Found groups ", skupine);
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

  let appointments: Appointment[] = [];
  let selectedSkupinaIndex = -1;

  const callbackQueryPromise = new Promise<void>((resolve, reject) => {
    bot.on("callback_query", async (callbackMsg) => {
      try {
        // ignore callback if it's from a different message
        if (callbackMsg.message?.message_id !== queryMesg.message_id) return;

        const action = callbackMsg.data?.split("_")[0];

        switch (action) {
          case "group":
            selectedSkupinaIndex = parseInt(
              callbackMsg.data?.split("_")[1] ?? "NaN"
            );

            const skupina = skupine[selectedSkupinaIndex];

            logger.info(`selected group: '${skupina.title}'`);

            try {
              appointments = await getAppointments(args.url, skupina);
            } catch (error) {
              logger.error(error);
              throw new Error("Error occured while fetching appointments");
            }

            logger.info(`found ${appointments.length} appointments`);

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
              "<b>Reply</b> to this message with a time and date for the appointment reservation (format: 11:34-12.2.2023)";
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
                  const newAppointment: AppAppointment = {
                    appointmentText: appointments[appointmentIndex].title,
                    groupText: skupine[selectedSkupinaIndex].title,
                    url: args.url,
                    id: nanoid(),
                    status: "scheduled",
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
};
