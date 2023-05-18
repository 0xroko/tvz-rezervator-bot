import { cronIntervals } from "actions/watchSkupine";
import { Nothing } from "immer/dist/internal";
import TelegramBot, { User } from "node-telegram-bot-api";

export type SerializedField = {
  name: string;
  value: string;
};

export interface Appointment {
  id: string;
  groupText: string;
  appointmentText: string;
  url: string;
  timestamp: Date;
  staus: "success" | "failed" | "scheduled";
}

export interface WatchedGroupData {
  url: string;
  interval: typeof cronIntervals[keyof typeof cronIntervals];
  lastGroups: {
    title: string;
  }[];
  lastTimestamp: Date;
}

export interface AppSettings {
  telegram: {
    chatId?: number;
    lockedBy?: User;
  };
  appointments: Appointment[];
}

export type SendTextMessage = (
  msg: string,
  options?: TelegramBot.SendMessageOptions | undefined
) => Promise<TelegramBot.Message>;

export type SendPhoto = (
  photo: Parameters<TelegramBot["sendPhoto"]>[1]
) => ReturnType<TelegramBot["sendPhoto"]>;

export type TelegramHelper = {
  sendTextMessage: SendTextMessage;
  sendMDMessage: SendTextMessage;
  sendHtmlMessage: SendTextMessage;
  sendPhoto: SendPhoto;
};

export type CommandInput = {
  [x: string]: unknown;
  _: (string | number)[];
  $0: string;
};

export type CommandFn<T = any> = (
  msg: TelegramBot.Message,
  args: T,
  helpers: TelegramHelper
) => Promise<void>;

export type Commands = {
  [command: string]: {
    fn: CommandFn;
    lockRequired: boolean;
    rescheduleRequired?: boolean;
  };
};

export type ValidRecipeReturnType<State> =
  | State
  | void
  | undefined
  | (State extends undefined ? Nothing : never);
