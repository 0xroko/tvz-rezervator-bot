import { config } from "@/config/index";
import { logger } from "@/lib/log";
import forever from "forever-monitor";
import { join } from "node:path";

const sourceScript = "main.js";
const sourcePath =
  process.env?.NODE_ENV === "development" ? "dist/" : __dirname;

const args = process.argv.slice(2);

const realSourcePath = join(sourcePath, sourceScript);

let child = new forever.Monitor(realSourcePath, {
  max: 999,
  silent: false,
  // forward args
  args: [...args, "--color"],
  killTree: true,
});

const cleanup = () => {
  child.stop();
  process.exit(0);
};

child.on("exit:code", function (code) {
  if (code === config.DO_NOT_RESTART_CODE) {
    cleanup();
  }
});

child.on("error", function (data) {
  logger.error(data);
  logger.error("This is most likely a bug with finding the bot script.");
  logger.error(`Script path: ${realSourcePath}`);
  cleanup();
});

child.start();

[
  `exit`,
  `SIGINT`,
  `SIGUSR1`,
  `SIGUSR2`,
  `uncaughtException`,
  `SIGTERM`,
].forEach((eventType) => {
  process.on(eventType, (evnt) => {
    cleanup();
  });
});
