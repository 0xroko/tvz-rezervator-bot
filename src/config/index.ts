import { envPaths } from "@/lib/env-path";
import path from "path";

export const appName = "tvz-rezervator-bot";

export const paths = envPaths(appName);

// app config
export const config = {
  name: appName,
  coldStartSeconds: 10,
  // exit code when process is finished (e.g. env var was set), doesn't hold any special meaning
  DO_NOT_RESTART_CODE: 125,
  envConfig: {
    name: "env-config",
    encryptionKey: "this-is-not-really-important-but-helps-with-obscurity",
  },
  appData: {
    name: "app-data",
  },
  paths: {
    img: {
      latest: path.join(paths.data, "latest.png"),
      latestFull: path.join(paths.data, "latestFull.png"),
    },
  },
  errors: {
    ALREADY_RESERVED: "ALREADY_RESERVED",
    INVALID_DATE: "INVALID_DATE",
    DATE_IN_PAST_NOT_ALLOWED: "DATE_IN_PAST_NOT_ALLOWED",
  },
} as const;
