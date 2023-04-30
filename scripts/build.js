// <reference types="esbuild" />
const esbuild = require("esbuild");
const esbuildPluginPino = require("esbuild-plugin-pino");

esbuild
	.build({
		entryPoints: ["maind.ts", "main.ts"],
		bundle: true,
		external: ["./appIcon.png", "./deploy"],
		minify: true,
		minifyWhitespace: true,
		minifyIdentifiers: true,
		platform: "node",
		target: "node18",
		outdir: "dist",
		plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
	})
	.catch(() => process.exit(1))
	.then(() => process.exit(0));
