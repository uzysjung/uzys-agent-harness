import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ESC = String.fromCharCode(27);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const BOLD_RE = new RegExp(`${ESC}\\[1m`);

describe("design module — color disabled (no TTY)", () => {
  let originalIsTTY: boolean | undefined;
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout?.isTTY;
    originalNoColor = process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    Reflect.deleteProperty(process.env, "NO_COLOR");
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      configurable: true,
    });
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    }
  });

  it("returns plain text when not a TTY", async () => {
    const { c } = await import("../src/design.js");
    expect(c.green("ok")).toBe("ok");
    expect(c.red("err")).toBe("err");
    expect(c.bold("bold")).toBe("bold");
  });
});

describe("design module — color enabled (TTY)", () => {
  let originalIsTTY: boolean | undefined;
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout?.isTTY;
    originalNoColor = process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    Reflect.deleteProperty(process.env, "NO_COLOR");
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      configurable: true,
    });
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    } else {
      Reflect.deleteProperty(process.env, "NO_COLOR");
    }
  });

  it("emits ANSI escapes when stdout is a TTY", async () => {
    const { c } = await import("../src/design.js");
    expect(c.green("ok")).toMatch(ANSI_RE);
    expect(c.bold("x")).toMatch(BOLD_RE);
  });

  it("respects NO_COLOR even on a TTY", async () => {
    process.env.NO_COLOR = "1";
    vi.resetModules();
    const { c } = await import("../src/design.js");
    expect(c.green("ok")).toBe("ok");
  });
});
