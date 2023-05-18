import { config } from "@/config/index";
import { appData, appDataHelpers } from "@/lib/appSettings";
import { globalTelegramHelper } from "@/lib/configureBotCommands";
import { fmtAppointment, fmtDate } from "@/lib/format";
import { logger } from "@/lib/log";
import { Appointment } from "@/types/bot";
import { prepareForReserve } from "actions/reserveAppointment";
import { CronJob } from "cron";
import { differenceInMilliseconds, subSeconds } from "date-fns";
import { createReadStream } from "fs";
import { errors } from "playwright";

const onReservationSchedulerRun = async (appointment: Appointment) => {
  let errorMsg = `Enrollment failed, you will have to do it manually, ${appointment.url}`;

  const { reserve } = await prepareForReserve({
    onPrepareError: async (err) => {
      await globalTelegramHelper.sendTextMessage(errorMsg);
      logger.error(err, "Error while preparing for enrollment");
    },
    appointment: appointment,
  });

  if (!reserve) {
    return;
  }

  let timeToWait =
    differenceInMilliseconds(appointment.timestamp, new Date()) + 500;

  timeToWait = timeToWait < 0 ? 0 : timeToWait;

  setTimeout(async () => {
    logger.info(`Begin enrollment for ${appointment.id}`);

    await reserve({
      onError: async (err: any) => {
        logger.error(err, "Error while reserving appointment");
        if (err instanceof errors.TimeoutError) {
          // remove appointment if there is no element with provided text
          errorMsg +=
            " \nReason: Timeout, you most likely provided wrong `appointmentText` or `groupText`";
        } else if (err?.message === config.errors.ALREADY_RESERVED) {
          appDataHelpers.removeAppointment(appointment.id);
          errorMsg = `Already reserved for ${fmtAppointment(appointment, {
            short: true,
          })}`;
        }
        await globalTelegramHelper.sendHtmlMessage(errorMsg);
      },
      onSuccess: async () => {
        // remove appointment if it was successfully reserved
        appDataHelpers.removeAppointment(appointment.id);
        await globalTelegramHelper.sendHtmlMessage(
          `Successfully reserved for ${fmtAppointment(appointment, {
            short: true,
          })}`
        );
        //
        // const img = createReadStream(config.paths.img.latest);
        // await globalTelegramHelper.sendPhoto(img);
      },
    });
    logger.info(
      `job ${appointment.id} done (appointment at ${fmtDate(Date.now())})`
    );
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
        // start the job few secs earlier to account for login time
        const job = new CronJob(
          subSeconds(appointment.timestamp, config.coldStartSeconds),
          async () => {
            await onReservationSchedulerRun(appointment);
          },
          null,
          true,
          "Europe/Zagreb"
        );
        logger.debug(
          `Schedule job ${appointment.id} at ${fmtDate(appointment.timestamp)}`
        );

        job.start();
        crons.push(job);
      } catch (error) {
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
