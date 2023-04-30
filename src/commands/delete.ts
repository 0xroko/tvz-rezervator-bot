import { modifyAppData } from "@/lib/appSettings";
import { CommandFn } from "@/types/bot";
import { z } from "zod";

const deleteInputSchema = z.object({
  id: z.string(),
});

export type DeleteCommandInput = z.infer<typeof deleteInputSchema>;

export const deleteCommand: CommandFn<DeleteCommandInput> = async (
  msg,
  args,
  { sendTextMessage, sendMDMessage }
) => {
  let found = false;

  const parsedArgs = deleteInputSchema.safeParse(args);

  const deleteAll = args.id === "*";

  if (!parsedArgs.success) {
    await sendTextMessage("ID or * is required");
    return;
  }

  modifyAppData((d) => {
    if (deleteAll) {
      d.appointments = [];
      return;
    }
    if (d.appointments.find((appointment) => appointment.id === args.id))
      found = true;
    d.appointments = d.appointments.filter(
      (appointment) => appointment.id !== args.id
    );
  });

  if (deleteAll) {
    await sendTextMessage("🗑️ All scheduled reservations deleted");
  } else if (found) {
    await sendTextMessage(`💥 Appointment with id ${args.id} deleted`);
  } else {
    await sendTextMessage(`😕 Appointment with id ${args.id} not found`);
  }
};
