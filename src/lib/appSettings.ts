import { config } from "@/config/index";
import { AppSettings as AppData, ValidRecipeReturnType } from "@/types/bot";
import Conf from "conf/dist/source";
import produce from "immer";
import { WritableDraft } from "immer/dist/internal";
import { parse, stringify } from "superjson";

const baseData: AppData = {
  telegram: {
    chatId: undefined,
    lockedBy: undefined,
  },
  appointments: [],
};

export const appData = new Conf<AppData>({
  configName: config.appData.name,
  fileExtension: "json",
  defaults: baseData,
  serialize: stringify,
  deserialize: parse,
  projectName: config.name,
});

export const modifyAppData = (
  draft: (draft: WritableDraft<AppData>) => ValidRecipeReturnType<AppData>
) => {
  appData.set(produce<AppData>(appData.store, draft));
};

const removeAppointment = (appointmentId: string) => {
  modifyAppData((draft) => {
    draft.appointments = draft.appointments.filter(
      (a) => a.id !== appointmentId
    );
  });
};

export const appDataHelpers = {
  removeAppointment,
};
