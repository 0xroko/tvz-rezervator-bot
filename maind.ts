import { config } from "@/config/index";
import forever from "forever-monitor";

const args = process.argv.slice(2);

let child = new forever.Monitor("main.js", {
  max: 999,
  silent: false,
  // forward args
  args: args,
  killTree: true,
  sourceDir: "dist/",
});

const cleanup = () => {
  child.stop();
  process.exit(0);
};

child.on("exit", function () {
  console.log("maind.js has exited");
});

child.on("exit:code", function (r) {
  if (r === config.DO_NOT_RESTART_CODE) {
    cleanup();
  }
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
