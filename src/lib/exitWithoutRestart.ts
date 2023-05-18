import { config } from "@/config/index";

export const exitWithoutRestart = () => {
  // this should exit the parent script but not the child script so we call process.exit(0)
  process.exit(config.DO_NOT_RESTART_CODE);
};
