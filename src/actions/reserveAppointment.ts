import { logger } from "@/lib/log";
import { Appointment, SerializedField } from "@/types/bot";
import { chromium } from "playwright";
import { config } from "../config";
import { login, loginNew } from "./login";
import { load } from "cheerio";
import { client } from "../../main";

interface Add {
  onSuccess: () => Promise<void>;
  onError: (error: unknown) => Promise<void>;
}

interface PrepareForReserve {
  appointment: Appointment;
  onPrepareError: (error: unknown) => Promise<void>;
}

// this will open browser instance, login and return `enroll` function
// using post requests would be faster, but requires wayyy more work
export const prepareForReserve = async ({
  onPrepareError: onPrepareError,
  appointment,
}: PrepareForReserve) => {
  const startTimestamp = Date.now();

  let groupPageForm: SerializedField[] = [];

  try {
    const login = await loginNew(appointment.url);
    const $ = load(login.data);
    // find form needed to request right appointment group
    const groupForm = $(`*:contains('${appointment.groupText}')`)
      .last()
      .parent()
      .find("form");

    console.log(groupForm);
    if (groupForm.length === 0) {
      throw new Error("Group couldn't be found!");
    }

    groupPageForm = groupForm.serializeArray();
  } catch (error) {
    await onPrepareError(error);
    return { enroll: null };
  }

  const time = Date.now() - startTimestamp;
  logger.info(`Login/setup took ${time}ms`);

  return {
    reserve: async ({ onError, onSuccess }: Add) => {
      const startTimestamp = Date.now();
      try {
        const body = groupPageForm
          .map((field) => {
            return `${field.name}=${field.value}`;
          })
          .join("&");

        const appointmentsPage = await client.post(appointment.url, body);

        const $ = load(appointmentsPage.data);

        const appointmentForm = $(
          `*:contains('${appointment.appointmentText}')`
        )
          .last()
          .parent()
          .find("form");

        if (appointmentForm.length === 0) {
          throw new Error("Appointment couldn't be found!");
        }

        const appointmentPageForm = appointmentForm
          .serializeArray()
          .map((field) => {
            return `${field.name}=${field.value}`;
          })
          .join("&");

        const postReservePage = await client.post(
          appointment.url,
          appointmentPageForm
        );

        const $$ = load(postReservePage.data);

        if ($$("input[value='obrisi']").length > 0) {
          await onSuccess();
        }

        const alreadyReserved = false;

        logger.debug(`Already reserved: ${alreadyReserved}`);

        if (alreadyReserved) {
          throw new Error(config.errors.ALREADY_RESERVED);
        }

        await onSuccess();
      } catch (error) {
        await onError(error);
      } finally {
        logger.info("Enrollment took " + (Date.now() - startTimestamp) + "ms");
      }
    },
  };
};
