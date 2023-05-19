import { config } from "@/config/index";
import { appData, appDataHelpers } from "@/lib/appSettings";
import { globalTelegramHelper } from "@/lib/configureBotCommands";
import { fmtAppointment, fmtDate } from "@/lib/format";
import { logger } from "@/lib/log";
import { Appointment } from "@/types/bot";
import {
  prepareForReserve,
  reserveAppointment,
} from "actions/reserveAppointment";
import { CronJob } from "cron";
import { differenceInMilliseconds, subSeconds } from "date-fns";

const onReservationSchedulerRun = async (appointment: Appointment) => {
  let errorMsg = `Enrollment failed, you will have to do it manually, ${appointment.url}`;

  let groupForm = "";
  try {
    groupForm = await prepareForReserve({
      appointment: appointment,
    });
  } catch (error) {
    logger.error(error, "Error while preparing for reservation");
    globalTelegramHelper.sendTextMessage(errorMsg);
    return;
  }

  let timeToWait =
    differenceInMilliseconds(appointment.timestamp, new Date()) + 200;

  timeToWait = timeToWait < 0 ? 0 : timeToWait;

  setTimeout(async () => {
    logger.info(`Begin reservation for ${appointment.id}`);
    try {
      await reserveAppointment({
        appointment: appointment,
        groupPageForm: groupForm,
      });
      await globalTelegramHelper.sendHtmlMessage(
        `Successfully reserved for ${fmtAppointment(appointment, {
          short: true,
        })}`
      );
      logger.info(
        `job ${appointment.id} done (appointment at ${fmtDate(Date.now())})`
      );
    } catch (err: any) {
      logger.error(err, "Error while reserving appointment");
      if (err?.message === config.errors.ALREADY_RESERVED) {
        errorMsg = `Appointment ${appointment.id} already reserved, ${appointment.url}`;
      }
      await globalTelegramHelper.sendHtmlMessage(errorMsg);
    } finally {
      appDataHelpers.removeAppointment(appointment.id);
    }
  }, timeToWait);
};

export const reservationScheduler = ({}) => {
  let crons: Array<CronJob> = [];

  const scheduleAppointmentReservationJobs = async () => {
    const appointments = appData.get("appointments");

    if (appointments.length === 0) {
      logger.info("No jobs to schedule");
      return;
    }

    for (const appointment of appointments) {
      try {
        const job = new CronJob(
          // start the job few sec earlier to account for login time
          subSeconds(appointment.timestamp, config.coldStartSeconds),
          async () => {
            await onReservationSchedulerRun(appointment);
          },
          null,
          true,
          "Europe/Zagreb"
        );
        logger.info(
          `Schedule job ${appointment.id} at ${fmtDate(appointment.timestamp)}`
        );

        job.start();
        crons.push(job);
      } catch (error) {
        logger.info(
          `Appointment ${appointment.id} is outdated, removing it...`
        );
        globalTelegramHelper.sendTextMessage(
          `Appointment ${appointment.id} is outdated (due: ${fmtDate(
            appointment.timestamp
          )}), removing it...`
        );
        appDataHelpers.removeAppointment(appointment.id);
      }
    }
  };

  const rescheduleAppointmentReservationJobs = async () => {
    logger.info("Rescheduling jobs");
    crons.forEach((c) => c.stop());
    crons = [];
    await scheduleAppointmentReservationJobs();
  };

  process.on("exit", () => {
    crons.forEach((c) => c.stop());
  });

  return {
    scheduleAppointmentReservationJobs: scheduleAppointmentReservationJobs,
    rescheduleAppointmentReservationJobs: rescheduleAppointmentReservationJobs,
  };
};
