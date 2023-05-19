import { logger } from "@/lib/log";
import { WatchedGroupData } from "@/types/bot";
import { CronJob } from "cron";

export const cronIntervals = {
  h: "0 * * * *",
  d: "0 0 * * *",
  m30: "*/30 * * * *",
  m15: "*/15 * * * *",
  m5: "*/5 * * * *",
  m1: "*/1 * * * *",
} as const;

const watchedPage = {
  url: "https://moj.tvz.hr/studijrac/predmet/154960",
  interval: "h",
  lastGroups: [
    {
      title: "Skupina: 1",
    },
  ],
} as const;

// `/watch <url> <interval>`
// interval: h, d, m30, m15, m5, m1
export const findNewGroups = async (watchedGroup: WatchedGroupData) => {
  try {
  } catch (error) {
    logger.error(error, "while watching groups");
    return null;
  }
};

export const groupWatchScheduler = () => {
  let crons: Array<CronJob> = [];

  const scheduleGroupWatchJobs = async () => {
    const job = new CronJob(
      cronIntervals[watchedPage.interval],
      async () => {
        // const groupResault = await findNewGroups();
        // if (!groupResault) return;
        // if (groupResault.newGroups.length > 0) {
        // 	logger.info("New groups found");
        // }
      },
      null,
      true,
      "Europe/Zagreb"
    );
    logger.debug(`Schedule job at ${cronIntervals[watchedPage.interval]}`);
  };
};
