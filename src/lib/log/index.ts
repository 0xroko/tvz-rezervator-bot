import pino from "pino";

const transport = pino.transport({
  targets: [
    {
      level: "error",
      target: "pino/file",
      options: {
        mkdir: true,
        prettyPrint: true,
        translateTime: "SYS:standard",
        destination: "logs/error.log",
      },
    },
    {
      level: "trace",
      target: "pino/file",
      options: {
        mkdir: true,
        prettyPrint: true,
        translateTime: "SYS:standard",
        destination: "logs/all.log",
      },
    },
    {
      level: "trace",
      target: "pino-pretty",
      options: {
        translateTime: "SYS:hh:MM:ss",
        levelFirst: true,
        colorize: true,
        destination: 0,
      },
    },
  ],
});

export const logger = pino(
  {
    base: null,
    hooks: {},
    level: "trace",
    serializers: {
      err: pino.stdSerializers.err,
    },
  },
  transport
);
