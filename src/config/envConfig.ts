import { exitWithoutRestart } from "@/lib/exitWithoutRestart";
import { logger } from "@/lib/log";
import Conf from "conf/dist/source";
import { z } from "zod";
import { config } from ".";
import { fmtZodError } from "../lib/format";

export const envConfigSchema = z.object({
  TVZ_EMAIL: z
    .string()
    .email()
    .endsWith("@tvz.hr", "Email must end with @tvz.hr"),
  TVZ_PASSWORD: z.string().min(1, "Password too short"),
  TG_SECRET: z.string().min(1, "Telegram secret too short"),
});

export type EnvConfig = z.infer<typeof envConfigSchema>;
export const envConfigKeys = Object.keys(envConfigSchema.shape);

export const envConfig = new Conf<Partial<EnvConfig>>({
  defaults: {
    TVZ_EMAIL: undefined,
    TVZ_PASSWORD: undefined,
    TG_SECRET: undefined,
  },
  projectName: config.name,
  configName: config.envConfig.name,
  encryptionKey: config.envConfig.encryptionKey,
});

// TODO: implement "true" (process.env) env config for hosing providers
export const USE_TRUE_ENV = process.env?.USE_TRUE_ENV === "true";

export const trueEnvConfig = {
  get: (key: keyof EnvConfig) => process.env[key],
  set: (key: keyof EnvConfig, value: any) => {
    logger.error("Using USE_TRUE_ENV=true is not recommended!");
  },
};

export const validateAndSetEnvValue = (key: keyof EnvConfig, value: any) => {
  const parsed = envConfigSchema.shape[key].safeParse(value);
  if (!parsed.success) {
    console.log(fmtZodError(parsed));
    return false;
  } else {
    envConfig.set(key, value);
    console.log(`Set ${key} to ${value}`);

    return true;
  }
};

// will exit if config is invalid
export const validateEnvConfig = (exit = true) => {
  const parsed = envConfigSchema.safeParse(envConfig.store);
  if (!parsed.success) {
    logger.error(
      "Config error occured! (did you set the config values?)\n",
      fmtZodError(parsed)
    );
    exit && exitWithoutRestart();
  }
};
