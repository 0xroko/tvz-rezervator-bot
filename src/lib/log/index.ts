import { format } from "date-fns";
import c from "picocolors";
import { Formatter } from "picocolors/types";

export const fmtLogTimeStamp = (date?: number | Date) => {
  return format(date ?? new Date(), "HH:mm:ss.SSS");
};

const baseLog = (baseMessage: string, colorFn: Formatter, plain = false) => {
  return (...args: Parameters<typeof console.log>) => {
    const nArgs = args?.map((arg) => {
      if (arg instanceof Error) {
        const { message, stack, ...rest } = arg;
        const msg = `${message}: ${stack}`;
        return colorFn(msg);
      }
      arg = typeof arg === "string" ? arg : JSON.stringify(arg, null, 2);
      arg = colorFn(arg);
      return arg;
    });

    if (plain) {
      console.log(...nArgs);
      return;
    }

    const dateStr = c.dim(fmtLogTimeStamp(Date.now()));
    let logPrefix = dateStr + " " + c.inverse(colorFn(baseMessage));

    console.log(logPrefix, ...nArgs);
  };
};

export const logger = {
  trace: baseLog("TRACE", c.dim),
  debug: baseLog("DEBUG", c.blue),
  info: baseLog("INFO", c.cyan),
  warn: baseLog("WARN", c.yellow),
  error: baseLog("ERROR", c.red),
  fatal: baseLog("FATAL", c.bgRed),
  errorPlain: baseLog("", c.red, true),
  infoPlain: baseLog("", c.cyan, true),
};
