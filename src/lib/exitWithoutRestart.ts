import { config } from "@/config/index";

export const exitWithoutRestart = () => {
  process.exit(config.DO_NOT_RESTART_CODE);
};
