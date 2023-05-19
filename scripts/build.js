// <reference types="esbuild" />
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["maind.ts", "main.ts"],
    bundle: true,
    external: ["./appIcon.png", "./deploy"],
    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    platform: "node",
    banner: { js: "#!/usr/bin/env node" },
    target: "node18",
    outdir: "dist",
  })
  .catch(() => process.exit(1))
  .then(() => process.exit(0));
