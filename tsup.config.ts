import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/trust-tier-drift.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: [/^@clack\//, "cac"],
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  cjsInterop: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
