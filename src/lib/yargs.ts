import { envConfigKeys, validateAndSetEnvValue } from "@/config/envConfig";
import { exitWithoutRestart } from "@/lib/exitWithoutRestart";
import { CommandInput } from "@/types/bot";
import yargs from "yargs";

export const aliases = {
	schedule: ["s"],
	lock: ["l"],
	unlock: ["u"],
	list: ["ls"],
	delete: ["d"],
	help: ["h"],
};

export type AliasCommands = keyof typeof aliases;

export type Aliases = typeof aliases;

export const getAlias = (cmd: keyof typeof aliases) => {
	return aliases[cmd];
};

export const ifAliasReplaceWithCmd = (commandInput: CommandInput) => {
	const aliasedCommand = commandInput._[0] as string;
	for (const alias of Object.keys(aliases)) {
		const aliasedCommands = aliases[alias as AliasCommands];
		if (aliasedCommands.includes(aliasedCommand)) {
			return {
				...commandInput,
				_: [alias],
			} as CommandInput;
		}
	}
	return commandInput;
};

const y = yargs();

export const yargsBot = y
	.scriptName("")
	.usage("/<cmd> [args]")
	.command({
		command: "schedule [url] [groupText] [appointmentText] [timestamp]",
		describe: "Schedule new appointment reservation",
		builder: (y) => {
			return y
				.positional("url", {
					type: "string",
					description: "Url to appointment",
				})
				.positional("groupText", {
					type: "string",
					description: "Text to find correct 'skupina'",
					coerce: (arg) => {
						// remove "
						return arg.replace(/"/g, "");
					},
				})
				.positional("appointmentText", {
					type: "string",
					description: "Text to find correct 'termin'",
					coerce: (arg) => {
						// remove "
						return arg.replace(/"/g, "");
					},
				})
				.positional("timestamp", {
					type: "string",
					description: "Reservation time and date in format",
				});
		},
		handler: () => {},
		aliases: [...getAlias("schedule")],
	})

	.command({
		command: "delete [id]",
		describe: "Delete an appointment (all: *)",
		builder: (y) => {
			return y.positional("id", {
				type: "string",
				description: "Id of appointment to delete",
			});
		},
		handler: () => {},
		aliases: [...getAlias("delete")],
	})
	.command({
		command: "lock",
		describe: "Lock the bot",
		handler: () => {},
		aliases: [...getAlias("lock")],
	})

	.command({
		command: "unlock",
		describe: "Unlock the bot",
		handler: () => {},
		aliases: [...getAlias("unlock")],
	})
	.command({
		command: "list",
		describe: "List all scheduled appointments",
		handler: () => {},
		aliases: [...getAlias("list")],
	})
	.command({
		command: "help",
		describe: "Help",
		handler: () => {},
		aliases: [...getAlias("help")],
	})
	.wrap(50)
	.version(false)
	.help(false)
	.exitProcess(false);

export const yargsCli = yargs();

// if handler doesn't exit process, bot will start
yargsCli
	.scriptName("reg-bot")

	.command({
		builder: (y) => {
			return y
				.positional("key", {
					type: "string",
					describe: "Key to set",
					choices: envConfigKeys,
				})
				.positional("value", {
					type: "string",
					describe: "Value to set",
				});
		},
		handler: async (args) => {
			validateAndSetEnvValue(args.key, args.value);
			exitWithoutRestart();
		},
		command: "set <key> <value>",
		describe: "Set config values",
	})
	.command({
		command: ["start"],
		describe: "Starts the bot (default command)",
		handler: () => {},
	})
	.exitProcess(false)
	.version(false)
	.help(false);

export const helpCli = async () => {
	const help = await yargsCli.getHelp();
	console.log(help);
};

export const cliParse = async () => {
	try {
		const parsed = yargsCli.parseSync(process.argv.slice(2));
		if (parsed._[0] === "help") {
			await helpCli();
			exitWithoutRestart();
		}
	} catch (err) {
		exitWithoutRestart();
	}
};
