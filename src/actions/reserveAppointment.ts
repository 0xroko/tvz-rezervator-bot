import { client } from "@/lib/axios";
import { logger } from "@/lib/log";
import { Appointment } from "@/types/bot";
import { login } from "actions/login";
import { load } from "cheerio";
import { config } from "../config";

interface PrepareForReserve {
  appointment: Appointment;
}

export const prepareForReserve = async ({ appointment }: PrepareForReserve) => {
  const startTimestamp = Date.now();

  let groupPageForm: string;

  const loginResp = await login(appointment.url, {
    supporttype: "labo",
  });
  const $ = load(loginResp.data);

  // find form needed to request right appointment group
  const groupForm = $(`*:contains('${appointment.groupText}')`)
    .last()
    .parent()
    .find("form");

  if (groupForm.length === 0) {
    throw new Error(`Group '${appointment.groupText}' couldn't be found!`);
  }

  groupPageForm = groupForm.serialize();

  const time = Date.now() - startTimestamp;
  logger.trace(`login took ${time}ms`);

  return groupPageForm;
};

export const reserveAppointment = async ({
  appointment,
  groupPageForm,
}: {
  appointment: Appointment;
  groupPageForm: string;
}) => {
  const startTimestamp = Date.now();
  const appointmentsPage = await client.post(appointment.url, groupPageForm);

  const $ = load(appointmentsPage.data);

  const appointmentForm = $(`*:contains('${appointment.appointmentText}')`)
    .last()
    .parent()
    .find("form");

  logger.trace(appointmentForm.serialize);

  if (appointmentForm.length === 0) {
    throw new Error(
      `No appointement with ${appointment.appointmentText} found`
    );
  }

  const alreadyReserved = $("input[value='obrisi'][name='sto1']").length > 0;
  if (alreadyReserved) {
    throw new Error(config.errors.ALREADY_RESERVED);
  }

  const postReservePage = await client.post(
    appointment.url,
    appointmentForm.serialize()
  );

  const $$ = load(postReservePage.data);

  if ($$("input[value='obrisi']").length > 0) {
    logger.info(`Appointment reserved!`);
    return;
  }
  logger.trace("reservation took " + (Date.now() - startTimestamp) + "ms");
};
