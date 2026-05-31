#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/tsup/assets/esm_shims.js
import path from "path";
import { fileURLToPath } from "url";
var init_esm_shims = __esm({
  "node_modules/tsup/assets/esm_shims.js"() {
    "use strict";
  }
});

// node_modules/sisteransi/src/index.js
var require_src = __commonJS({
  "node_modules/sisteransi/src/index.js"(exports, module) {
    "use strict";
    init_esm_shims();
    var ESC2 = "\x1B";
    var CSI2 = `${ESC2}[`;
    var beep = "\x07";
    var cursor = {
      to(x, y) {
        if (!y) return `${CSI2}${x + 1}G`;
        return `${CSI2}${y + 1};${x + 1}H`;
      },
      move(x, y) {
        let ret = "";
        if (x < 0) ret += `${CSI2}${-x}D`;
        else if (x > 0) ret += `${CSI2}${x}C`;
        if (y < 0) ret += `${CSI2}${-y}A`;
        else if (y > 0) ret += `${CSI2}${y}B`;
        return ret;
      },
      up: (count = 1) => `${CSI2}${count}A`,
      down: (count = 1) => `${CSI2}${count}B`,
      forward: (count = 1) => `${CSI2}${count}C`,
      backward: (count = 1) => `${CSI2}${count}D`,
      nextLine: (count = 1) => `${CSI2}E`.repeat(count),
      prevLine: (count = 1) => `${CSI2}F`.repeat(count),
      left: `${CSI2}G`,
      hide: `${CSI2}?25l`,
      show: `${CSI2}?25h`,
      save: `${ESC2}7`,
      restore: `${ESC2}8`
    };
    var scroll = {
      up: (count = 1) => `${CSI2}S`.repeat(count),
      down: (count = 1) => `${CSI2}T`.repeat(count)
    };
    var erase = {
      screen: `${CSI2}2J`,
      up: (count = 1) => `${CSI2}1J`.repeat(count),
      down: (count = 1) => `${CSI2}J`.repeat(count),
      line: `${CSI2}2K`,
      lineEnd: `${CSI2}K`,
      lineStart: `${CSI2}1K`,
      lines(count) {
        let clear = "";
        for (let i = 0; i < count; i++)
          clear += this.line + (i < count - 1 ? cursor.up() : "");
        if (count)
          clear += cursor.left;
        return clear;
      }
    };
    module.exports = { cursor, scroll, erase, beep };
  }
});

// src/index.ts
init_esm_shims();

// src/cli.ts
init_esm_shims();

// node_modules/cac/dist/index.js
init_esm_shims();
function toArr(any) {
  return any == null ? [] : Array.isArray(any) ? any : [any];
}
function toVal(out, key, val, opts) {
  var x, old = out[key], nxt = !!~opts.string.indexOf(key) ? val == null || val === true ? "" : String(val) : typeof val === "boolean" ? val : !!~opts.boolean.indexOf(key) ? val === "false" ? false : val === "true" || (out._.push((x = +val, x * 0 === 0) ? x : val), !!val) : (x = +val, x * 0 === 0) ? x : val;
  out[key] = old == null ? nxt : Array.isArray(old) ? old.concat(nxt) : [old, nxt];
}
function lib_default(args, opts) {
  args = args || [];
  opts = opts || {};
  var k2, arr, arg, name, val, out = { _: [] };
  var i = 0, j3 = 0, idx = 0, len = args.length;
  const alibi = opts.alias !== void 0;
  const strict = opts.unknown !== void 0;
  const defaults = opts.default !== void 0;
  opts.alias = opts.alias || {};
  opts.string = toArr(opts.string);
  opts.boolean = toArr(opts.boolean);
  if (alibi) for (k2 in opts.alias) {
    arr = opts.alias[k2] = toArr(opts.alias[k2]);
    for (i = 0; i < arr.length; i++) (opts.alias[arr[i]] = arr.concat(k2)).splice(i, 1);
  }
  for (i = opts.boolean.length; i-- > 0; ) {
    arr = opts.alias[opts.boolean[i]] || [];
    for (j3 = arr.length; j3-- > 0; ) opts.boolean.push(arr[j3]);
  }
  for (i = opts.string.length; i-- > 0; ) {
    arr = opts.alias[opts.string[i]] || [];
    for (j3 = arr.length; j3-- > 0; ) opts.string.push(arr[j3]);
  }
  if (defaults) for (k2 in opts.default) {
    name = typeof opts.default[k2];
    arr = opts.alias[k2] = opts.alias[k2] || [];
    if (opts[name] !== void 0) {
      opts[name].push(k2);
      for (i = 0; i < arr.length; i++) opts[name].push(arr[i]);
    }
  }
  const keys = strict ? Object.keys(opts.alias) : [];
  for (i = 0; i < len; i++) {
    arg = args[i];
    if (arg === "--") {
      out._ = out._.concat(args.slice(++i));
      break;
    }
    for (j3 = 0; j3 < arg.length; j3++) if (arg.charCodeAt(j3) !== 45) break;
    if (j3 === 0) out._.push(arg);
    else if (arg.substring(j3, j3 + 3) === "no-") {
      name = arg.substring(j3 + 3);
      if (strict && !~keys.indexOf(name)) return opts.unknown(arg);
      out[name] = false;
    } else {
      for (idx = j3 + 1; idx < arg.length; idx++) if (arg.charCodeAt(idx) === 61) break;
      name = arg.substring(j3, idx);
      val = arg.substring(++idx) || i + 1 === len || ("" + args[i + 1]).charCodeAt(0) === 45 || args[++i];
      arr = j3 === 2 ? [name] : name;
      for (idx = 0; idx < arr.length; idx++) {
        name = arr[idx];
        if (strict && !~keys.indexOf(name)) return opts.unknown("-".repeat(j3) + name);
        toVal(out, name, idx + 1 < arr.length || val, opts);
      }
    }
  }
  if (defaults) {
    for (k2 in opts.default) if (out[k2] === void 0) out[k2] = opts.default[k2];
  }
  if (alibi) for (k2 in out) {
    arr = opts.alias[k2] || [];
    while (arr.length > 0) out[arr.shift()] = out[k2];
  }
  return out;
}
function removeBrackets(v2) {
  return v2.replace(/[<[].+/, "").trim();
}
function findAllBrackets(v2) {
  const ANGLED_BRACKET_RE_GLOBAL = /<([^>]+)>/g;
  const SQUARE_BRACKET_RE_GLOBAL = /\[([^\]]+)\]/g;
  const res = [];
  const parse = (match) => {
    let variadic = false;
    let value = match[1];
    if (value.startsWith("...")) {
      value = value.slice(3);
      variadic = true;
    }
    return {
      required: match[0].startsWith("<"),
      value,
      variadic
    };
  };
  let angledMatch;
  while (angledMatch = ANGLED_BRACKET_RE_GLOBAL.exec(v2)) res.push(parse(angledMatch));
  let squareMatch;
  while (squareMatch = SQUARE_BRACKET_RE_GLOBAL.exec(v2)) res.push(parse(squareMatch));
  return res;
}
function getMriOptions(options) {
  const result = {
    alias: {},
    boolean: []
  };
  for (const [index, option] of options.entries()) {
    if (option.names.length > 1) result.alias[option.names[0]] = option.names.slice(1);
    if (option.isBoolean) if (option.negated) {
      if (!options.some((o, i) => {
        return i !== index && o.names.some((name) => option.names.includes(name)) && typeof o.required === "boolean";
      })) result.boolean.push(option.names[0]);
    } else result.boolean.push(option.names[0]);
  }
  return result;
}
function findLongest(arr) {
  return arr.sort((a, b2) => {
    return a.length > b2.length ? -1 : 1;
  })[0];
}
function padRight(str, length) {
  return str.length >= length ? str : `${str}${" ".repeat(length - str.length)}`;
}
function camelcase(input) {
  return input.replaceAll(/([a-z])-([a-z])/g, (_, p1, p2) => {
    return p1 + p2.toUpperCase();
  });
}
function setDotProp(obj, keys, val) {
  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = val;
      return;
    }
    if (current[key] == null) {
      const nextKeyIsArrayIndex = +keys[i + 1] > -1;
      current[key] = nextKeyIsArrayIndex ? [] : {};
    }
    current = current[key];
  }
}
function setByType(obj, transforms) {
  for (const key of Object.keys(transforms)) {
    const transform = transforms[key];
    if (transform.shouldTransform) {
      obj[key] = [obj[key]].flat();
      if (typeof transform.transformFunction === "function") obj[key] = obj[key].map(transform.transformFunction);
    }
  }
}
function getFileName(input) {
  const m = /([^\\/]+)$/.exec(input);
  return m ? m[1] : "";
}
function camelcaseOptionName(name) {
  return name.split(".").map((v2, i) => {
    return i === 0 ? camelcase(v2) : v2;
  }).join(".");
}
var CACError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CACError";
    if (typeof Error.captureStackTrace !== "function") this.stack = new Error(message).stack;
  }
};
var Option = class {
  rawName;
  description;
  /** Option name */
  name;
  /** Option name and aliases */
  names;
  isBoolean;
  required;
  config;
  negated;
  constructor(rawName, description, config) {
    this.rawName = rawName;
    this.description = description;
    this.config = Object.assign({}, config);
    rawName = rawName.replaceAll(".*", "");
    this.negated = false;
    this.names = removeBrackets(rawName).split(",").map((v2) => {
      let name = v2.trim().replace(/^-{1,2}/, "");
      if (name.startsWith("no-")) {
        this.negated = true;
        name = name.replace(/^no-/, "");
      }
      return camelcaseOptionName(name);
    }).sort((a, b2) => a.length > b2.length ? 1 : -1);
    this.name = this.names.at(-1);
    if (this.negated && this.config.default == null) this.config.default = true;
    if (rawName.includes("<")) this.required = true;
    else if (rawName.includes("[")) this.required = false;
    else this.isBoolean = true;
  }
};
var runtimeProcessArgs;
var runtimeInfo;
if (typeof process !== "undefined") {
  let runtimeName;
  if (typeof Deno !== "undefined" && typeof Deno.version?.deno === "string") runtimeName = "deno";
  else if (typeof Bun !== "undefined" && typeof Bun.version === "string") runtimeName = "bun";
  else runtimeName = "node";
  runtimeInfo = `${process.platform}-${process.arch} ${runtimeName}-${process.version}`;
  runtimeProcessArgs = process.argv;
} else if (typeof navigator === "undefined") runtimeInfo = `unknown`;
else runtimeInfo = `${navigator.platform} ${navigator.userAgent}`;
var Command = class {
  rawName;
  description;
  config;
  cli;
  options;
  aliasNames;
  name;
  args;
  commandAction;
  usageText;
  versionNumber;
  examples;
  helpCallback;
  globalCommand;
  constructor(rawName, description, config = {}, cli2) {
    this.rawName = rawName;
    this.description = description;
    this.config = config;
    this.cli = cli2;
    this.options = [];
    this.aliasNames = [];
    this.name = removeBrackets(rawName);
    this.args = findAllBrackets(rawName);
    this.examples = [];
  }
  usage(text) {
    this.usageText = text;
    return this;
  }
  allowUnknownOptions() {
    this.config.allowUnknownOptions = true;
    return this;
  }
  ignoreOptionDefaultValue() {
    this.config.ignoreOptionDefaultValue = true;
    return this;
  }
  version(version, customFlags = "-v, --version") {
    this.versionNumber = version;
    this.option(customFlags, "Display version number");
    return this;
  }
  example(example) {
    this.examples.push(example);
    return this;
  }
  /**
  * Add a option for this command
  * @param rawName Raw option name(s)
  * @param description Option description
  * @param config Option config
  */
  option(rawName, description, config) {
    const option = new Option(rawName, description, config);
    this.options.push(option);
    return this;
  }
  alias(name) {
    this.aliasNames.push(name);
    return this;
  }
  action(callback) {
    this.commandAction = callback;
    return this;
  }
  /**
  * Check if a command name is matched by this command
  * @param name Command name
  */
  isMatched(name) {
    return this.name === name || this.aliasNames.includes(name);
  }
  get isDefaultCommand() {
    return this.name === "" || this.aliasNames.includes("!");
  }
  get isGlobalCommand() {
    return this instanceof GlobalCommand;
  }
  /**
  * Check if an option is registered in this command
  * @param name Option name
  */
  hasOption(name) {
    name = name.split(".")[0];
    return this.options.find((option) => {
      return option.names.includes(name);
    });
  }
  outputHelp() {
    const { name, commands } = this.cli;
    const { versionNumber, options: globalOptions, helpCallback } = this.cli.globalCommand;
    let sections = [{ body: `${name}${versionNumber ? `/${versionNumber}` : ""}` }];
    sections.push({
      title: "Usage",
      body: `  $ ${name} ${this.usageText || this.rawName}`
    });
    if ((this.isGlobalCommand || this.isDefaultCommand) && commands.length > 0) {
      const longestCommandName = findLongest(commands.map((command) => command.rawName));
      sections.push({
        title: "Commands",
        body: commands.map((command) => {
          return `  ${padRight(command.rawName, longestCommandName.length)}  ${command.description}`;
        }).join("\n")
      }, {
        title: `For more info, run any command with the \`--help\` flag`,
        body: commands.map((command) => `  $ ${name}${command.name === "" ? "" : ` ${command.name}`} --help`).join("\n")
      });
    }
    let options = this.isGlobalCommand ? globalOptions : [...this.options, ...globalOptions || []];
    if (!this.isGlobalCommand && !this.isDefaultCommand) options = options.filter((option) => option.name !== "version");
    if (options.length > 0) {
      const longestOptionName = findLongest(options.map((option) => option.rawName));
      sections.push({
        title: "Options",
        body: options.map((option) => {
          return `  ${padRight(option.rawName, longestOptionName.length)}  ${option.description} ${option.config.default === void 0 ? "" : `(default: ${option.config.default})`}`;
        }).join("\n")
      });
    }
    if (this.examples.length > 0) sections.push({
      title: "Examples",
      body: this.examples.map((example) => {
        if (typeof example === "function") return example(name);
        return example;
      }).join("\n")
    });
    if (helpCallback) sections = helpCallback(sections) || sections;
    console.info(sections.map((section) => {
      return section.title ? `${section.title}:
${section.body}` : section.body;
    }).join("\n\n"));
  }
  outputVersion() {
    const { name } = this.cli;
    const { versionNumber } = this.cli.globalCommand;
    if (versionNumber) console.info(`${name}/${versionNumber} ${runtimeInfo}`);
  }
  checkRequiredArgs() {
    const minimalArgsCount = this.args.filter((arg) => arg.required).length;
    if (this.cli.args.length < minimalArgsCount) throw new CACError(`missing required args for command \`${this.rawName}\``);
  }
  /**
  * Check if the parsed options contain any unknown options
  *
  * Exit and output error when true
  */
  checkUnknownOptions() {
    const { options, globalCommand } = this.cli;
    if (!this.config.allowUnknownOptions) {
      for (const name of Object.keys(options)) if (name !== "--" && !this.hasOption(name) && !globalCommand.hasOption(name)) throw new CACError(`Unknown option \`${name.length > 1 ? `--${name}` : `-${name}`}\``);
    }
  }
  /**
  * Check if the required string-type options exist
  */
  checkOptionValue() {
    const { options: parsedOptions, globalCommand } = this.cli;
    const options = [...globalCommand.options, ...this.options];
    for (const option of options) {
      const value = parsedOptions[option.name.split(".")[0]];
      if (option.required) {
        const hasNegated = options.some((o) => o.negated && o.names.includes(option.name));
        if (value === true || value === false && !hasNegated) throw new CACError(`option \`${option.rawName}\` value is missing`);
      }
    }
  }
  /**
  * Check if the number of args is more than expected
  */
  checkUnusedArgs() {
    const maximumArgsCount = this.args.some((arg) => arg.variadic) ? Infinity : this.args.length;
    if (maximumArgsCount < this.cli.args.length) throw new CACError(`Unused args: ${this.cli.args.slice(maximumArgsCount).map((arg) => `\`${arg}\``).join(", ")}`);
  }
};
var GlobalCommand = class extends Command {
  constructor(cli2) {
    super("@@global@@", "", {}, cli2);
  }
};
var CAC = class extends EventTarget {
  /** The program name to display in help and version message */
  name;
  commands;
  globalCommand;
  matchedCommand;
  matchedCommandName;
  /**
  * Raw CLI arguments
  */
  rawArgs;
  /**
  * Parsed CLI arguments
  */
  args;
  /**
  * Parsed CLI options, camelCased
  */
  options;
  showHelpOnExit;
  showVersionOnExit;
  /**
  * @param name The program name to display in help and version message
  */
  constructor(name = "") {
    super();
    this.name = name;
    this.commands = [];
    this.rawArgs = [];
    this.args = [];
    this.options = {};
    this.globalCommand = new GlobalCommand(this);
    this.globalCommand.usage("<command> [options]");
  }
  /**
  * Add a global usage text.
  *
  * This is not used by sub-commands.
  */
  usage(text) {
    this.globalCommand.usage(text);
    return this;
  }
  /**
  * Add a sub-command
  */
  command(rawName, description, config) {
    const command = new Command(rawName, description || "", config, this);
    command.globalCommand = this.globalCommand;
    this.commands.push(command);
    return command;
  }
  /**
  * Add a global CLI option.
  *
  * Which is also applied to sub-commands.
  */
  option(rawName, description, config) {
    this.globalCommand.option(rawName, description, config);
    return this;
  }
  /**
  * Show help message when `-h, --help` flags appear.
  *
  */
  help(callback) {
    this.globalCommand.option("-h, --help", "Display this message");
    this.globalCommand.helpCallback = callback;
    this.showHelpOnExit = true;
    return this;
  }
  /**
  * Show version number when `-v, --version` flags appear.
  *
  */
  version(version, customFlags = "-v, --version") {
    this.globalCommand.version(version, customFlags);
    this.showVersionOnExit = true;
    return this;
  }
  /**
  * Add a global example.
  *
  * This example added here will not be used by sub-commands.
  */
  example(example) {
    this.globalCommand.example(example);
    return this;
  }
  /**
  * Output the corresponding help message
  * When a sub-command is matched, output the help message for the command
  * Otherwise output the global one.
  *
  */
  outputHelp() {
    if (this.matchedCommand) this.matchedCommand.outputHelp();
    else this.globalCommand.outputHelp();
  }
  /**
  * Output the version number.
  *
  */
  outputVersion() {
    this.globalCommand.outputVersion();
  }
  setParsedInfo({ args, options }, matchedCommand, matchedCommandName) {
    this.args = args;
    this.options = options;
    if (matchedCommand) this.matchedCommand = matchedCommand;
    if (matchedCommandName) this.matchedCommandName = matchedCommandName;
    return this;
  }
  unsetMatchedCommand() {
    this.matchedCommand = void 0;
    this.matchedCommandName = void 0;
  }
  /**
  * Parse argv
  */
  parse(argv, { run = true } = {}) {
    if (!argv) {
      if (!runtimeProcessArgs) throw new Error("No argv provided and runtime process argv is not available.");
      argv = runtimeProcessArgs;
    }
    this.rawArgs = argv;
    if (!this.name) this.name = argv[1] ? getFileName(argv[1]) : "cli";
    let shouldParse = true;
    for (const command of this.commands) {
      const parsed = this.mri(argv.slice(2), command);
      const commandName = parsed.args[0];
      if (command.isMatched(commandName)) {
        shouldParse = false;
        const parsedInfo = {
          ...parsed,
          args: parsed.args.slice(1)
        };
        this.setParsedInfo(parsedInfo, command, commandName);
        this.dispatchEvent(new CustomEvent(`command:${commandName}`, { detail: command }));
      }
    }
    if (shouldParse) {
      for (const command of this.commands) if (command.isDefaultCommand) {
        shouldParse = false;
        const parsed = this.mri(argv.slice(2), command);
        this.setParsedInfo(parsed, command);
        this.dispatchEvent(new CustomEvent("command:!", { detail: command }));
      }
    }
    if (shouldParse) {
      const parsed = this.mri(argv.slice(2));
      this.setParsedInfo(parsed);
    }
    if (this.options.help && this.showHelpOnExit) {
      this.outputHelp();
      run = false;
      this.unsetMatchedCommand();
    }
    if (this.options.version && this.showVersionOnExit && this.matchedCommandName == null) {
      this.outputVersion();
      run = false;
      this.unsetMatchedCommand();
    }
    const parsedArgv = {
      args: this.args,
      options: this.options
    };
    if (run) this.runMatchedCommand();
    if (!this.matchedCommand && this.args[0]) this.dispatchEvent(new CustomEvent("command:*", { detail: this.args[0] }));
    return parsedArgv;
  }
  mri(argv, command) {
    const cliOptions = [...this.globalCommand.options, ...command ? command.options : []];
    const mriOptions = getMriOptions(cliOptions);
    let argsAfterDoubleDashes = [];
    const doubleDashesIndex = argv.indexOf("--");
    if (doubleDashesIndex !== -1) {
      argsAfterDoubleDashes = argv.slice(doubleDashesIndex + 1);
      argv = argv.slice(0, doubleDashesIndex);
    }
    let parsed = lib_default(argv, mriOptions);
    parsed = Object.keys(parsed).reduce((res, name) => {
      return {
        ...res,
        [camelcaseOptionName(name)]: parsed[name]
      };
    }, { _: [] });
    const args = parsed._;
    const options = { "--": argsAfterDoubleDashes };
    const ignoreDefault = command && command.config.ignoreOptionDefaultValue ? command.config.ignoreOptionDefaultValue : this.globalCommand.config.ignoreOptionDefaultValue;
    const transforms = /* @__PURE__ */ Object.create(null);
    for (const cliOption of cliOptions) {
      if (!ignoreDefault && cliOption.config.default !== void 0) for (const name of cliOption.names) options[name] = cliOption.config.default;
      if (Array.isArray(cliOption.config.type) && transforms[cliOption.name] === void 0) {
        transforms[cliOption.name] = /* @__PURE__ */ Object.create(null);
        transforms[cliOption.name].shouldTransform = true;
        transforms[cliOption.name].transformFunction = cliOption.config.type[0];
      }
    }
    for (const key of Object.keys(parsed)) if (key !== "_") {
      setDotProp(options, key.split("."), parsed[key]);
      setByType(options, transforms);
    }
    return {
      args,
      options
    };
  }
  runMatchedCommand() {
    const { args, options, matchedCommand: command } = this;
    if (!command || !command.commandAction) return;
    command.checkUnknownOptions();
    command.checkOptionValue();
    command.checkRequiredArgs();
    command.checkUnusedArgs();
    const actionArgs = [];
    command.args.forEach((arg, index) => {
      if (arg.variadic) actionArgs.push(args.slice(index));
      else actionArgs.push(args[index]);
    });
    actionArgs.push(options);
    return command.commandAction.apply(this, actionArgs);
  }
};
var cac = (name = "") => new CAC(name);

// src/commands/install.ts
init_esm_shims();
import { resolve as resolve2 } from "path";

// src/categories.ts
init_esm_shims();
var CATEGORIES = [
  "frontend",
  "backend",
  "data",
  "business",
  "dev-tools",
  "workflow",
  "ecc-suite"
];
var CATEGORY_TITLES = {
  frontend: "\u{1F3A8} Frontend (UI \xB7 Design)",
  backend: "\u{1F5C4}\uFE0F  Backend (API \xB7 DB \xB7 Deploy)",
  data: "\u{1F4CA} Data",
  business: "\u{1F4BC} Business (Documents)",
  "dev-tools": "\u{1F6E1}\uFE0F  Dev Tools (Security \xB7 Quality)",
  workflow: "\u{1F504} Workflow (Development Cycle)",
  "ecc-suite": "\u{1F4E6} ECC Suite"
};

// src/cli-targets.ts
init_esm_shims();

// src/types.ts
init_esm_shims();
var TRACKS = [
  "tooling",
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "executive",
  "full",
  "project-management",
  "growth-marketing"
];
function isTrack(value) {
  return typeof value === "string" && TRACKS.includes(value);
}
var CLI_BASES = ["claude", "codex", "opencode", "antigravity"];
function isCliBase(value) {
  return typeof value === "string" && CLI_BASES.includes(value);
}
var INSTALL_SCOPES = ["project", "global"];
function isInstallScope(value) {
  return typeof value === "string" && INSTALL_SCOPES.includes(value);
}
function resolveScope(scope) {
  return scope ?? "project";
}
var DEFAULT_OPTIONS = {
  withTauri: false,
  withGsd: false,
  withEcc: false,
  withPrune: false,
  withTob: false,
  withCodexSkills: false,
  withCodexTrust: false,
  withKarpathyHook: false,
  withCodexPrompts: false,
  withAddyAgentSkills: false,
  withUzysHarness: false,
  withSuperpowers: false,
  withAntigravityGlobal: false
};

// src/cli-targets.ts
var CLI_BASE_SORT_ORDER = {
  claude: 0,
  codex: 1,
  opencode: 2,
  antigravity: 3
};
function parseCliTargets(input) {
  const items = normalizeInput(input);
  if (items.length === 0) {
    return { ok: true, targets: ["claude"], warnings: [] };
  }
  const collected = /* @__PURE__ */ new Set();
  const warnings = [];
  for (const item of items) {
    if (!isCliBase(item)) {
      let hint = "";
      if (item === "both") {
        hint = "\n         v0.8.0 removed 'both' alias. Use --cli claude --cli codex.";
      } else if (item === "all") {
        hint = "\n         v0.8.0 removed 'all' alias. Use --cli claude --cli codex --cli opencode.";
      } else if (item.includes(",")) {
        hint = "\n         Tip: comma-separated not supported. Use --cli A --cli B for multiple.";
      }
      return {
        ok: false,
        targets: ["claude"],
        warnings,
        error: `Invalid --cli value: ${item}. Must be one of: ${CLI_BASES.join(" | ")}${hint}`
      };
    }
    collected.add(item);
  }
  const targets = [...collected].sort((a, b2) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b2]);
  return { ok: true, targets, warnings };
}
function normalizeInput(input) {
  if (input === void 0 || input === null) return [];
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed === "" ? [] : [trimmed];
  }
  return input.filter((s) => typeof s === "string" && s.trim() !== "").map((s) => s.trim());
}
function targetsInclude(targets, base) {
  return targets.includes(base);
}

// src/design.ts
init_esm_shims();
var isColorEnabled = (() => {
  if (process.env.NO_COLOR && process.env.NO_COLOR !== "") {
    return false;
  }
  return Boolean(process.stdout?.isTTY);
})();
function wrap(open, close) {
  return (s) => {
    if (!isColorEnabled) {
      return s;
    }
    return `\x1B[${open}m${s}\x1B[${close}m`;
  };
}
var c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39)
};
var symbol = {
  success: "\u2713",
  failure: "\u2717",
  skip: "\u2298",
  arrow: "\u203A",
  pointer: "\u25B8",
  bullet: "\u2022",
  warn: "\u26A0",
  /** Heavy horizontal box-drawing — phase dividers. */
  rule: "\u2501",
  /** Middle dot — section separator. */
  mid: "\xB7"
};
var DEFAULT_WIDTH = 78;
function unifiedSection(title, width = DEFAULT_WIDTH) {
  const label = `${symbol.rule}${symbol.rule} ${title} `;
  const fill = symbol.rule.repeat(Math.max(0, width - visibleLength(label)));
  return c.bold(c.cyan(`${label}${fill}`));
}
function sectionHeader(title, width = DEFAULT_WIDTH) {
  const label = `${symbol.rule}${symbol.rule}${symbol.rule} ${title} `;
  const fill = symbol.rule.repeat(Math.max(0, width - visibleLength(label)));
  return c.bold(c.cyan(`${label}${fill}`));
}
function infoRow(key, value, width = 12) {
  const label = `${symbol.pointer} ${key}`.padEnd(width + 2, " ");
  return `  ${c.dim(label)} ${value}`;
}
function assetRow(kind, label, meta = "", labelWidth = 40) {
  const sym = renderSymbol(kind);
  const labelPadded = label.padEnd(labelWidth, " ");
  const metaText = meta ? c.dim(meta) : "";
  return `  ${sym} ${labelPadded} ${metaText}`.trimEnd();
}
function renderSymbol(kind) {
  switch (kind) {
    case "success":
      return c.green(symbol.success);
    case "skip":
      return c.yellow(symbol.skip);
    case "failure":
      return c.red(symbol.failure);
  }
}
var status = {
  success: (msg) => `${c.green(symbol.success)} ${msg}`,
  failure: (msg) => `${c.red(symbol.failure)} ${msg}`,
  warn: (msg) => `${c.yellow(symbol.warn)} ${msg}`,
  info: (msg) => `${c.cyan(symbol.bullet)} ${msg}`
};
function visibleLength(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
function padDisplay(s, width) {
  const visible = visibleLength(s);
  return visible >= width ? s : s + " ".repeat(width - visible);
}

// src/external-assets.ts
init_esm_shims();

// src/track-match.ts
init_esm_shims();
function matchTrack(track, pattern) {
  return pattern.split("|").some((p2) => globToRegex(p2.trim()).test(track));
}
function anyTrack(tracks, pattern) {
  return tracks.some((t) => matchTrack(t, pattern));
}
function hasDevTrack(tracks) {
  return anyTrack(tracks, "csr-*|ssr-*|data|full|tooling");
}
function hasUiTrack(tracks) {
  return anyTrack(tracks, "csr-*|ssr-*|full");
}
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

// src/external-assets.ts
var TRUST_TIER = {
  // T1 Official — Anthropic 공식 + 하네스 자체
  "anthropic-data-plugin": "official",
  // anthropics/knowledge-work-plugins 18k
  "anthropic-document-skills": "official",
  // anthropics/skills 144k
  superpowers: "official",
  // anthropics/claude-plugins-official 공식 배포 (소스 obra 213k)
  "ecc-prune": "official",
  // uzys 본 하네스 자체
  // T3 Experimental — star < 1000 (2026-05)
  "next-skills": "experimental",
  // vercel-labs/next-skills 895
  "railway-skills": "experimental",
  // railwayapp/railway-skills 268
  "playwright-skill": "experimental",
  // testdino-hq/playwright-skill 264
  "architecture-decision-record": "experimental",
  // yonatangross/orchestkit 179
  // T2 Vetted — star ≥ 1000 + 활성 (2026-05)
  "polars-K-Dense": "vetted",
  // K-Dense-AI 26k
  "dask-K-Dense": "vetted",
  // K-Dense-AI 26k
  "python-resource-management": "vetted",
  // wshobson/agents 36k
  "python-performance-optimization": "vetted",
  // wshobson/agents 36k
  "addy-agent-skills": "vetted",
  // addyosmani 47k
  "vercel-cli": "vetted",
  // vercel/vercel 15k
  "netlify-cli": "vetted",
  // netlify/cli 1.9k
  "supabase-cli": "vetted",
  // supabase 103k
  impeccable: "vetted",
  // pbakaus 31k
  "find-skills": "vetted",
  // vercel-labs/skills 20k (license none — 출처 신뢰)
  "agent-browser": "vetted",
  // vercel-labs/agent-browser 34k
  "supabase-agent-skills": "vetted",
  // supabase/agent-skills 2.2k
  "postgres-best-practices": "vetted",
  // supabase/agent-skills 2.2k
  "react-best-practices": "vetted",
  // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
  "shadcn-ui": "vetted",
  // shadcn-ui/ui 115k
  "web-design-guidelines": "vetted",
  // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
  "c-level-skills": "vetted",
  // alirezarezvani 16k
  "business-growth-skills": "vetted",
  // alirezarezvani 16k
  "finance-skills": "vetted",
  // alirezarezvani 16k
  "pm-skills": "vetted",
  // alirezarezvani 16k
  "product-skills": "vetted",
  // alirezarezvani 16k
  "marketing-skills": "vetted",
  // alirezarezvani 16k
  "content-creator": "vetted",
  // alirezarezvani 16k
  "demand-gen": "vetted",
  // alirezarezvani 16k
  "research-summarizer": "vetted",
  // alirezarezvani 16k
  "karpathy-coder": "vetted",
  // alirezarezvani 16k
  "gsd-orchestrator": "vetted",
  // gsd-build/get-shit-done 63k
  "trailofbits-skills": "vetted",
  // trailofbits/skills 5.5k (CC-BY-SA — 출처 신뢰)
  "ecc-plugin": "vetted"
  // affaan-m/everything-claude-code 199k
};
function assetTrustTier(assetId) {
  return TRUST_TIER[assetId] ?? "experimental";
}
var ALL_CSR_SSR_FULL = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "full"
];
var CSR_SSR_NEXTJS_FULL = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-nextjs",
  "full"
];
var RAILWAY_TRACKS = ["csr-fastify", "csr-fastapi", "ssr-htmx", "ssr-nextjs", "full"];
var DEV_TRACKS = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "tooling",
  "full"
];
var DEV_PLUS_PM_TRACKS = [...DEV_TRACKS, "project-management"];
var EXTERNAL_ASSETS = [
  // === data Track ===
  {
    id: "polars-K-Dense",
    description: "Polars \u2014 fast Rust-based DataFrame (pandas alternative, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "polars" }
    // v26.56.0 — description 보강: 트랙 hint + 한 줄 의미
  },
  {
    id: "dask-K-Dense",
    description: "Dask \u2014 distributed processing (large DataFrames \xB7 cluster, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "dask" }
  },
  {
    id: "python-resource-management",
    description: "Python memory \xB7 CPU management patterns (wshobson, data track)",
    category: "data",
    source: "wshobson",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-resource-management"
    }
  },
  {
    id: "python-performance-optimization",
    description: "Python performance optimization (profiling \xB7 vectorize, wshobson, data track)",
    category: "data",
    source: "wshobson",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-performance-optimization"
    }
  },
  {
    id: "anthropic-data-plugin",
    description: "Anthropic data plugin (visualization, SQL exploration)",
    category: "data",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/knowledge-work-plugins",
      pluginId: "data@knowledge-work-plugins"
    }
  },
  // === Option-gated (v26.42.0 — opt-in, BREAKING vs prior has-dev-track auto-install) ===
  {
    id: "addy-agent-skills",
    description: "addy agent-skills (general dev)",
    category: "workflow",
    source: "addyosmani",
    condition: { kind: "option", flag: "withAddyAgentSkills" },
    method: {
      kind: "plugin",
      marketplace: "addyosmani/agent-skills",
      pluginId: "agent-skills@addy-agent-skills"
    }
  },
  {
    id: "superpowers",
    // 저자 = obra (190k★ github.com/obra/superpowers). 호스팅 = Anthropic 공식
    // marketplace github.com/anthropics/claude-plugins-official ("Official,
    // Anthropic-managed directory of high quality Claude Code Plugins").
    // source/marketplace 분리는 의도적 — source=저자, marketplace=registry.
    description: "Superpowers \u2014 agentic skills framework (obra, Anthropic official marketplace)",
    category: "workflow",
    source: "obra",
    condition: { kind: "option", flag: "withSuperpowers" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "superpowers@claude-plugins-official"
    }
  },
  // === Railway (csr-fastify|csr-fastapi|ssr-*|full) ===
  // v0.6.3 — railway-plugin entry 제거. railwayapp/railway-plugin repo 자체 존재 안 함
  // (404 Not Found). 공식 docs (https://docs.railway.com/ai/claude-code-plugin) 형식은
  // marketplace add `railwayapp/railway-skills` + plugin install `railway@railway-skills`만.
  // → 아래 railway-skills entry로 단일화.
  {
    id: "railway-skills",
    description: "Railway agent-skills (deploy + project/service/env management)",
    category: "backend",
    source: "railwayapp",
    condition: { kind: "any-track", tracks: RAILWAY_TRACKS },
    method: {
      kind: "plugin",
      marketplace: "railwayapp/railway-skills",
      pluginId: "railway@railway-skills"
    }
  },
  // === csr-supabase|full CLI ===
  {
    id: "vercel-cli",
    description: "Vercel CLI (npm -g)",
    category: "backend",
    source: "vercel",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "vercel" }
  },
  {
    id: "netlify-cli",
    description: "Netlify CLI (npm -g)",
    category: "backend",
    source: "netlify",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "netlify-cli" }
  },
  {
    id: "supabase-cli",
    description: "Supabase CLI (npm -g) \u2014 first 'supabase login' requires OAuth",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "supabase" }
  },
  // === UI tracks (csr-*|ssr-*|full) ===
  {
    id: "impeccable",
    description: "Impeccable \u2014 UI design guide + visual consistency review (pbakaus, single-skill repo)",
    category: "frontend",
    source: "pbakaus",
    condition: { kind: "any-track", tracks: ALL_CSR_SSR_FULL },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수 (single-skill repo 도)
    method: { kind: "skill", source: "pbakaus/impeccable", skill: "impeccable" }
  },
  // === dev tools (has_dev_track) ===
  {
    id: "playwright-skill",
    description: "Playwright \u2014 browser automation E2E test authoring guide (testdino-hq)",
    category: "dev-tools",
    source: "testdino-hq",
    condition: { kind: "has-dev-track" },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수
    method: {
      kind: "skill",
      source: "testdino-hq/playwright-skill",
      skill: "playwright-skill"
    }
  },
  {
    id: "find-skills",
    description: "find-skills \u2014 search \xB7 rank all installed skills (vercel-labs, all dev tracks)",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "vercel-labs/skills", skill: "find-skills" }
  },
  {
    id: "agent-browser",
    description: "agent-browser \u2014 agent-friendly Playwright wrapper (screenshot \xB7 DOM search CLI, dev tracks)",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "npm", pkg: "agent-browser" }
  },
  {
    id: "architecture-decision-record",
    description: "ADR \u2014 Architecture Decision Record template + status flow (orchestkit, one of 80+ skills)",
    category: "dev-tools",
    source: "yonatangross",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "skill",
      source: "yonatangross/orchestkit",
      skill: "architecture-decision-record"
    }
  },
  // === Supabase agent-skills (csr-supabase|full) ===
  {
    id: "supabase-agent-skills",
    description: "Supabase \u2014 RLS \xB7 auth \xB7 edge function \xB7 realtime guide (csr-supabase \xB7 full tracks)",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "supabase@supabase-agent-skills"
    }
  },
  {
    id: "postgres-best-practices",
    description: "Postgres best practices \u2014 schema \xB7 index \xB7 query patterns (csr-supabase \xB7 full tracks)",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "postgres-best-practices@supabase-agent-skills"
    }
  },
  // === React + Next UI tracks ===
  // v0.6.3 — vercel-labs/agent-skills source는 short form 안 됨. full HTTPS URL 필요.
  // 사용자 확인 형식: `npx skills add https://github.com/vercel-labs/agent-skills --skill <name>`.
  {
    id: "react-best-practices",
    description: "React best practices \u2014 Vercel's hook \xB7 perf \xB7 component patterns (CSR \xB7 SSR \xB7 Next tracks)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      // v0.6.5 — skills.sh registry name. GitHub dir 이름(react-best-practices)과 다름.
      // skills.sh: 대부분 vercel- prefix (web-design-guidelines, deploy-to-vercel만 예외).
      skill: "vercel-react-best-practices"
    }
  },
  {
    id: "shadcn-ui",
    description: "shadcn/ui \u2014 Radix-based React component copy + Tailwind theme (shadcn official)",
    category: "frontend",
    source: "shadcn-ui",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    // v26.54.1 — shadcn/ui repo 의 실제 skill 이름은 `shadcn` (자산 id 와 다름).
    method: { kind: "skill", source: "shadcn/ui", skill: "shadcn" }
  },
  {
    id: "web-design-guidelines",
    description: "Web design guidelines \u2014 Vercel's visual hierarchy \xB7 color \xB7 spacing (CSR \xB7 SSR \xB7 Next tracks)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      skill: "web-design-guidelines"
    }
  },
  {
    id: "next-skills",
    description: "Next-skills \u2014 Next.js App Router \xB7 Server Action patterns (ssr-nextjs \xB7 full tracks)",
    category: "backend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: ["ssr-nextjs", "full"] },
    method: { kind: "skill", source: "vercel-labs/next-skills" }
  },
  // === Executive tracks ===
  {
    id: "anthropic-document-skills",
    description: "Anthropic document-skills (pptx/docx/xlsx/pdf)",
    category: "business",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/skills",
      pluginId: "document-skills@anthropic-agent-skills"
    }
  },
  // alirezarezvani/claude-skills marketplace (v2.3.0) — 2026-04-25 통합 갱신.
  // 기존 alirezarezvani/c-level-skills + alirezarezvani/finance-skills 별도 marketplace
  // → 통합된 alirezarezvani/claude-skills marketplace (claude-code-skills 이름)로 이동.
  {
    id: "c-level-skills",
    description: "c-level-skills (claude-code-skills, 28 advisory)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "c-level-skills@claude-code-skills"
    }
  },
  {
    id: "business-growth-skills",
    description: "business-growth-skills (4 \u2014 customer success, sales eng, revops, contract)",
    category: "business",
    source: "alirezarezvani",
    // v0.5.0 — growth-marketing Track에서도 재사용. 합집합 조건.
    condition: { kind: "any-track", tracks: ["executive", "full", "growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "business-growth-skills@claude-code-skills"
    }
  },
  {
    id: "finance-skills",
    description: "finance-skills (3 \u2014 financial analyst, SaaS metrics, investment advisor)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "finance-skills@claude-code-skills"
    }
  },
  // === Project Management Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — pm-skills 4/4.
  {
    id: "pm-skills",
    description: "pm-skills (6 \u2014 senior PM, scrum master, Jira/Confluence/Atlassian admin, template creator)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["project-management"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "pm-skills@claude-code-skills"
    }
  },
  // SPEC §3.5 — product-skills: has-dev-track + project-management 합집합 (executive/growth-marketing 제외).
  // v0.8.1 — DEV_PLUS_PM_TRACKS 상수로 SSOT 통일 (reviewer MEDIUM-3 fix).
  {
    id: "product-skills",
    description: "product-skills (15 \u2014 RICE, PRD, agile PO, UX research, SaaS scaffolder ...)",
    category: "dev-tools",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: [...DEV_PLUS_PM_TRACKS] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "product-skills@claude-code-skills"
    }
  },
  // === Growth Marketing Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — 4 entries 모두 4/4.
  {
    id: "marketing-skills",
    description: "marketing-skills (44 \u2014 content/SEO/CRO/channels/growth/intelligence/sales/twitter)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "marketing-skills@claude-code-skills"
    }
  },
  {
    id: "content-creator",
    description: "content-creator (SEO content + brand voice + frameworks)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "content-creator@claude-code-skills"
    }
  },
  {
    id: "demand-gen",
    description: "demand-gen (multi-channel demand gen + paid media + partnership)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "demand-gen@claude-code-skills"
    }
  },
  {
    id: "research-summarizer",
    description: "research-summarizer (market research summarization)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "research-summarizer@claude-code-skills"
    }
  },
  // === Code-quality enforcement (has-dev-track, v0.5.0) ===
  // SPEC §3.5 — karpathy-coder 4/4. CLAUDE.md P1-P4 선언적 원칙의 검출 도구 layer.
  // 4 Python tools (stdlib only) + reviewer agent + /karpathy-check + pre-commit hook.
  {
    id: "karpathy-coder",
    description: "karpathy-coder (4 Python tool + reviewer agent + /karpathy-check + pre-commit hook)",
    category: "dev-tools",
    source: "alirezarezvani",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "karpathy-coder@claude-code-skills"
    }
  },
  // === Option-gated ===
  {
    id: "gsd-orchestrator",
    description: "GSD orchestrator (npx get-shit-done-cc@latest)",
    category: "workflow",
    source: "get-shit-done-cc",
    condition: { kind: "option", flag: "withGsd" },
    method: { kind: "npx-run", cmd: "get-shit-done-cc@latest" }
  },
  {
    // v26.39.2 fix — marketplace name = "trailofbits" (NOT "trailofbits-skills") +
    // "trailofbits-skills" plugin 자체가 존재하지 않음. marketplace 안에 14+ 개별 plugin.
    // 단일 대표 plugin = `differential-review` (코드 변경 보안 리뷰, 가장 보편).
    // 추가 plugin 원하는 사용자는: `claude plugin install <name>@trailofbits` (예: audit-context-building)
    id: "trailofbits-skills",
    description: "Trail of Bits differential-review plugin (security-focused code review)",
    category: "dev-tools",
    source: "trailofbits",
    condition: { kind: "option", flag: "withTob" },
    method: {
      kind: "plugin",
      marketplace: "trailofbits/skills",
      pluginId: "differential-review@trailofbits"
    }
  },
  {
    id: "ecc-plugin",
    description: "ECC \u2014 60 agents \xB7 230 skills \xB7 75 commands. Affaan's hackathon package",
    category: "ecc-suite",
    source: "affaan-m",
    condition: { kind: "option", flag: "withEcc" },
    // v26.54.1 — upstream marketplace.json 의 name 은 "ecc" (plugin name 도 "ecc").
    // 기존 매핑 `everything-claude-code@everything-claude-code` 는 marketplace 가
    // 그 이름으로 등록되던 옛 버전 기준. fresh install 에서는 "Plugin not found" 발생.
    method: {
      kind: "plugin",
      marketplace: "affaan-m/everything-claude-code",
      pluginId: "ecc@ecc"
    }
  },
  {
    id: "ecc-prune",
    description: "ECC prune (drop items beyond curated 89 KEEP \u2192 copy to .claude/local-plugins/ecc/)",
    category: "ecc-suite",
    source: "uzys",
    condition: { kind: "option", flag: "withPrune" },
    method: {
      kind: "shell-script",
      script: "scripts/prune-ecc.sh",
      args: ["--apply", "--force"]
    }
  }
];
function shouldInstallAsset(asset, ctx) {
  if (ctx.userOverride?.forceExclude.includes(asset.id)) return false;
  if (ctx.userOverride?.forceInclude.includes(asset.id)) return true;
  if (TRUST_TIER[asset.id] === "experimental") return false;
  return matchesCondition(asset, ctx);
}
function matchesCondition(asset, ctx) {
  const cond = asset.condition;
  switch (cond.kind) {
    case "any-track":
      return ctx.tracks.some((t) => cond.tracks.includes(t));
    case "has-dev-track":
      return hasDevTrack(ctx.tracks);
    case "option":
      return ctx.options[cond.flag] === true;
  }
}
function experimentalOptInCandidates(ctx) {
  return EXTERNAL_ASSETS.filter(
    (a) => TRUST_TIER[a.id] === "experimental" && !ctx.userOverride?.forceInclude.includes(a.id) && matchesCondition(a, ctx)
  );
}
function filterApplicableAssets(assets, ctx) {
  return assets.filter((a) => shouldInstallAsset(a, ctx));
}

// src/installer.ts
init_esm_shims();
import {
  chmodSync as chmodSync2,
  existsSync as existsSync14,
  mkdirSync as mkdirSync6,
  readdirSync as readdirSync4,
  readFileSync as readFileSync13,
  writeFileSync as writeFileSync11
} from "fs";
import { dirname as dirname4, join as join12, resolve } from "path";

// src/antigravity/opt-in.ts
init_esm_shims();
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// src/codex/agents-md.ts
init_esm_shims();
function renameSlashes(text) {
  return text.replaceAll("/uzys:", "/uzys-");
}
function renderAgentsMd(params) {
  const body = params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
  const replaced = params.template.replaceAll("{PROJECT_NAME}", params.projectName).replaceAll("{PROJECT_RULES}", body);
  return renameSlashes(replaced);
}

// src/antigravity/opt-in.ts
var PHASES = ["spec", "plan", "build", "test", "review", "ship"];
function runAntigravityOptIn(ctx) {
  const geminiHome = ctx.geminiHome ?? join(homedir(), ".gemini");
  const skillsTarget = join(geminiHome, "antigravity", "skills");
  const workflowsTarget = join(geminiHome, "antigravity", "global_workflows");
  if (!ctx.enabled) {
    return {
      skillsInstalled: { enabled: false, count: 0, targetDir: skillsTarget },
      workflowsInstalled: { enabled: false, count: 0, targetDir: workflowsTarget }
    };
  }
  let skillsCount = 0;
  for (const phase of PHASES) {
    const src = join(ctx.projectDir, ".agents", "skills", `uzys-${phase}`);
    if (!existsSync(src)) continue;
    const dst = join(skillsTarget, `uzys-${phase}`);
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    skillsCount++;
  }
  let workflowsCount = 0;
  if (ctx.harnessRoot) {
    mkdirSync(workflowsTarget, { recursive: true });
    for (const phase of PHASES) {
      const src = join(ctx.harnessRoot, "templates/commands/uzys", `${phase}.md`);
      if (!existsSync(src)) continue;
      const body = renameSlashes(readFileSync(src, "utf8"));
      const dst = join(workflowsTarget, `uzys-${phase}.md`);
      writeFileSync(dst, body);
      workflowsCount++;
    }
  }
  return {
    skillsInstalled: { enabled: true, count: skillsCount, targetDir: skillsTarget },
    workflowsInstalled: { enabled: true, count: workflowsCount, targetDir: workflowsTarget }
  };
}

// src/antigravity/transform.ts
init_esm_shims();
import { existsSync as existsSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { basename, join as join3 } from "path";

// src/codex/skills.ts
init_esm_shims();
function renderSkill(params) {
  const { description, body } = parseSource(params.source);
  const finalDescription = description || `uzys-${params.phase} phase skill (Codex \uD3EC\uD305)`;
  const escapedDesc = finalDescription.replace(/"/g, '\\"');
  const renamedBody = renameSlashes(body).trimEnd();
  return [
    "---",
    `name: uzys-${params.phase}`,
    `description: "${escapedDesc}"`,
    "---",
    "",
    renamedBody,
    ""
  ].join("\n");
}
function parseSource(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] === "---") {
    let descMatch = "";
    let secondDelimAt = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line === "---") {
        secondDelimAt = i;
        break;
      }
      const match = line.match(/^description:\s*(.*)$/);
      if (match) {
        descMatch = stripQuotes(match[1] ?? "");
      }
    }
    const body2 = secondDelimAt >= 0 ? lines.slice(secondDelimAt + 1).join("\n") : source;
    return { description: descMatch, body: body2.replace(/^\n+/, "") };
  }
  const firstLine = lines[0] ?? "";
  const body = lines.slice(1).join("\n");
  return { description: firstLine.trim(), body };
}
function stripQuotes(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// src/fs-ops.ts
init_esm_shims();
import { copyFileSync, cpSync as cpSync2, existsSync as existsSync2, mkdirSync as mkdirSync2, renameSync } from "fs";
import { dirname, join as join2 } from "path";
function ensureDir(path2) {
  mkdirSync2(path2, { recursive: true });
}
function copyFile(source, target) {
  if (!existsSync2(source)) {
    throw new Error(`Source not found: ${source}`);
  }
  mkdirSync2(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
function copyDir(source, target) {
  if (!existsSync2(source)) {
    throw new Error(`Source dir not found: ${source}`);
  }
  mkdirSync2(target, { recursive: true });
  cpSync2(source, target, { recursive: true, force: true });
}
function backupDir(target, now = /* @__PURE__ */ new Date()) {
  if (!existsSync2(target)) {
    return null;
  }
  const backup = `${target}.backup-${formatStamp(now)}`;
  renameSync(target, backup);
  return backup;
}
function copyBackupDir(target, now = /* @__PURE__ */ new Date()) {
  if (!existsSync2(target)) {
    return null;
  }
  const backup = `${target}.backup-${formatStamp(now)}`;
  cpSync2(target, backup, { recursive: true });
  return backup;
}
function formatStamp(now) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").slice(0, 15);
}
function ensureProjectSkeleton(projectDir) {
  const dirs = [
    ".claude/commands/uzys",
    ".claude/commands/ecc",
    ".claude/rules",
    ".claude/skills",
    ".claude/agents",
    ".claude/hooks",
    "docs/decisions"
  ];
  for (const d2 of dirs) {
    mkdirSync2(join2(projectDir, d2), { recursive: true });
  }
}

// src/antigravity/transform.ts
var PHASES2 = ["spec", "plan", "build", "test", "review", "ship"];
function runAntigravityTransform(params) {
  const { harnessRoot, projectDir, withUzysHarness } = params;
  const rulesFile = writeRules(harnessRoot, projectDir);
  const skillFiles = [];
  const workflowFiles = [];
  if (withUzysHarness) {
    for (const phase of PHASES2) {
      const skillDir = join3(projectDir, ".agents", "skills", `uzys-${phase}`);
      ensureDir(skillDir);
      const cmdSrc = join3(harnessRoot, "templates/commands/uzys", `${phase}.md`);
      let source = "";
      if (existsSync3(cmdSrc)) {
        source = readFileSync2(cmdSrc, "utf8");
      } else {
        const fallback = join3(harnessRoot, "templates/codex/skills", `uzys-${phase}/SKILL.md`);
        if (existsSync3(fallback)) {
          source = readFileSync2(fallback, "utf8");
        }
      }
      const skillTarget = join3(skillDir, "SKILL.md");
      writeFileSync2(skillTarget, renderSkill({ source, phase }));
      skillFiles.push(skillTarget);
      if (source) {
        const workflowDir = join3(projectDir, ".agents", "workflows");
        ensureDir(workflowDir);
        const workflowTarget = join3(workflowDir, `uzys-${phase}.md`);
        writeFileSync2(workflowTarget, renameSlashes(source));
        workflowFiles.push(workflowTarget);
      }
    }
  }
  return { rulesFile, skillFiles, workflowFiles };
}
function writeRules(harnessRoot, projectDir) {
  const claudeMdPath = join3(harnessRoot, "templates/CLAUDE.md");
  const templatePath = join3(harnessRoot, "templates/antigravity/AGENTS.md.template");
  if (!existsSync3(claudeMdPath) || !existsSync3(templatePath)) {
    return null;
  }
  const claudeMd = readFileSync2(claudeMdPath, "utf8");
  const template = readFileSync2(templatePath, "utf8");
  const rulesDir = join3(projectDir, ".agents", "rules");
  ensureDir(rulesDir);
  const target = join3(rulesDir, "uzys-harness.md");
  writeFileSync2(target, renderAgentsMd({ template, claudeMd, projectName: basename(projectDir) }));
  return target;
}

// src/codex/opt-in.ts
init_esm_shims();
import { cpSync as cpSync3, existsSync as existsSync5, mkdirSync as mkdirSync4, readdirSync, readFileSync as readFileSync4, writeFileSync as writeFileSync4 } from "fs";
import { homedir as homedir2 } from "os";
import { join as join4 } from "path";

// src/codex/prompts.ts
init_esm_shims();
function renderCodexPrompt(params) {
  const { description, body } = parseSource2(params.source);
  const finalDescription = description || `uzys-${params.phase} phase`;
  const escapedDesc = finalDescription.replace(/"/g, '\\"');
  const renamedBody = renameSlashes(body).trimEnd();
  return ["---", `description: "${escapedDesc}"`, "---", "", renamedBody, ""].join("\n");
}
function parseSource2(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] === "---") {
    let descMatch = "";
    let secondDelimAt = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line === "---") {
        secondDelimAt = i;
        break;
      }
      const m = line.match(/^description:\s*"?(.+?)"?\s*$/);
      if (m?.[1]) descMatch = m[1];
    }
    if (secondDelimAt >= 0) {
      return {
        description: descMatch,
        body: lines.slice(secondDelimAt + 1).join("\n").replace(/^\n+/, "")
      };
    }
    return {
      description: "",
      body: lines.slice(1).join("\n")
    };
  }
  const firstLine = lines[0] ?? "";
  const description = firstLine.replace(/^#+\s*/, "").slice(0, 200);
  const body = lines.slice(1).join("\n").replace(/^\n+/, "");
  return { description, body };
}
var CODEX_PROMPT_PHASES = ["spec", "plan", "build", "test", "review", "ship"];

// src/codex/trust-entry.ts
init_esm_shims();
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { dirname as dirname2 } from "path";
var TRUST_BLOCK_REGEX = /\[projects\."([^"]+)"\]/g;
function registerTrustEntry(opts) {
  const { configPath, projectDir } = opts;
  try {
    mkdirSync3(dirname2(configPath), { recursive: true });
    const existing = existsSync4(configPath) ? readFileSync3(configPath, "utf8") : "";
    if (hasTrustEntry(existing, projectDir)) {
      return { status: "already-present" };
    }
    const block = `
[projects."${projectDir}"]
trust_level = "trusted"
`;
    writeFileSync3(configPath, existing + block);
    return { status: "registered" };
  } catch (e2) {
    return {
      status: "error",
      message: e2 instanceof Error ? e2.message : String(e2)
    };
  }
}
function hasTrustEntry(configContent, projectDir) {
  const matches = [...configContent.matchAll(TRUST_BLOCK_REGEX)].map((m) => m[1]);
  return matches.includes(projectDir);
}

// src/codex/opt-in.ts
var PHASES3 = ["spec", "plan", "build", "test", "review", "ship"];
function runCodexOptIn(ctx) {
  const codexHome = ctx.codexHome ?? join4(homedir2(), ".codex");
  const skillsTarget = join4(codexHome, "skills");
  const promptsTarget = join4(codexHome, "prompts");
  const configPath = join4(codexHome, "config.toml");
  let skillsCount = 0;
  if (ctx.withCodexSkills) {
    skillsCount = copyCodexSkills(ctx.projectDir, skillsTarget);
  }
  let trustResult = {
    enabled: false,
    status: "registered"
  };
  if (ctx.withCodexTrust) {
    const result = registerTrustEntry({
      configPath,
      projectDir: ctx.projectDir
    });
    trustResult = { enabled: true, ...result };
  }
  let promptsCount = 0;
  if (ctx.withCodexPrompts) {
    promptsCount = copyCodexPrompts(ctx.harnessRoot, ctx.projectDir, promptsTarget);
  }
  return {
    skillsInstalled: {
      enabled: ctx.withCodexSkills,
      count: skillsCount,
      targetDir: skillsTarget
    },
    trustEntry: {
      enabled: ctx.withCodexTrust,
      status: trustResult.enabled ? trustResult.status : "skipped",
      ...trustResult.message ? { message: trustResult.message } : {}
    },
    promptsInstalled: {
      enabled: ctx.withCodexPrompts,
      count: promptsCount,
      targetDir: promptsTarget
    }
  };
}
function copyCodexPrompts(harnessRoot, projectDir, promptsTarget) {
  const candidates = [];
  if (harnessRoot) {
    candidates.push(join4(harnessRoot, "templates/commands/uzys"));
  }
  candidates.push(join4(projectDir, ".claude/commands/uzys"));
  const sourceDir = candidates.find((p2) => existsSync5(p2));
  if (!sourceDir) return 0;
  mkdirSync4(promptsTarget, { recursive: true });
  let count = 0;
  for (const phase of CODEX_PROMPT_PHASES) {
    const src = join4(sourceDir, `${phase}.md`);
    if (!existsSync5(src)) continue;
    const source = readFileSync4(src, "utf8");
    const dst = join4(promptsTarget, `uzys-${phase}.md`);
    writeFileSync4(dst, renderCodexPrompt({ source, phase }));
    count++;
  }
  return count;
}
function copyCodexSkills(projectDir, skillsTarget) {
  const sourceDir = join4(projectDir, ".agents", "skills");
  if (!existsSync5(sourceDir)) {
    return 0;
  }
  mkdirSync4(skillsTarget, { recursive: true });
  let count = 0;
  for (const phase of PHASES3) {
    const src = join4(sourceDir, `uzys-${phase}`);
    if (!existsSync5(src)) continue;
    const dest = join4(skillsTarget, `uzys-${phase}`);
    cpSync3(src, dest, { recursive: true });
    count++;
  }
  try {
    for (const entry of readdirSync(sourceDir)) {
      if (!entry.startsWith("uzys-")) continue;
      const phase = entry.slice("uzys-".length);
      if (PHASES3.includes(phase)) continue;
      cpSync3(join4(sourceDir, entry), join4(skillsTarget, entry), { recursive: true });
      count++;
    }
  } catch {
  }
  return count;
}

// src/codex/transform.ts
init_esm_shims();
import { chmodSync, existsSync as existsSync6, readFileSync as readFileSync5, writeFileSync as writeFileSync5 } from "fs";
import { basename as basename2, join as join5 } from "path";

// src/codex/config-toml.ts
init_esm_shims();
var DEFAULT_MCP_BLOCK_RE = /\n# =+\n# MCP Servers — .*?\n# =+[\s\S]*$/;
function renderConfigToml(params) {
  const substituted = params.template.replaceAll("{PROJECT_NAME}", params.projectName).replaceAll("{PROJECT_DIR}", params.projectDir).replaceAll("{GITHUB_TOKEN}", "${GITHUB_TOKEN}");
  if (!params.mcp) {
    return substituted;
  }
  const stripped = stripExistingMcpSection(substituted);
  const fresh = renderMcpServers(params.mcp);
  return `${stripped.trimEnd()}
${fresh}
`;
}
function stripExistingMcpSection(toml) {
  const lines = toml.split(/\r?\n/);
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (line.startsWith("[mcp_servers.")) {
      skipping = true;
      continue;
    }
    if (skipping && line.startsWith("[") && !line.startsWith("[mcp_servers.")) {
      skipping = false;
    }
    if (skipping) {
      continue;
    }
    if (/^# .*MCP Servers/.test(line) || /^# Railway MCP/.test(line) || /^# github MCP/.test(line)) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(DEFAULT_MCP_BLOCK_RE, "");
}
function renderMcpServers(mcp) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const header = [
    "# ============================================================",
    `# MCP Servers \u2014 generated from .mcp.json (${stamp})`,
    "# ============================================================"
  ].join("\n");
  const blocks = Object.entries(mcp.mcpServers).map(([name, cfg]) => {
    const lines = [`[mcp_servers.${quoteIfNeeded(name)}]`];
    lines.push(`command = ${jsonString(cfg.command)}`);
    lines.push(`args = ${JSON.stringify(cfg.args)}`);
    if (cfg.env && Object.keys(cfg.env).length > 0) {
      const envBody = Object.entries(cfg.env).map(([k2, v2]) => `${k2} = ${jsonString(v2)}`).join(", ");
      lines.push(`env = { ${envBody} }`);
    }
    return lines.join("\n");
  });
  return [header, "", ...blocks].join("\n");
}
function jsonString(s) {
  return JSON.stringify(s);
}
function quoteIfNeeded(name) {
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : `"${name}"`;
}

// src/codex/transform.ts
var PHASES4 = ["spec", "plan", "build", "test", "review", "ship"];
var HOOK_NAMES = ["session-start", "hito-counter", "gate-check"];
var ENV_VAR_RENAME = /CLAUDE_PROJECT_DIR/g;
function runCodexTransform(params) {
  const { harnessRoot, projectDir, withUzysHarness = false } = params;
  const claudeMd = readRequired(join5(harnessRoot, "templates/CLAUDE.md"));
  const agentsTemplate = readRequired(join5(harnessRoot, "templates/codex/AGENTS.md.template"));
  const configTemplate = readRequired(join5(harnessRoot, "templates/codex/config.toml.template"));
  const projectName = basename2(projectDir);
  const mcp = readOptionalJson(join5(harnessRoot, ".mcp.json"));
  const agentsMdPath = join5(projectDir, "AGENTS.md");
  ensureDir(projectDir);
  writeFileSync5(agentsMdPath, renderAgentsMd({ template: agentsTemplate, claudeMd, projectName }));
  const configTomlPath = join5(projectDir, ".codex/config.toml");
  ensureDir(join5(projectDir, ".codex"));
  writeFileSync5(
    configTomlPath,
    renderConfigToml({
      template: configTemplate,
      projectName,
      projectDir,
      mcp
    })
  );
  const hookDir = join5(projectDir, ".codex/hooks");
  ensureDir(hookDir);
  const hookFiles = [];
  for (const hook of HOOK_NAMES) {
    const src = join5(harnessRoot, "templates/hooks", `${hook}.sh`);
    if (!existsSync6(src)) {
      continue;
    }
    const ported = readFileSync5(src, "utf8").replace(ENV_VAR_RENAME, "CODEX_PROJECT_DIR");
    const target = join5(hookDir, `${hook}.sh`);
    writeFileSync5(target, ported);
    chmodSync(target, 493);
    hookFiles.push(target);
  }
  const skillFiles = [];
  if (withUzysHarness) {
    for (const phase of PHASES4) {
      const skillDir = join5(projectDir, ".agents", "skills", `uzys-${phase}`);
      ensureDir(skillDir);
      const cmdSrc = join5(harnessRoot, "templates/commands/uzys", `${phase}.md`);
      let source = "";
      if (existsSync6(cmdSrc)) {
        source = readFileSync5(cmdSrc, "utf8");
      } else {
        const fallback = join5(harnessRoot, "templates/codex/skills", `uzys-${phase}/SKILL.md`);
        if (existsSync6(fallback)) {
          source = readFileSync5(fallback, "utf8");
        }
      }
      const target = join5(skillDir, "SKILL.md");
      writeFileSync5(target, renderSkill({ source, phase }));
      skillFiles.push(target);
    }
  }
  const promptFiles = [];
  if (withUzysHarness) {
    const promptDir = join5(projectDir, ".codex", "prompts");
    ensureDir(promptDir);
    for (const phase of PHASES4) {
      const cmdSrc = join5(harnessRoot, "templates/commands/uzys", `${phase}.md`);
      if (!existsSync6(cmdSrc)) {
        continue;
      }
      const source = readFileSync5(cmdSrc, "utf8");
      const target = join5(promptDir, `uzys-${phase}.md`);
      writeFileSync5(target, renderCodexPrompt({ source, phase }));
      promptFiles.push(target);
    }
  }
  return { agentsMdPath, configTomlPath, hookFiles, skillFiles, promptFiles };
}
function readRequired(path2) {
  if (!existsSync6(path2)) {
    throw new Error(`Codex transform: required source missing: ${path2}`);
  }
  return readFileSync5(path2, "utf8");
}
function readOptionalJson(path2) {
  if (!existsSync6(path2)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync5(path2, "utf8"));
  } catch {
    return null;
  }
}

// src/env-files.ts
init_esm_shims();
import { appendFileSync, existsSync as existsSync7, readFileSync as readFileSync6, writeFileSync as writeFileSync6 } from "fs";
import { join as join6 } from "path";
var ENV_EXAMPLE_BODY = `# .env.example \u2014 csr-supabase Track
# Copy to .env (gitignored) and fill in values: cp .env.example .env

# ===== Supabase Management API (MCP server\uC6A9) =====
# Personal Access Token \u2014 @supabase/mcp-server\uAC00 \uD504\uB85C\uC81D\uD2B8 \uC0DD\uC131/\uB9C8\uC774\uADF8\uB808\uC774\uC158/Edge Functions \uBC30\uD3EC\uC5D0 \uC0AC\uC6A9
# \uBC1C\uAE09: https://supabase.com/dashboard/account/tokens
SUPABASE_ACCESS_TOKEN=

# \uD504\uB85C\uC81D\uD2B8 \uCC38\uC870 ID (\uC608: "abcdefghijklmnop")
# \uC704\uCE58: Supabase Dashboard \u2192 Project Settings \u2192 General
SUPABASE_PROJECT_REF=

# DB \uD328\uC2A4\uC6CC\uB4DC (supabase db push \uB4F1 \uC9C1\uC811 DB \uC811\uADFC\uC6A9)
# \uC704\uCE58: Supabase Dashboard \u2192 Project Settings \u2192 Database
SUPABASE_DB_PASSWORD=

# ===== Frontend (public, \uD074\uB77C\uC774\uC5B8\uD2B8 \uB178\uCD9C OK) =====
# \uC704\uCE58: Supabase Dashboard \u2192 Project Settings \u2192 API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ===== Optional \u2014 \uC571 \uCE21 AI \uAE30\uB2A5\uC6A9 =====
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# ===== Note =====
# - Vercel/Netlify\uB294 \uBCC4\uB3C4 CLI login \uC0AC\uC6A9 (env \uBD88\uD544\uC694): vercel login / netlify login
# - Supabase CLI(supabase login)\uB294 OAuth\uB85C ~/.config/supabase/\uC5D0 \uD1A0\uD070 \uC800\uC7A5 \u2014 env \uBCC4\uAC1C
# - .env\uB294 .gitignore\uB428 (\uC790\uB3D9 \uCD94\uAC00). \uC808\uB300 commit \uAE08\uC9C0.
`;
var ENV_EXAMPLE_TRACKS = ["csr-supabase", "full"];
var GITIGNORE_ENV_PATTERN = /^\.env$|^\.env\s/m;
function writeEnvExample(projectDir, tracks) {
  if (!tracks.some((t) => ENV_EXAMPLE_TRACKS.includes(t))) {
    return false;
  }
  const path2 = join6(projectDir, ".env.example");
  if (existsSync7(path2)) {
    return false;
  }
  writeFileSync6(path2, ENV_EXAMPLE_BODY);
  return true;
}
function addGitignoreEnv(projectDir) {
  const path2 = join6(projectDir, ".gitignore");
  if (!existsSync7(path2)) {
    return false;
  }
  const content = readFileSync6(path2, "utf8");
  if (GITIGNORE_ENV_PATTERN.test(content)) {
    return false;
  }
  const sep = content.endsWith("\n") ? "" : "\n";
  appendFileSync(path2, `${sep}
# Secret env (auto-added by claude-harness install)
.env
`);
  return true;
}
var NPX_SKILLS_AGENT_DIRS = [".factory/", ".goose/"];
var GITIGNORE_NPX_SKILLS_HEADER = "# npx skills add multi-CLI cache (auto-added by claude-harness)";
function addGitignoreNpxSkillsAgents(projectDir) {
  const path2 = join6(projectDir, ".gitignore");
  if (!existsSync7(path2)) {
    return [];
  }
  const content = readFileSync6(path2, "utf8");
  const missing = NPX_SKILLS_AGENT_DIRS.filter((pattern) => {
    const lineRegex = new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\//g, "/")}\\s*$`, "m");
    return !lineRegex.test(content);
  });
  if (missing.length === 0) {
    return [];
  }
  const sep = content.endsWith("\n") ? "" : "\n";
  const block = [GITIGNORE_NPX_SKILLS_HEADER, ...missing].join("\n");
  appendFileSync(path2, `${sep}
${block}
`);
  return [...missing];
}
function writeMcpAllowlist(projectDir) {
  const allowlistPath = join6(projectDir, ".mcp-allowlist");
  if (existsSync7(allowlistPath)) {
    return null;
  }
  const mcpPath = join6(projectDir, ".mcp.json");
  if (!existsSync7(mcpPath)) {
    return null;
  }
  let names = [];
  try {
    const parsed = JSON.parse(readFileSync6(mcpPath, "utf8"));
    names = Object.keys(parsed.mcpServers ?? {}).sort();
  } catch {
    return null;
  }
  if (names.length === 0) {
    return [];
  }
  const body = [
    "# MCP Server Allowlist \u2014 auto-generated by claude-harness install",
    "# Referenced by mcp-pre-exec.sh hook. Remove or '#' comment any server you want to block.",
    "# Deleting this file disables the gate (allows all MCP calls).",
    "",
    ...names,
    ""
  ].join("\n");
  writeFileSync6(allowlistPath, body);
  return names;
}

// src/external-installer.ts
init_esm_shims();
import { spawnSync } from "child_process";
import { existsSync as existsSync8, readdirSync as readdirSync2, readFileSync as readFileSync7 } from "fs";
import { homedir as homedir3 } from "os";
import { join as join7 } from "path";
var DEFAULT_SPAWN_TIMEOUT_MS = 12e4;
function runExternalInstall(ctx, deps = {}) {
  const log = deps.log ?? console.log;
  const warn = deps.warn ?? console.error;
  const spawn = deps.spawn ?? defaultSpawn;
  const assets = deps.assets ?? EXTERNAL_ASSETS;
  const harnessRoot = deps.harnessRoot ?? process.cwd();
  const applicable = filterApplicableAssets(assets, ctx);
  const sorted = [...applicable].sort((a, b2) => {
    const ai = CATEGORIES.indexOf(a.category);
    const bi = CATEGORIES.indexOf(b2.category);
    return ai - bi;
  });
  const attempted = [];
  const cli2 = ctx.cli;
  const scope = resolveScope(ctx.scope);
  for (const asset of sorted) {
    deps.onAssetStart?.(asset);
    log(`  \u2192 ${asset.description}`);
    const baseResult = installOne(asset, { spawn, harnessRoot, cli: cli2, scope });
    let result = baseResult;
    if (baseResult.ok) {
      const v2 = detectVersion(asset.method, spawn);
      if (v2) result = { ...baseResult, version: v2 };
    }
    deps.onAssetResult?.(result);
    if (!result.ok) {
      const failureMode = asset.failureMode ?? "warn-skip";
      if (failureMode === "abort") {
        attempted.push(result);
        return {
          attempted,
          succeeded: attempted.filter((r) => r.ok).length,
          skipped: attempted.filter((r) => !r.ok).length,
          aborted: asset
        };
      }
      warn(`    [warn-skip] ${asset.id}: ${result.message ?? "failed"}`);
    }
    attempted.push(result);
  }
  return {
    attempted,
    succeeded: attempted.filter((r) => r.ok).length,
    skipped: attempted.filter((r) => !r.ok).length
  };
}
function installOne(asset, ctx) {
  const { method } = asset;
  switch (method.kind) {
    case "skill":
      return runSpawn(asset, ctx.spawn, "npx", buildSkillArgs(method, ctx.cli, ctx.scope));
    case "plugin":
      return installPlugin(asset, ctx.spawn, method, ctx.scope);
    case "npm":
      return runSpawn(
        asset,
        ctx.spawn,
        "npm",
        ctx.scope === "global" ? ["install", "-g", method.pkg] : ["install", "--save-dev", method.pkg]
      );
    case "npx-run":
      return runSpawn(asset, ctx.spawn, "npx", [method.cmd, ...method.args ?? []]);
    case "shell-script": {
      const scriptPath = join7(ctx.harnessRoot, method.script);
      if (!existsSync8(scriptPath)) {
        return {
          asset,
          ok: false,
          message: `script not found: ${scriptPath}`
        };
      }
      return runSpawn(asset, ctx.spawn, "bash", [scriptPath, ...method.args]);
    }
  }
}
var SKILLS_CLI_AGENT_MAP = {
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
  // v26.66.0 — Antigravity (Google) skills agent. `.agents/skills/` 표준 공유 (codex transform 산출과 동일).
  antigravity: "antigravity"
};
function buildSkillArgs(method, cli2, scope) {
  const args = ["skills", "add", method.source];
  if (method.skill) {
    args.push("--skill", method.skill);
  }
  if (cli2.length > 0) {
    for (const c3 of cli2) {
      args.push("--agent", SKILLS_CLI_AGENT_MAP[c3] ?? c3);
    }
  }
  if (scope === "global") {
    args.push("-g");
  }
  args.push("--yes");
  return args;
}
function installPlugin(asset, spawn, method, scope) {
  const claudeScope = scope === "global" ? "user" : "project";
  spawn(
    "claude",
    ["plugin", "marketplace", "add", "--scope", claudeScope, method.marketplace],
    spawnOpts()
  );
  return runSpawn(asset, spawn, "claude", [
    "plugin",
    "install",
    "--scope",
    claudeScope,
    method.pluginId
  ]);
}
function runSpawn(asset, spawn, cmd, args) {
  const result = spawn(cmd, args, spawnOpts());
  if (result.error) {
    return { asset, ok: false, message: result.error.message };
  }
  if ((result.status ?? 1) !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const tail = stderr.length > 200 ? `${stderr.slice(0, 200)}\u2026` : stderr;
    return {
      asset,
      ok: false,
      message: `${cmd} exited ${result.status}${tail ? `: ${tail}` : ""}`
    };
  }
  return { asset, ok: true };
}
function spawnOpts() {
  return {
    encoding: "utf8",
    stdio: "pipe",
    timeout: DEFAULT_SPAWN_TIMEOUT_MS
  };
}
function defaultSpawn(cmd, args, opts) {
  return spawnSync(cmd, [...args], opts);
}
function detectVersion(method, spawn) {
  try {
    switch (method.kind) {
      case "plugin": {
        const at2 = method.pluginId.lastIndexOf("@");
        if (at2 <= 0) return void 0;
        const plugin = method.pluginId.slice(0, at2);
        const marketplaceShort = method.pluginId.slice(at2 + 1);
        const cacheBase = join7(homedir3(), ".claude/plugins/cache", marketplaceShort, plugin);
        if (!existsSync8(cacheBase)) return void 0;
        const versions = readdirSync2(cacheBase).filter((v2) => /^\d/.test(v2)).sort();
        return versions.at(-1);
      }
      case "npm": {
        const npmRoot = getNpmGlobalRoot(spawn);
        if (!npmRoot) return void 0;
        const pkgJson = join7(npmRoot, method.pkg, "package.json");
        if (!existsSync8(pkgJson)) return void 0;
        const parsed = JSON.parse(readFileSync7(pkgJson, "utf8"));
        return parsed.version;
      }
      default:
        return void 0;
    }
  } catch {
    return void 0;
  }
}
var npmGlobalRootCache;
function getNpmGlobalRoot(spawn) {
  if (npmGlobalRootCache !== void 0) return npmGlobalRootCache || void 0;
  try {
    const r = spawn("npm", ["root", "-g"], spawnOpts());
    if ((r.status ?? 1) === 0) {
      npmGlobalRootCache = (r.stdout ?? "").trim();
      return npmGlobalRootCache || void 0;
    }
  } catch {
  }
  npmGlobalRootCache = "";
  return void 0;
}

// src/install-log.ts
init_esm_shims();
import { createHash } from "crypto";
import { existsSync as existsSync9, mkdirSync as mkdirSync5, readFileSync as readFileSync8, writeFileSync as writeFileSync7 } from "fs";
import { dirname as dirname3, join as join8 } from "path";
var INSTALL_LOG_FILENAME = ".harness-install.json";
var INSTALL_LOG_VERSION = 1;
function buildAssetEntries(report, scope) {
  if (!report) return [];
  return report.attempted.filter((r) => r.ok).map((r) => assetToLogEntry(r.asset, scope, r.version));
}
function assetToLogEntry(asset, scope, version) {
  const detail = methodDetail(asset.method);
  const entry = {
    id: asset.id,
    category: asset.category,
    method: asset.method.kind,
    scope,
    detail
  };
  if (version) entry.version = version;
  return entry;
}
function methodDetail(method) {
  switch (method.kind) {
    case "plugin":
      return { marketplace: method.marketplace, pluginId: method.pluginId };
    case "skill":
      return { source: method.source, ...method.skill ? { skill: method.skill } : {} };
    case "npm":
      return { pkg: method.pkg };
    case "npx-run":
      return { cmd: method.cmd, args: (method.args ?? []).join(" ") };
    case "shell-script":
      return { script: method.script, args: method.args.join(" ") };
  }
}
function buildInstallLog(spec, external, scope, rootClaudeMd) {
  const log = {
    schemaVersion: INSTALL_LOG_VERSION,
    installedAt: (/* @__PURE__ */ new Date()).toISOString(),
    scope,
    spec: {
      tracks: spec.tracks,
      cli: spec.cli
    },
    templates: {
      claudeDir: ".claude/",
      ...spec.cli.includes("codex") ? { codexDir: ".codex/" } : {},
      ...spec.cli.includes("opencode") ? { opencodeDir: ".opencode/" } : {},
      ...rootClaudeMd ? { rootClaudeMd } : {}
    },
    assets: buildAssetEntries(external, scope)
  };
  return log;
}
function hashContent(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
function writeInstallLog(projectDir, log) {
  const path2 = join8(projectDir, ".claude", INSTALL_LOG_FILENAME);
  mkdirSync5(dirname3(path2), { recursive: true });
  writeFileSync7(path2, `${JSON.stringify(log, null, 2)}
`, "utf8");
  return path2;
}
function readInstallLog(projectDir) {
  const path2 = join8(projectDir, ".claude", INSTALL_LOG_FILENAME);
  if (!existsSync9(path2)) return null;
  try {
    const parsed = JSON.parse(readFileSync8(path2, "utf8"));
    if (Array.isArray(parsed.assets)) {
      parsed.assets = parsed.assets.map(
        (a) => a.method === "npm-global" ? { ...a, method: "npm" } : a
      );
    }
    return parsed;
  } catch {
    return null;
  }
}
function installLogPath(projectDir) {
  return join8(projectDir, ".claude", INSTALL_LOG_FILENAME);
}

// src/manifest.ts
init_esm_shims();
var all = () => true;
var dev = (s) => hasDevTrack(s.tracks);
var ui = (s) => hasUiTrack(s.tracks);
var onTracks = (pattern) => (s) => anyTrack(s.tracks, pattern);
var COMMON_RULES = ["git-policy", "change-management", "gates-taxonomy"];
var DEV_RULES = ["test-policy", "ship-checklist", "code-style", "error-handling"];
var UI_RULES = ["design-workflow", "playwright-launch"];
var TRACK_RULES = {
  "csr-supabase": ["shadcn", "api-contract"],
  "csr-fastify": ["shadcn", "api-contract", "database"],
  "csr-fastapi": ["shadcn", "api-contract", "database"],
  "ssr-htmx": ["htmx"],
  "ssr-nextjs": ["nextjs", "shadcn"],
  data: ["pyside6", "data-analysis"],
  executive: [],
  tooling: ["cli-development"],
  full: [
    "shadcn",
    "api-contract",
    "database",
    "htmx",
    "nextjs",
    "pyside6",
    "data-analysis",
    "cli-development"
  ],
  // v0.5.0 — executive-style baselines (no dev rules; common rules only).
  "project-management": [],
  "growth-marketing": []
};
function resolveRules(spec) {
  const set = new Set(COMMON_RULES);
  if (hasDevTrack(spec.tracks)) {
    for (const r of DEV_RULES) {
      set.add(r);
    }
  }
  if (spec.withTauri && anyTrack(spec.tracks, "csr-*|full")) {
    set.add("tauri");
  }
  if (hasUiTrack(spec.tracks)) {
    for (const r of UI_RULES) {
      set.add(r);
    }
  }
  for (const t of spec.tracks) {
    for (const r of TRACK_RULES[t]) {
      set.add(r);
    }
  }
  return [...set].sort();
}
var UZYS_COMMANDS = ["spec", "plan", "build", "test", "review", "ship", "auto"];
var CORE_AGENTS = ["reviewer", "data-analyst", "strategist"];
var CORE_AGENTS_ECC = ["code-reviewer", "security-reviewer"];
var DEV_AGENTS = ["plan-checker"];
var DEV_AGENTS_ECC = ["silent-failure-hunter", "build-error-resolver"];
var ALWAYS_HOOKS = [
  "session-start.sh",
  "protect-files.sh",
  "gate-check.sh",
  "agentshield-gate.sh",
  "mcp-pre-exec.sh",
  "spec-drift-check.sh",
  "checkpoint-snapshot.sh",
  "hito-counter.sh"
];
var COMMON_SKILL_DIRS = ["north-star", "gh-issue-workflow"];
var COMMON_SKILL_DIRS_ECC = ["strategic-compact", "deep-research"];
var MODIFIED_COMMON_SKILL_DIRS = ["continuous-learning-v2"];
var DEV_SKILL_DIRS = [];
var DEV_SKILL_DIRS_ECC = ["eval-harness", "verification-loop", "agent-introspection-debugging"];
var UI_SKILL_DIRS = ["ui-visual-review"];
var UI_SKILL_DIRS_ECC = ["e2e-testing"];
var PYTHON_SKILL_DIRS_ECC = ["python-patterns", "python-testing"];
function buildManifest(spec) {
  const m = [];
  for (const r of resolveRules(spec)) {
    m.push({
      source: `rules/${r}.md`,
      target: `.claude/rules/${r}.md`,
      type: "file",
      applies: all
    });
  }
  for (const cmd of UZYS_COMMANDS) {
    m.push({
      source: `commands/uzys/${cmd}.md`,
      target: `.claude/commands/uzys/${cmd}.md`,
      type: "file",
      applies: (s) => Boolean(s.withUzysHarness)
    });
  }
  m.push({
    source: "commands/ecc",
    target: ".claude/commands/ecc",
    type: "dir",
    applies: (s) => !s.withEcc
  });
  m.push({
    source: "CLAUDE.md",
    target: ".claude/CLAUDE.md",
    type: "file",
    applies: all
  });
  for (const a of CORE_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: all
    });
  }
  for (const a of DEV_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: dev
    });
  }
  for (const a of CORE_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc
    });
  }
  for (const a of DEV_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks)
    });
  }
  for (const sd of COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all
    });
  }
  for (const sd of COMMON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc
    });
  }
  for (const sd of MODIFIED_COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all
    });
  }
  m.push({
    source: "skills/spec-scaling/SKILL.md",
    target: ".claude/skills/spec-scaling/SKILL.md",
    type: "file",
    applies: all
  });
  m.push({
    source: "skills/market-research",
    target: ".claude/skills/market-research",
    type: "dir",
    applies: onTracks("executive|full")
  });
  for (const sd of ["investor-materials", "investor-outreach"]) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: onTracks("executive|full")
    });
  }
  m.push({
    source: "skills/nextjs-turbopack",
    target: ".claude/skills/nextjs-turbopack",
    type: "dir",
    applies: onTracks("ssr-nextjs|full")
  });
  for (const sd of PYTHON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && anyTrack(s.tracks, "data|csr-fastapi|full")
    });
  }
  for (const sd of DEV_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: dev
    });
  }
  for (const sd of DEV_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks)
    });
  }
  for (const sd of UI_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: ui
    });
  }
  for (const sd of UI_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && hasUiTrack(s.tracks)
    });
  }
  for (const h2 of ALWAYS_HOOKS) {
    m.push({
      source: `hooks/${h2}`,
      target: `.claude/hooks/${h2}`,
      type: "file",
      applies: all
    });
  }
  m.push({
    source: "settings.json",
    target: ".claude/settings.json",
    type: "file",
    applies: all
  });
  return m;
}

// src/mcp-merge.ts
init_esm_shims();
import { existsSync as existsSync10, readFileSync as readFileSync9, writeFileSync as writeFileSync8 } from "fs";
function parseTrackMcpMap(raw) {
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = line.split("	");
    if (parts.length < 4) {
      continue;
    }
    const [name, pattern, command, argsJson] = parts;
    if (!name || !pattern || !command) {
      continue;
    }
    let args;
    try {
      args = JSON.parse(argsJson ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      continue;
    }
    rows.push({ name, pattern, command, args });
  }
  return rows;
}
function mergeMcpServers(base, rows, tracks) {
  const out = {
    ...base,
    mcpServers: { ...base.mcpServers }
  };
  for (const row of rows) {
    if (!anyTrack(tracks, row.pattern)) {
      continue;
    }
    if (out.mcpServers[row.name]) {
      continue;
    }
    out.mcpServers[row.name] = {
      type: "stdio",
      command: row.command,
      args: row.args
    };
  }
  delete out._comment;
  return out;
}
function composeMcpJson(opts) {
  const base = JSON.parse(readFileSync9(opts.templateMcpPath, "utf8"));
  const merged = opts.existingPath && existsSync10(opts.existingPath) ? mergeUserBase(base, opts.existingPath) : base;
  const mapRaw = existsSync10(opts.trackMapPath) ? readFileSync9(opts.trackMapPath, "utf8") : "";
  const rows = parseTrackMcpMap(mapRaw);
  return mergeMcpServers(merged, rows, opts.tracks);
}
function mergeUserBase(base, existingPath) {
  try {
    const existing = JSON.parse(readFileSync9(existingPath, "utf8"));
    return {
      ...base,
      mcpServers: { ...base.mcpServers, ...existing.mcpServers }
    };
  } catch {
    return base;
  }
}
function writeMcpJson(path2, mcp) {
  writeFileSync8(path2, `${JSON.stringify(mcp, null, 2)}
`);
}

// src/opencode/transform.ts
init_esm_shims();
import { copyFileSync as copyFileSync2, existsSync as existsSync11, readFileSync as readFileSync10, writeFileSync as writeFileSync9 } from "fs";
import { basename as basename3, join as join9 } from "path";

// src/opencode/agents-md.ts
init_esm_shims();
function renameSlashes2(text) {
  return text.replaceAll("/uzys:", "/uzys-");
}
function renderAgentsMd2(params) {
  const body = params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
  const replaced = params.template.replaceAll("{PROJECT_NAME}", params.projectName).replaceAll("{PROJECT_RULES}", body);
  return renameSlashes2(replaced);
}

// src/opencode/commands.ts
init_esm_shims();
var AGENT_BY_PHASE = {
  spec: "plan",
  plan: "plan",
  build: "build",
  test: "build",
  review: "plan",
  ship: "build"
};
function renderCommand(params) {
  const { description, body } = parseSource3(params.source);
  const finalDescription = description || `uzys-${params.phase} phase command (OpenCode \uD3EC\uD305)`;
  const escapedDesc = finalDescription.replace(/"/g, '\\"');
  const agent = AGENT_BY_PHASE[params.phase] ?? "build";
  const renamedBody = renameSlashes2(body).trimEnd();
  return [
    "---",
    `description: "${escapedDesc}"`,
    `agent: ${agent}`,
    "---",
    "",
    renamedBody,
    ""
  ].join("\n");
}
function parseSource3(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] === "---") {
    let descMatch = "";
    let secondDelimAt = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line === "---") {
        secondDelimAt = i;
        break;
      }
      const match = line.match(/^description:\s*(.*)$/);
      if (match) {
        descMatch = stripQuotes2(match[1] ?? "");
      }
    }
    const body2 = secondDelimAt >= 0 ? lines.slice(secondDelimAt + 1).join("\n") : source;
    return { description: descMatch, body: body2.replace(/^\n+/, "") };
  }
  const firstLine = lines[0] ?? "";
  const body = lines.slice(1).join("\n");
  return { description: firstLine.trim(), body };
}
function stripQuotes2(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// src/opencode/opencode-json.ts
init_esm_shims();
function renderOpencodeJson(params) {
  const config = parseTemplate(params.template);
  if (params.mcp) {
    config.mcp = { ...params.mcp.mcpServers };
  }
  return `${JSON.stringify(config, null, 2)}
`;
}
function parseTemplate(template) {
  try {
    return JSON.parse(template);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`opencode.json template invalid JSON: ${message}`);
  }
}

// src/opencode/transform.ts
var PHASES5 = ["spec", "plan", "build", "test", "review", "ship"];
function runOpencodeTransform(params) {
  const { harnessRoot, projectDir } = params;
  const claudeMd = readRequired2(join9(harnessRoot, "templates/CLAUDE.md"));
  const agentsTemplate = readRequired2(join9(harnessRoot, "templates/opencode/AGENTS.md.template"));
  const opencodeTemplate = readRequired2(
    join9(harnessRoot, "templates/opencode/opencode.json.template")
  );
  const projectName = basename3(projectDir);
  const mcp = readOptionalJson2(join9(harnessRoot, ".mcp.json"));
  ensureDir(projectDir);
  const agentsMdPath = join9(projectDir, "AGENTS.md");
  writeFileSync9(agentsMdPath, renderAgentsMd2({ template: agentsTemplate, claudeMd, projectName }));
  const opencodeJsonPath = join9(projectDir, "opencode.json");
  writeFileSync9(opencodeJsonPath, renderOpencodeJson({ template: opencodeTemplate, mcp }));
  const cmdDir = join9(projectDir, ".opencode/commands");
  ensureDir(cmdDir);
  const commandFiles = [];
  for (const phase of PHASES5) {
    const cmdSrc = join9(harnessRoot, "templates/commands/uzys", `${phase}.md`);
    let source = "";
    if (existsSync11(cmdSrc)) {
      source = readFileSync10(cmdSrc, "utf8");
    } else {
      const fallback = join9(
        harnessRoot,
        "templates/opencode/.opencode/commands",
        `uzys-${phase}.md`
      );
      if (existsSync11(fallback)) {
        source = readFileSync10(fallback, "utf8");
      }
    }
    const target = join9(cmdDir, `uzys-${phase}.md`);
    writeFileSync9(target, renderCommand({ source, phase }));
    commandFiles.push(target);
  }
  const pluginDir = join9(projectDir, ".opencode/plugins");
  ensureDir(pluginDir);
  const pluginPath = join9(pluginDir, "uzys-harness.ts");
  const pluginSrc = join9(harnessRoot, "templates/opencode/.opencode/plugins/uzys-harness.ts");
  if (existsSync11(pluginSrc)) {
    copyFileSync2(pluginSrc, pluginPath);
  } else {
    writeFileSync9(pluginPath, "// uzys-harness plugin stub (template missing)\n");
  }
  return { agentsMdPath, opencodeJsonPath, commandFiles, pluginPath };
}
function readRequired2(path2) {
  if (!existsSync11(path2)) {
    throw new Error(`OpenCode transform: required source missing: ${path2}`);
  }
  return readFileSync10(path2, "utf8");
}
function readOptionalJson2(path2) {
  if (!existsSync11(path2)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync10(path2, "utf8"));
  } catch {
    return null;
  }
}

// src/project-claude-merge.ts
init_esm_shims();
import { existsSync as existsSync12, readFileSync as readFileSync11 } from "fs";
import { join as join10 } from "path";
var SECTIONS = [
  "stack",
  "workflow",
  "active-rules",
  "agents",
  "skills",
  "plugins",
  "commands",
  "boundaries",
  "supabase-auth"
];
var SECTION_TITLES = {
  stack: "Stack",
  workflow: "Workflow",
  "active-rules": "Active Rules",
  agents: "Agents",
  skills: "Skills",
  plugins: "Plugins",
  commands: "Commands",
  boundaries: "Boundaries",
  "supabase-auth": "Supabase auth configuration"
};
var TRACK_DISPLAY_NAMES = {
  tooling: "Tooling",
  "csr-supabase": "CSR Supabase",
  "csr-fastify": "CSR Fastify",
  "csr-fastapi": "CSR FastAPI",
  "ssr-htmx": "SSR HTMX",
  "ssr-nextjs": "SSR Next.js",
  data: "Data",
  executive: "Executive",
  full: "Full",
  "project-management": "Project Management",
  "growth-marketing": "Growth Marketing"
};
var FULL_EXPANSION = [
  "tooling",
  "csr-fastapi",
  "csr-fastify",
  "csr-supabase",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "executive",
  "project-management",
  "growth-marketing"
];
function mergeProjectClaude(tracks, opts) {
  const expanded = expandTracks(tracks);
  const baseRaw = readFileSync11(join10(opts.baseDir, "_base.md"), "utf8");
  let output = baseRaw;
  output = output.replace("<!-- INSERT: track-list -->", trackList(expanded));
  output = output.replace("<!-- INSERT: tagline -->", taglineList(expanded, opts.baseDir));
  for (const section of SECTIONS) {
    const marker = `<!-- INSERT: ${section} -->`;
    const block = renderSection(section, expanded, opts.baseDir);
    if (block === null) {
      output = stripMarkerLine(output, marker);
    } else {
      output = output.replace(marker, block);
    }
  }
  return `${output.replace(/\n{3,}/g, "\n\n").trimEnd()}
`;
}
function expandTracks(tracks) {
  if (tracks.includes("full")) {
    return FULL_EXPANSION;
  }
  return tracks;
}
function trackList(tracks) {
  return tracks.map((t) => TRACK_DISPLAY_NAMES[t]).join(", ");
}
function taglineList(tracks, baseDir) {
  const taglines = [];
  for (const t of tracks) {
    const path2 = join10(baseDir, "fragments", t, "tagline.md");
    if (!existsSync12(path2)) {
      continue;
    }
    const body = readFileSync11(path2, "utf8").trim();
    if (body) {
      taglines.push(body);
    }
  }
  return taglines.join(" / ");
}
function renderSection(section, tracks, baseDir) {
  const present = [];
  for (const t of tracks) {
    const path2 = join10(baseDir, "fragments", t, `${section}.md`);
    if (!existsSync12(path2)) {
      continue;
    }
    const body = readFileSync11(path2, "utf8").trim();
    if (body) {
      present.push({ track: t, body });
    }
  }
  if (present.length === 0) {
    return null;
  }
  const title = `## ${SECTION_TITLES[section]}`;
  if (present.length === 1 && present[0]) {
    return `${title}

${present[0].body}
`;
  }
  const blocks = present.map(({ track, body }) => `### ${TRACK_DISPLAY_NAMES[track]}

${body}`);
  return `${title}

${blocks.join("\n\n")}
`;
}
function stripMarkerLine(text, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\n*${escaped}\\n*`);
  return text.replace(pattern, "\n");
}

// src/settings-merge.ts
init_esm_shims();
function addPreToolUseHook(settings, matcher, command) {
  const next = JSON.parse(JSON.stringify(settings));
  if (!next.hooks) {
    next.hooks = {};
  }
  if (!next.hooks.PreToolUse) {
    next.hooks.PreToolUse = [];
  }
  const preToolUse = next.hooks.PreToolUse;
  const existing = preToolUse.find((m) => m.matcher === matcher);
  const newHook = { type: "command", command };
  if (existing) {
    if (existing.hooks.some((h2) => h2.command === command)) {
      return next;
    }
    existing.hooks.push(newHook);
  } else {
    preToolUse.push({ matcher, hooks: [newHook] });
  }
  return next;
}

// src/update-mode.ts
init_esm_shims();
import {
  copyFileSync as copyFileSync3,
  existsSync as existsSync13,
  readdirSync as readdirSync3,
  readFileSync as readFileSync12,
  unlinkSync,
  writeFileSync as writeFileSync10
} from "fs";
import { join as join11 } from "path";
function runUpdateMode(projectDir, templatesDir) {
  const claudeDir = join11(projectDir, ".claude");
  const report = {
    updated: {},
    pruned: {},
    staleHookRefs: [],
    claudeMdUpdated: false
  };
  const targets = [
    {
      target: join11(claudeDir, "rules"),
      source: join11(templatesDir, "rules"),
      pattern: ".md",
      label: ".claude/rules"
    },
    {
      target: join11(claudeDir, "agents"),
      source: join11(templatesDir, "agents"),
      pattern: ".md",
      label: ".claude/agents"
    },
    {
      target: join11(claudeDir, "commands/uzys"),
      source: join11(templatesDir, "commands/uzys"),
      pattern: ".md",
      label: ".claude/commands/uzys"
    },
    {
      target: join11(claudeDir, "hooks"),
      source: join11(templatesDir, "hooks"),
      pattern: ".sh",
      label: ".claude/hooks"
    }
  ];
  for (const t of targets) {
    report.updated[t.label] = updateDir(t.target, t.source, t.pattern);
    report.pruned[t.label] = pruneOrphans(t.target, t.source, t.pattern);
  }
  const claudeMd = join11(claudeDir, "CLAUDE.md");
  const templateMd = join11(templatesDir, "CLAUDE.md");
  if (existsSync13(claudeMd) && existsSync13(templateMd)) {
    copyFileSync3(templateMd, claudeMd);
    report.claudeMdUpdated = true;
  }
  const settingsPath = join11(claudeDir, "settings.json");
  if (existsSync13(settingsPath)) {
    report.staleHookRefs = cleanStaleHookRefs(settingsPath, join11(claudeDir, "hooks"));
  }
  return report;
}
function updateDir(target, source, ext) {
  if (!existsSync13(target) || !existsSync13(source)) return 0;
  let count = 0;
  for (const file of readdirSync3(target)) {
    if (!file.endsWith(ext)) continue;
    const targetFile = join11(target, file);
    const sourceFile = join11(source, file);
    if (existsSync13(sourceFile)) {
      copyFileSync3(sourceFile, targetFile);
      count++;
    }
  }
  return count;
}
function pruneOrphans(target, source, ext) {
  if (!existsSync13(target) || !existsSync13(source)) return [];
  const removed = [];
  for (const file of readdirSync3(target)) {
    if (!file.endsWith(ext)) continue;
    const sourceFile = join11(source, file);
    if (!existsSync13(sourceFile)) {
      const targetFile = join11(target, file);
      try {
        unlinkSync(targetFile);
        removed.push(file);
      } catch {
      }
    }
  }
  return removed;
}
function cleanStaleHookRefs(settingsPath, hooksDir) {
  let settings;
  try {
    settings = JSON.parse(readFileSync12(settingsPath, "utf8"));
  } catch {
    return [];
  }
  const hookEvents = settings.hooks ?? {};
  const removed = [];
  const cleanedHooks = {};
  for (const [eventName, eventEntries] of Object.entries(hookEvents)) {
    if (!Array.isArray(eventEntries)) {
      cleanedHooks[eventName] = eventEntries;
      continue;
    }
    cleanedHooks[eventName] = eventEntries.filter((entry) => Array.isArray(entry?.hooks)).map((entry) => ({
      ...entry,
      hooks: entry.hooks.filter((hook) => keepHookRef(hook, hooksDir, removed))
    })).filter((entry) => entry.hooks.length > 0);
  }
  if (removed.length > 0) {
    const next = { ...settings, hooks: cleanedHooks };
    writeFileSync10(settingsPath, `${JSON.stringify(next, null, 2)}
`);
  }
  return removed;
}
function keepHookRef(hook, hooksDir, removed) {
  const refMatch = (hook?.command ?? "").match(/\/\.claude\/hooks\/([^"\s/]+\.sh)/);
  if (!refMatch?.[1]) return true;
  const fname = refMatch[1];
  const exists = existsSync13(join11(hooksDir, fname));
  if (!exists && !removed.includes(fname)) removed.push(fname);
  return exists;
}

// src/installer.ts
var KARPATHY_HOOK_COMMAND = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"';
var KARPATHY_ASSET_ID = "karpathy-coder";
function runInstall(ctx) {
  const { harnessRoot, projectDir, spec } = ctx;
  const mode = ctx.mode ?? "fresh";
  const templatesDir = join12(harnessRoot, "templates");
  if (!existsSync14(templatesDir)) {
    throw new Error(`Templates dir not found: ${templatesDir}`);
  }
  const claudeDir = join12(projectDir, ".claude");
  if (mode === "update" && !existsSync14(claudeDir)) {
    throw new Error(`Update mode requires existing .claude/ at ${claudeDir}`);
  }
  const wantBackup = ctx.backup ?? (mode === "update" || mode === "reinstall");
  const backupPath = wantBackup ? mode === "update" ? copyBackupDir(claudeDir) : backupDir(claudeDir) : null;
  if (mode === "update") {
    const updateReport = runUpdateMode(projectDir, templatesDir);
    const baseline2 = {
      filesCopied: 0,
      dirsCopied: 0,
      skipped: 0,
      backup: backupPath,
      installedTracks: [...spec.tracks].sort(),
      mcpServers: [],
      codex: null,
      codexOptIn: null,
      opencode: null,
      antigravity: null,
      antigravityOptIn: null,
      updateMode: updateReport,
      mode,
      envFiles: {
        envExampleCreated: false,
        gitignoreEnvAdded: false,
        mcpAllowlist: null,
        gitignoreNpxSkillsAdded: []
      },
      rootClaudeMd: null
    };
    ctx.onProgress?.({ type: "baseline-complete", baseline: baseline2 });
    return { ...baseline2, external: null, karpathyHook: null };
  }
  const claudeBaselineEnabled = spec.cli.includes("claude");
  let filesCopied = 0;
  let dirsCopied = 0;
  let skipped = 0;
  let rootClaudeMd = null;
  let rootClaudeMdLog = null;
  const categories = {
    rules: [],
    agents: [],
    hooks: [],
    commands: 0,
    skills: []
  };
  if (claudeBaselineEnabled) {
    ensureProjectSkeleton(projectDir);
    const manifestSpec = {
      tracks: spec.tracks,
      withTauri: spec.options.withTauri,
      withUzysHarness: spec.options.withUzysHarness,
      // v26.55.0 — withEcc gating (ADR-016). ECC cherry-pick (agents/skills/commands) 항목 토글.
      withEcc: spec.options.withEcc
    };
    const manifest = buildManifest(manifestSpec);
    for (const entry of manifest) {
      if (!entry.applies(manifestSpec)) {
        continue;
      }
      const source = join12(templatesDir, entry.source);
      const target = join12(projectDir, entry.target);
      if (!existsSync14(source)) {
        skipped += 1;
        continue;
      }
      if (entry.type === "file") {
        copyFile(source, target);
        filesCopied += 1;
      } else {
        copyDir(source, target);
        dirsCopied += 1;
      }
      accumulateCategory(categories, entry);
    }
    const hookDir = join12(projectDir, ".claude/hooks");
    if (existsSync14(hookDir)) {
      chmodHooksSync(hookDir);
    }
    writeInstalledTracks(projectDir, spec.tracks);
    const rootClaudeMdContent = writeRootClaudeMd(harnessRoot, projectDir, spec.tracks);
    rootClaudeMd = { tracks: spec.tracks };
    rootClaudeMdLog = { path: "CLAUDE.md", sha256: hashContent(rootClaudeMdContent) };
  }
  const mcpResult = composeAndWriteMcp(harnessRoot, projectDir, spec);
  const envFiles = {
    envExampleCreated: writeEnvExample(projectDir, spec.tracks),
    gitignoreEnvAdded: addGitignoreEnv(projectDir),
    mcpAllowlist: writeMcpAllowlist(projectDir),
    // v0.8.0 — `.factory/`, `.goose/` ignore (npx skills universal install 사용자 #3)
    gitignoreNpxSkillsAdded: addGitignoreNpxSkillsAgents(projectDir)
  };
  let codex = null;
  let codexOptIn = null;
  if (spec.cli.includes("codex")) {
    codex = runCodexTransform({
      harnessRoot,
      projectDir,
      withUzysHarness: spec.options.withUzysHarness
    });
    const installScope = spec.scope ?? "project";
    if (installScope === "global" && (spec.options.withCodexSkills || spec.options.withCodexTrust || spec.options.withCodexPrompts)) {
      codexOptIn = runCodexOptIn({
        projectDir,
        harnessRoot,
        withCodexSkills: spec.options.withCodexSkills,
        withCodexTrust: spec.options.withCodexTrust,
        withCodexPrompts: spec.options.withCodexPrompts
      });
    }
  }
  let opencode = null;
  if (spec.cli.includes("opencode")) {
    opencode = runOpencodeTransform({ harnessRoot, projectDir });
  }
  let antigravity = null;
  let antigravityOptIn = null;
  if (spec.cli.includes("antigravity")) {
    antigravity = runAntigravityTransform({
      harnessRoot,
      projectDir,
      withUzysHarness: spec.options.withUzysHarness
    });
    const installScope = spec.scope ?? "project";
    if (installScope === "global" && spec.options.withAntigravityGlobal) {
      antigravityOptIn = runAntigravityOptIn({
        projectDir,
        harnessRoot,
        enabled: true
      });
    }
  }
  const baseline = {
    filesCopied,
    dirsCopied,
    skipped,
    backup: backupPath,
    installedTracks: [...spec.tracks].sort(),
    mcpServers: Object.keys(mcpResult.mcpServers).sort(),
    codex,
    codexOptIn,
    opencode,
    antigravity,
    antigravityOptIn,
    updateMode: null,
    mode,
    envFiles,
    categories,
    rootClaudeMd
  };
  ctx.onProgress?.({ type: "baseline-complete", baseline });
  let external = null;
  if (ctx.runExternal !== null) {
    const runExt = ctx.runExternal ?? runExternalInstall;
    const externalDeps = {
      harnessRoot,
      log: () => {
      },
      warn: () => {
      }
    };
    if (ctx.externalDeps?.onAssetStart) {
      externalDeps.onAssetStart = ctx.externalDeps.onAssetStart;
    }
    if (ctx.externalDeps?.onAssetResult) {
      externalDeps.onAssetResult = ctx.externalDeps.onAssetResult;
    }
    const filterCtx = {
      tracks: spec.tracks,
      options: spec.options,
      ...spec.userOverride ? { userOverride: spec.userOverride } : {}
    };
    const applicableCount = filterApplicableAssets(EXTERNAL_ASSETS, filterCtx).length;
    ctx.onProgress?.({ type: "external-start", assetCount: applicableCount });
    external = runExt(
      { ...filterCtx, cli: spec.cli, ...spec.scope ? { scope: spec.scope } : {} },
      externalDeps
    );
    ctx.onProgress?.({ type: "external-complete", report: external });
  }
  const karpathyHook = wireKarpathyHook(spec, external, harnessRoot, projectDir);
  try {
    const log = buildInstallLog(spec, external, resolveScope(spec.scope), rootClaudeMdLog);
    writeInstallLog(projectDir, log);
  } catch (e2) {
    ctx.onProgress?.({
      type: "install-log-error",
      message: e2 instanceof Error ? e2.message : String(e2)
    });
  }
  return { ...baseline, external, karpathyHook };
}
function wireKarpathyHook(spec, external, harnessRoot, projectDir) {
  if (!spec.options.withKarpathyHook) {
    return null;
  }
  if (!spec.cli.includes("claude")) {
    return { wired: false, reason: "claude-not-selected" };
  }
  if (external === null) {
    return { wired: false, reason: "external-skipped" };
  }
  const karpathyResult = external.attempted.find((r) => r.asset.id === KARPATHY_ASSET_ID);
  if (!karpathyResult?.ok) {
    return { wired: false, reason: "plugin-install-failed" };
  }
  const sourceHook = join12(harnessRoot, "templates/hooks/karpathy-gate.sh");
  const targetHook = join12(projectDir, ".claude/hooks/karpathy-gate.sh");
  let hookScriptCopied = false;
  if (existsSync14(sourceHook)) {
    copyFile(sourceHook, targetHook);
    try {
      chmodSync2(targetHook, 493);
    } catch {
    }
    hookScriptCopied = true;
  }
  const settingsPath = join12(projectDir, ".claude/settings.json");
  let settingsUpdated = false;
  if (existsSync14(settingsPath)) {
    const raw = readFileSync13(settingsPath, "utf8");
    let before;
    try {
      before = JSON.parse(raw);
    } catch {
      return { wired: false, reason: "settings-parse-error", hookScriptCopied };
    }
    const after = addPreToolUseHook(before, "Write|Edit", KARPATHY_HOOK_COMMAND);
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr !== afterStr) {
      writeFileSync11(settingsPath, `${JSON.stringify(after, null, 2)}
`);
      settingsUpdated = true;
    }
  }
  return { wired: true, settingsUpdated, hookScriptCopied };
}
function composeAndWriteMcp(harnessRoot, projectDir, spec) {
  const mcpPath = join12(projectDir, ".mcp.json");
  const composed = composeMcpJson({
    templateMcpPath: join12(harnessRoot, "templates/mcp.json"),
    trackMapPath: join12(harnessRoot, "templates/track-mcp-map.tsv"),
    existingPath: mcpPath,
    tracks: spec.tracks
  });
  writeMcpJson(mcpPath, composed);
  return composed;
}
function accumulateCategory(cats, entry) {
  const target = entry.target;
  if (target.startsWith(".claude/rules/") && target.endsWith(".md")) {
    const name = target.replace(/^\.claude\/rules\//, "").replace(/\.md$/, "");
    cats.rules.push(name);
  } else if (target.startsWith(".claude/agents/") && target.endsWith(".md")) {
    const name = target.replace(/^\.claude\/agents\//, "").replace(/\.md$/, "");
    cats.agents.push(name);
  } else if (target.startsWith(".claude/hooks/") && target.endsWith(".sh")) {
    const name = target.replace(/^\.claude\/hooks\//, "").replace(/\.sh$/, "");
    cats.hooks.push(name);
  } else if (target.startsWith(".claude/commands/")) {
    cats.commands += 1;
  } else if (target.startsWith(".claude/skills/") && entry.type === "dir") {
    const name = target.replace(/^\.claude\/skills\//, "").replace(/\/?$/, "");
    cats.skills.push(name);
  }
}
function writeInstalledTracks(projectDir, tracks) {
  const path2 = join12(projectDir, ".claude/.installed-tracks");
  mkdirSync6(dirname4(path2), { recursive: true });
  const sorted = [...new Set(tracks)].sort().join("\n");
  writeFileSync11(path2, `${sorted}
`);
}
function writeRootClaudeMd(harnessRoot, projectDir, tracks) {
  const baseDir = join12(harnessRoot, "templates/project-claude");
  const content = mergeProjectClaude(tracks, { baseDir });
  writeFileSync11(join12(projectDir, "CLAUDE.md"), content);
  return content;
}
function chmodHooksSync(hookDir) {
  for (const file of listHookFiles(hookDir)) {
    try {
      chmodSync2(file, 493);
    } catch {
    }
  }
}
function listHookFiles(hookDir) {
  return readdirSync4(hookDir, { withFileTypes: true }).filter((e2) => e2.isFile() && e2.name.endsWith(".sh")).map((e2) => resolve(hookDir, e2.name));
}

// src/preset-recommend.ts
init_esm_shims();
function recommendedExternalAssets(presets) {
  if (presets.length === 0) {
    return [];
  }
  const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
    tracks: presets,
    options: DEFAULT_OPTIONS
  });
  return apps.filter((a) => assetTrustTier(a.id) !== "experimental").map((a) => a.id).sort();
}

// src/commands/install.ts
function specFromOptions(options) {
  const parsed = parseCliTargets(options.cli);
  if (!parsed.ok) {
    return {
      ok: false,
      cli: ["claude"],
      warnings: parsed.warnings,
      message: parsed.error ?? "Invalid --cli value"
    };
  }
  const trackInputs = options.track ?? [];
  if (trackInputs.length === 0) {
    return {
      ok: false,
      cli: parsed.targets,
      warnings: parsed.warnings,
      // v26.56.0 (F6) — wizard 진입 안내. `install` subcommand 는 non-interactive.
      message: "At least one --track is required (e.g. --track tooling)\n       Interactive wizard: run without subcommand \u2192 `claude-harness` (drop the `install` word)"
    };
  }
  for (const t of trackInputs) {
    if (!isTrack(t)) {
      return {
        ok: false,
        cli: parsed.targets,
        warnings: parsed.warnings,
        message: `Unknown track: ${t}`
      };
    }
  }
  return {
    ok: true,
    cli: parsed.targets,
    warnings: parsed.warnings,
    message: "spec valid"
  };
}
function installAction(options, deps = {}) {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const runPipeline = deps.runPipeline ?? defaultRunPipeline;
  const resolveHarnessRoot = deps.resolveHarnessRoot ?? defaultHarnessRoot;
  const validated = specFromOptions(options);
  for (const w3 of validated.warnings) {
    err(c.yellow(`[WARN] ${w3}`));
  }
  if (validated.ok && options.withCodexPrompts === true && !validated.cli.includes("codex")) {
    err(
      c.yellow(
        "[WARN] --with-codex-prompts requires --cli codex. Skipping (no Codex prompts will be installed)."
      )
    );
  }
  if (validated.ok && options.codexPrompts === false && !validated.cli.includes("codex")) {
    err(
      c.yellow("[WARN] --no-codex-prompts has no effect without --cli codex (already excluded).")
    );
  }
  if (!validated.ok) {
    err(status.failure(c.red(`ERROR: ${validated.message}`)));
    exit(1);
    return;
  }
  const forceInclude = normalizeRepeatable(options.with);
  const forceExclude = normalizeRepeatable(options.without);
  const validIds = new Set(EXTERNAL_ASSETS.map((a) => a.id));
  for (const id of [...forceInclude, ...forceExclude]) {
    if (!validIds.has(id)) {
      err(
        c.yellow(
          `[WARN] Unknown asset id '${id}' (--with/--without). Skipping. Use one of: ${[...validIds].sort().join(", ")}`
        )
      );
    }
  }
  const filteredInclude = forceInclude.filter((id) => validIds.has(id));
  const filteredExclude = forceExclude.filter((id) => validIds.has(id));
  const userOverride = filteredInclude.length > 0 || filteredExclude.length > 0 ? { forceInclude: filteredInclude, forceExclude: filteredExclude } : void 0;
  const spec = {
    tracks: options.track ?? [],
    ...userOverride ? { userOverride } : {},
    options: {
      withTauri: options.withTauri === true,
      withGsd: options.withGsd === true,
      withEcc: options.withEcc === true || options.withPrune === true,
      withPrune: options.withPrune === true,
      withTob: options.withTob === true,
      withCodexSkills: options.withCodexSkills === true,
      withCodexTrust: options.withCodexTrust === true,
      withKarpathyHook: options.withKarpathyHook === true,
      // v26.64.0 (ADR-020, BREAKING) — ADR-012/017 supersede. cli=codex 자동 default ON 폐기.
      //   withCodexPrompts 는 사용자 명시 `--with-codex-prompts` 시에만 ON.
      //   `--no-codex-prompts` 는 backward-compat noop (default 가 이미 false).
      //   scope=global 일 때만 ~/.codex/prompts/ 에 실 write (installer.ts 참조).
      withCodexPrompts: options.withCodexPrompts === true && options.codexPrompts !== false,
      withAddyAgentSkills: options.withAddyAgentSkills === true,
      withUzysHarness: options.withUzysHarness === true,
      withSuperpowers: options.withSuperpowers === true,
      withAntigravityGlobal: options.withAntigravityGlobal === true
    },
    cli: validated.cli,
    projectDir: resolve2(options.projectDir ?? process.cwd()),
    scope: resolveScopeOption(options.scope, err)
  };
  executeSpec(spec, {
    log,
    err,
    exit,
    runPipeline,
    resolveHarnessRoot,
    verbose: options.verbose === true
  });
}
function executeSpec(spec, deps = {}) {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const runPipeline = deps.runPipeline ?? defaultRunPipeline;
  const resolveHarnessRoot = deps.resolveHarnessRoot ?? defaultHarnessRoot;
  if (!deps.fromWizard) {
    const headerLabel = deps.mode === "update" ? "uzys-claude-harness \xB7 update" : deps.mode === "add" ? "uzys-claude-harness \xB7 add" : deps.mode === "reinstall" ? "uzys-claude-harness \xB7 reinstall" : "uzys-claude-harness \xB7 install";
    log("");
    log(sectionHeader(headerLabel));
    log("");
    log(infoRow("TARGET", shortenPath(spec.projectDir)));
    log(infoRow("TRACKS", spec.tracks.join(", ")));
    log(infoRow("CLI", spec.cli.join(" \xB7 ")));
    {
      const effectiveScope = spec.scope ?? "project";
      const scopeMsg = effectiveScope === "global" ? "Global \u2014 writes to ~/.claude/, ~/.codex/, npm -g" : "Project \u2014 current directory only (no global write)";
      log(infoRow("SCOPE", scopeMsg));
    }
    log(infoRow("OPTIONS", formatOptions(spec)));
    const finalAssets = computeFinalAssets(spec);
    if (finalAssets.length > 0) {
      log(infoRow("ASSETS", `${finalAssets.length} selected`));
      for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
        log(`              ${c.dim(`\xB7 ${cat}:`)} ${ids.join(", ")}`);
      }
    }
    log("");
  }
  log(unifiedSection(deps.mode === "update" ? "Update Mode" : "Templates"));
  log("");
  let phase2HeaderPrinted = false;
  let currentCategory = null;
  const callbacks = {
    onProgress: (event) => {
      if (event.type === "baseline-complete") {
        renderPhase1Rows(log, event.baseline, deps.verbose === true, spec.options.withEcc === true);
      } else if (event.type === "external-start" && event.assetCount > 0) {
        log(unifiedSection(`External assets (${event.assetCount})`));
        log("");
        phase2HeaderPrinted = true;
      }
    },
    externalDeps: {
      onAssetStart: (asset) => {
        if (asset.category !== currentCategory) {
          if (currentCategory !== null) log("");
          log(`  ${c.bold(`\u2501\u2501 ${CATEGORY_TITLES[asset.category]} \u2501\u2501`)}`);
          currentCategory = asset.category;
        }
      },
      onAssetResult: (result) => {
        const meta = result.ok ? formatAssetMeta(result.asset, result.version) : result.message ?? "failed";
        log(`  ${assetRow(result.ok ? "success" : "skip", result.asset.id, meta)}`);
      }
    }
  };
  let report;
  try {
    report = runPipeline(spec, resolveHarnessRoot(), deps.mode, callbacks);
  } catch (e2) {
    const detail = e2 instanceof Error ? e2.message : String(e2);
    log("");
    err(status.failure(c.red(`install failed \u2014 ${detail}`)));
    exit(1);
    return;
  }
  if (report.updateMode) {
    log("");
    log(unifiedSection("Summary"));
    log("");
    log(infoRow("STATUS", c.green("Update complete")));
    log(infoRow("MODE", "update"));
    if (report.backup) {
      log(infoRow("BACKUP", shortenPath(report.backup)));
      log(infoRow("ROLLBACK", `rm -rf .claude && mv ${shortenPath(report.backup)} .claude`));
    }
    log("");
    return;
  }
  if (phase2HeaderPrinted) {
    log("");
  }
  if ((report.codex || report.opencode) && (targetsInclude(spec.cli, "codex") || targetsInclude(spec.cli, "opencode"))) {
    log(unifiedSection(formatCliPhaseTitle(spec.cli)));
    log("");
    if (report.codex && report.opencode) {
      log(assetRow("success", "AGENTS.md", "shared (Codex + OpenCode)"));
    } else if (report.codex || report.opencode) {
      log(assetRow("success", "AGENTS.md", "from .claude/CLAUDE.md"));
    }
    if (report.codex) {
      log(assetRow("success", ".codex/config.toml", "settings + [mcp_servers.*]"));
      log(assetRow("success", ".codex/hooks/", `${report.codex.hookFiles.length} files`));
      log(
        assetRow(
          "success",
          ".agents/skills/uzys-*/SKILL.md",
          `${report.codex.skillFiles.length} skills ($uzys-spec mention)`
        )
      );
      if (report.codex.promptFiles.length > 0) {
        log(
          assetRow(
            "success",
            ".codex/prompts/uzys-*.md",
            `${report.codex.promptFiles.length} prompts (upstream #9848 \uC9C0\uC6D0 \uC2DC /uzys-spec \uC790\uB3D9 \uC791\uB3D9)`
          )
        );
      }
      if (report.codexOptIn) {
        if (report.codexOptIn.skillsInstalled.enabled) {
          log(
            assetRow(
              "success",
              "~/.codex/skills/uzys-*",
              `${report.codexOptIn.skillsInstalled.count} copied (global opt-in)`
            )
          );
        }
        if (report.codexOptIn.trustEntry.enabled) {
          const trust = report.codexOptIn.trustEntry;
          const kind = trust.status === "error" ? "skip" : "success";
          const meta = trust.status === "registered" ? '[projects."<dir>"] trust_level="trusted"' : trust.status === "already-present" ? "already present" : trust.message ?? "error";
          log(assetRow(kind, "~/.codex/config.toml trust entry", meta));
        }
        if (report.codexOptIn.promptsInstalled.enabled) {
          const count = report.codexOptIn.promptsInstalled.count;
          log(
            assetRow(
              count > 0 ? "success" : "skip",
              "~/.codex/prompts/uzys-*",
              `${count} markdown copied (/uzys-spec slash \uB4F1\uB85D)`
            )
          );
        }
      }
    }
    if (report.opencode) {
      log(assetRow("success", "opencode.json", "$schema + 5 keys"));
      log(
        assetRow("success", ".opencode/commands/", `${report.opencode.commandFiles.length} files`)
      );
      log(assetRow("success", ".opencode/plugins/uzys-harness.ts", "self-contained plugin"));
    }
    log("");
  }
  log(unifiedSection("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Install complete")));
  log(infoRow("TRACKS", report.installedTracks.join(", ")));
  if (report.codex && report.opencode) {
    log(infoRow("CLI", "Claude \xB7 Codex \xB7 OpenCode"));
  } else if (report.codex) {
    log(infoRow("CLI", "Claude \xB7 Codex"));
  } else if (report.opencode) {
    log(infoRow("CLI", "Claude \xB7 OpenCode"));
  } else {
    log(infoRow("CLI", "Claude"));
  }
  if (report.external && report.external.skipped > 0) {
    log("");
    log(
      infoRow(
        "WARN",
        c.yellow(
          `${report.external.skipped} external asset${report.external.skipped > 1 ? "s" : ""} skipped (see Phase 2 above)`
        )
      )
    );
  }
  if (!deps.fromWizard) {
    const optIn = experimentalOptInCandidates(spec);
    if (optIn.length > 0) {
      log("");
      log(
        infoRow(
          "OPT-IN",
          c.dim(
            `${optIn.length} experimental available \u2014 add with --with <id>: ${optIn.map((a) => a.id).join(", ")}`
          )
        )
      );
    }
  }
  log("");
  log(infoRow("NEXT", `${c.bold("claude")}  \u2192  ${c.cyan("/uzys:spec")}`));
  log("");
}
function formatAssetMeta(asset, version) {
  const m = asset.method;
  const v2 = version ? ` ${c.dim(`v${version.replace(/^v/, "")}`)}` : "";
  switch (m.kind) {
    case "skill":
      if (m.skill && m.skill !== asset.id) return `skill \xB7 ${m.source} \xB7 ${m.skill}`;
      return `skill \xB7 ${m.source}`;
    case "plugin":
      return `plugin \xB7 ${m.pluginId}${v2}`;
    case "npm":
      return `npm -g \xB7 ${m.pkg}${v2}`;
    case "npx-run":
      return `npx \xB7 ${m.cmd}`;
    case "shell-script":
      return `bash \xB7 ${m.script}`;
  }
}
function renderPhase1Rows(log, baseline, verbose = false, withEcc = false) {
  if (baseline.updateMode) {
    if (baseline.backup) {
      log(assetRow("success", "backup", shortenPath(baseline.backup)));
    }
    for (const [dir, count] of Object.entries(baseline.updateMode.updated)) {
      if (count > 0) log(assetRow("success", dir, `${count} files updated`));
    }
    for (const [dir, removed] of Object.entries(baseline.updateMode.pruned)) {
      if (removed.length > 0) {
        log(assetRow("skip", `${dir} orphan prune`, `${removed.length} removed`));
      }
    }
    if (baseline.updateMode.claudeMdUpdated) {
      log(assetRow("success", ".claude/CLAUDE.md", "refreshed from template"));
    }
    if (baseline.updateMode.staleHookRefs.length > 0) {
      log(
        assetRow(
          "skip",
          "settings.json stale hook refs",
          `${baseline.updateMode.staleHookRefs.length} removed`
        )
      );
    }
    return;
  }
  const cats = baseline.categories;
  if (cats) {
    const phase1Row = (label, count, useText, files) => {
      const labelCol = `${c.bold(label)} ${c.dim(`(${count})`)}`;
      const padded = padDisplay(labelCol, 28);
      log(`  ${c.green("\u2713")} ${padded} ${c.dim(useText)}`);
      if (verbose && files && files.length > 0) {
        log(`      ${c.dim("\u2514 files:")} ${c.dim(files.join(", "))}`);
      }
    };
    if (cats.rules.length > 0) {
      phase1Row(
        "rules",
        cats.rules.length,
        "coding \xB7 git/PR \xB7 tests \xB7 ship checklist \xB7 MCP policy",
        cats.rules
      );
    }
    if (cats.agents.length > 0) {
      phase1Row(
        "agents",
        cats.agents.length,
        "SOD reviewer (opus, independent verifier) + 3 base",
        cats.agents
      );
    }
    if (cats.hooks.length > 0) {
      phase1Row(
        "hooks",
        cats.hooks.length,
        "session-start \xB7 gate-check (6-Gate order) \xB7 spec-drift \xB7 agentshield (security)",
        cats.hooks
      );
    }
    if (cats.commands > 0) {
      phase1Row("commands", cats.commands, "uzys-harness option: /uzys:* (7)");
    }
    if (cats.skills.length > 0) {
      phase1Row(
        "skills",
        cats.skills.length,
        "north-star \xB7 gh-issue-workflow \xB7 ui-visual-review \xB7 cl-v2 (modified)",
        cats.skills
      );
    }
  } else {
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  const TEMPLATES_COL = 28;
  if (baseline.rootClaudeMd) {
    const n = baseline.rootClaudeMd.tracks.length;
    log(
      assetRow(
        "success",
        "CLAUDE.md (root)",
        `merged from ${n} track${n > 1 ? "s" : ""}`,
        TEMPLATES_COL
      )
    );
  }
  if (baseline.skipped > 0) {
    log(
      assetRow(
        "skip",
        "manifest entries (applies \u2192 false)",
        `${baseline.skipped} skipped`,
        TEMPLATES_COL
      )
    );
  }
  if (baseline.backup) {
    log(assetRow("success", "backup", shortenPath(baseline.backup), TEMPLATES_COL));
  }
  const mcpList = baseline.mcpServers.join(", ") || "(none)";
  log(assetRow("success", ".mcp.json", mcpList, TEMPLATES_COL));
  if (baseline.envFiles.mcpAllowlist) {
    log(
      assetRow(
        "success",
        ".mcp-allowlist",
        `${baseline.envFiles.mcpAllowlist.length} servers (D35 opt-in gate)`,
        TEMPLATES_COL
      )
    );
  }
  if (!withEcc && baseline.categories) {
    log("");
    log(
      `  ${c.dim("\xB7")} ${c.dim("ECC plugin not selected \u2014 cherry-pick fallback active (up to 4 agents + 8 skills + 3 commands)")}`
    );
    log(`  ${c.dim("\xB7")} ${c.dim("Use --with-ecc to install ECC plugin instead")}`);
  }
  if (baseline.envFiles.envExampleCreated) {
    log(assetRow("success", ".env.example", "Supabase token guide"));
  }
  if (baseline.envFiles.gitignoreEnvAdded) {
    log(assetRow("success", ".gitignore", "+ .env"));
  }
  if (baseline.envFiles.gitignoreNpxSkillsAdded.length > 0) {
    log(
      assetRow(
        "success",
        ".gitignore",
        `+ ${baseline.envFiles.gitignoreNpxSkillsAdded.join(" ")} (npx skills universal install)`
      )
    );
  }
  log("");
}
function resolveScopeOption(value, err) {
  if (value === void 0) return "project";
  if (isInstallScope(value)) return value;
  err(
    c.yellow(`[WARN] Unknown --scope value '${value}' (expected: project, global). Using project.`)
  );
  return "project";
}
function normalizeRepeatable(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))];
}
function computeFinalAssets(spec) {
  const recommended = new Set(recommendedExternalAssets(spec.tracks));
  if (spec.userOverride) {
    for (const id of spec.userOverride.forceExclude) recommended.delete(id);
    for (const id of spec.userOverride.forceInclude) recommended.add(id);
  }
  return [...recommended].sort();
}
function groupAssetsByCategory(assetIds) {
  const map = /* @__PURE__ */ new Map();
  for (const id of assetIds) {
    const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
    const cat = asset?.category ?? "other";
    const list = map.get(cat) ?? [];
    list.push(id);
    map.set(cat, list);
  }
  return [...map.entries()];
}
function formatOptions(spec) {
  const flags = [];
  if (spec.options.withTauri) flags.push("tauri");
  if (spec.options.withGsd) flags.push("gsd");
  if (spec.options.withEcc) flags.push("ecc");
  if (spec.options.withPrune) flags.push("prune");
  if (spec.options.withTob) flags.push("tob");
  if (spec.options.withKarpathyHook) flags.push("karpathy-hook");
  if (spec.options.withAddyAgentSkills) flags.push("addy-agent-skills");
  if (spec.options.withUzysHarness) flags.push("uzys-harness");
  if (spec.options.withSuperpowers) flags.push("superpowers");
  return flags.length > 0 ? flags.join(", ") : c.dim("(none added)");
}
function shortenPath(p2) {
  if (p2.length <= 50) return p2;
  const home = process.env.HOME ?? "";
  if (home && p2.startsWith(home)) {
    const rel = p2.slice(home.length);
    return `~${rel.startsWith("/") ? "" : "/"}${rel}`;
  }
  if (p2.startsWith("/private/tmp/")) {
    return p2.slice("/private".length);
  }
  const segs = p2.split("/").filter(Boolean);
  if (segs.length > 3) {
    return `\u2026/${segs.slice(-3).join("/")}`;
  }
  return p2;
}
function formatCliPhaseTitle(targets) {
  const hasCodex = targets.includes("codex");
  const hasOpenCode = targets.includes("opencode");
  if (hasCodex && hasOpenCode) return "Codex + OpenCode artifacts";
  if (hasCodex) return "Codex artifacts";
  if (hasOpenCode) return "OpenCode artifacts";
  return "CLI artifacts";
}
function defaultRunPipeline(spec, harnessRoot, mode, callbacks) {
  const ctx = {
    harnessRoot,
    projectDir: spec.projectDir,
    spec
  };
  if (mode) ctx.mode = mode;
  if (callbacks?.onProgress) ctx.onProgress = callbacks.onProgress;
  if (callbacks?.externalDeps) ctx.externalDeps = callbacks.externalDeps;
  return runInstall(ctx);
}
function defaultHarnessRoot() {
  return resolve2(new URL(".", import.meta.url).pathname, "..");
}
function registerInstallCommand(cli2) {
  cli2.command("install", "Install harness assets into a project").option("--track <name>", "[Track] Track to install (repeatable)", { type: [String] }).option("--cli <target>", "[CLI] Target CLI (repeatable): claude | codex | opencode", {
    type: [String],
    default: "claude"
  }).option("--project-dir <path>", "[Project] Target project directory", {
    default: process.cwd()
  }).option(
    "--scope <scope>",
    "[Scope] Installation scope: project (default) | global. ADR-020 / NORTH_STAR D16",
    { default: "project" }
  ).option(
    "--with <asset-id>",
    "[Asset] Force-include External Asset id (regardless of preset). Repeatable. v26.47.0+"
  ).option(
    "--without <asset-id>",
    "[Asset] Force-exclude External Asset id (drop from preset recommendation). Repeatable. v26.47.0+"
  ).option(
    "--with-codex-prompts",
    "[Codex] Unify Codex slash (~/.codex/prompts/uzys-*.md). v26.46.0+ default ON when --cli codex"
  ).option(
    "--no-codex-prompts",
    "[Codex] Disable Codex slash default ON (skip global copy even with --cli codex)"
  ).option(
    "--with-codex-skills",
    "[Codex] Codex global opt-in: copy uzys-* skills to ~/.codex/skills/"
  ).option(
    "--with-codex-trust",
    "[Codex] Codex global opt-in: register trust entry in ~/.codex/config.toml"
  ).option(
    "--with-uzys-harness",
    "[Workflow] uzys-harness 6-Gate slash (/uzys:spec ... /uzys:ship). v26.44.0 BREAKING"
  ).option(
    "--with-addy-agent-skills",
    "[Workflow] addyosmani/agent-skills (/spec /plan /build slash). v26.42.0 BREAKING"
  ).option(
    "--with-superpowers",
    "[Workflow] obra/superpowers (registered in Anthropic official marketplace)"
  ).option(
    "--with-antigravity-global",
    "[Workflow] Antigravity global opt-in: copy uzys-* to ~/.gemini/antigravity/{skills,global_workflows}/. Requires --cli antigravity + --scope global. (v26.67.0+)"
  ).option("--with-gsd", "[Workflow] GSD orchestrator (for large projects)").option("--with-ecc", "[ECC] ECC plugin (project-scoped)").option("--with-prune", "[ECC] Prune ECC items beyond curated 89 (implies --with-ecc)").option("--with-tob", "[Dev Tools] Trail of Bits differential security review").option(
    "--with-karpathy-hook",
    "[Dev Tools] karpathy-coder pre-commit hook (.claude/settings.json PreToolUse Write|Edit)"
  ).option("--with-tauri", "[Misc] Tauri desktop rule (csr-*/full)").option("--verbose", "[Misc] Show installed file lists per category (default: counts only)").example("install --track tooling --with-uzys-harness").example("install --track csr-supabase --cli claude --cli codex").example("install --track csr-supabase --without netlify-cli --with railway-skills").example("install --track full --no-codex-prompts").action((options) => installAction(options));
}

// src/commands/uninstall.ts
init_esm_shims();
import { spawnSync as spawnSync2 } from "child_process";
import { existsSync as existsSync15, readFileSync as readFileSync14, rmSync } from "fs";
import { join as join13, resolve as resolve3 } from "path";
function uninstallAction(options, deps = {}) {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const spawn = deps.spawn ?? defaultSpawn2;
  const rm = deps.rm ?? defaultRm;
  const projectDir = resolve3(options.projectDir ?? process.cwd());
  const installLog = readInstallLog(projectDir);
  if (!installLog) {
    err(status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)));
    err(c.dim("       Was this project installed by claude-harness? Nothing to uninstall."));
    exit(1);
    return;
  }
  const { reverseSteps, globalAdvisories } = planReverse(installLog, spawn, rm, projectDir);
  log("");
  log(c.bold("uzys-claude-harness \xB7 uninstall"));
  log("");
  log(c.dim(`  installed: ${installLog.installedAt}`));
  log(c.dim(`  scope:     ${installLog.scope}`));
  log(c.dim(`  assets:    ${installLog.assets.length}`));
  log("");
  if (options.dryRun) {
    log(c.yellow("[DRY RUN] reverse list (\uC2E4\uC81C \uBCC0\uACBD \uC5C6\uC74C):"));
    log("");
    if (reverseSteps.length === 0) {
      log(c.dim("  (no project-scope assets to reverse)"));
    }
    for (const step of reverseSteps) {
      log(`  \u25CB ${step.label}`);
    }
    if (!options.keepTemplates) {
      log(`  \u25CB remove templates: ${formatTemplateList(installLog)}`);
      if (installLog.templates.rootClaudeMd) {
        log(
          rootClaudeMdModified(installLog, projectDir) ? "  \u25CB keep CLAUDE.md (modified since install \u2014 preserved)" : "  \u25CB remove CLAUDE.md"
        );
      }
    }
    if (globalAdvisories.length > 0) {
      log("");
      log(
        c.yellow(
          `[GLOBAL] ${globalAdvisories.length} asset(s) at scope=global \u2014 manual removal required (D16):`
        )
      );
      for (const adv of globalAdvisories) {
        log(c.dim(`  \xB7 ${adv.asset.id} (${adv.asset.method})  \u2192  ${adv.command}`));
      }
    }
    log("");
    exit(0);
    return;
  }
  let succeeded = 0;
  let failed = 0;
  for (const step of reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success("\u2713")} ${step.label}`);
      succeeded++;
    } else {
      log(`  ${c.yellow("\u2298")} ${step.label}  (${result.message ?? "failed"})`);
      failed++;
    }
  }
  if (!options.keepTemplates) {
    const { rootClaudeMdKept } = removeTemplates(installLog, projectDir, rm);
    log(`  ${status.success("\u2713")} templates removed: ${formatTemplateList(installLog)}`);
    if (rootClaudeMdKept) {
      log(
        `  ${c.yellow("\u2298")} CLAUDE.md kept \u2014 modified since install. Remove manually if intended.`
      );
    }
  }
  if (options.keepTemplates) {
    rm(installLogPath(projectDir));
    log(`  ${status.success("\u2713")} install log removed (templates kept)`);
  }
  if (globalAdvisories.length > 0) {
    log("");
    log(
      c.yellow(
        `[GLOBAL] ${globalAdvisories.length} asset(s) at scope=global \u2014 manual removal required (D16):`
      )
    );
    for (const adv of globalAdvisories) {
      log(c.dim(`  \xB7 ${adv.asset.id} (${adv.asset.method})`));
      log(c.dim(`      ${adv.command}`));
    }
  }
  log("");
  log(
    succeeded === reverseSteps.length && failed === 0 ? status.success(c.green(`uninstall complete (${succeeded} asset(s))`)) : c.yellow(`uninstall finished with ${failed} skip(s) (${succeeded} ok)`)
  );
  exit(failed === 0 ? 0 : 1);
}
function planReverse(log, spawn, _rm, _projectDir) {
  const reverseSteps = [];
  const globalAdvisories = [];
  for (const asset of log.assets) {
    if (asset.scope === "global") {
      globalAdvisories.push({ asset, command: buildGlobalAdvisoryCmd(asset) });
      continue;
    }
    const step = buildProjectReverseStep(asset, spawn);
    if (step) reverseSteps.push(step);
  }
  return { reverseSteps, globalAdvisories };
}
function buildProjectReverseStep(asset, spawn) {
  switch (asset.method) {
    case "plugin": {
      const pluginId = asset.detail.pluginId ?? asset.id;
      return {
        label: `claude plugin uninstall --scope project ${pluginId}`,
        execute: () => {
          const r = spawn("claude", ["plugin", "uninstall", "--scope", "project", pluginId]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        }
      };
    }
    case "skill": {
      const source = asset.detail.source ?? asset.id;
      return {
        label: `npx skills remove ${source}`,
        execute: () => {
          const r = spawn("npx", ["skills", "remove", source, "--yes"]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        }
      };
    }
    case "npm": {
      const pkg = asset.detail.pkg ?? asset.id;
      return {
        label: `npm uninstall --save-dev ${pkg}`,
        execute: () => {
          const r = spawn("npm", ["uninstall", "--save-dev", pkg]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        }
      };
    }
    case "npx-run":
      return null;
    case "shell-script":
      return null;
  }
}
function buildGlobalAdvisoryCmd(asset) {
  switch (asset.method) {
    case "plugin": {
      const pid = asset.detail.pluginId ?? asset.id;
      return `claude plugin uninstall --scope user ${pid}`;
    }
    case "skill": {
      const s = asset.detail.source ?? asset.id;
      return `npx skills remove -g ${s}`;
    }
    case "npm": {
      const pkg = asset.detail.pkg ?? asset.id;
      return `npm uninstall -g ${pkg}`;
    }
    case "npx-run":
    case "shell-script":
      return "(no standard reverse \u2014 manual)";
  }
}
function removeTemplates(log, projectDir, rm) {
  rm(join13(projectDir, log.templates.claudeDir));
  if (log.templates.codexDir) rm(join13(projectDir, log.templates.codexDir));
  if (log.templates.opencodeDir) rm(join13(projectDir, log.templates.opencodeDir));
  const rootMd = log.templates.rootClaudeMd;
  if (rootMd) {
    if (rootClaudeMdModified(log, projectDir)) return { rootClaudeMdKept: true };
    rm(join13(projectDir, rootMd.path));
  }
  return { rootClaudeMdKept: false };
}
function rootClaudeMdModified(log, projectDir) {
  const rootMd = log.templates.rootClaudeMd;
  if (!rootMd) return false;
  const path2 = join13(projectDir, rootMd.path);
  if (!existsSync15(path2)) return false;
  return hashContent(readFileSync14(path2, "utf8")) !== rootMd.sha256;
}
function formatTemplateList(log) {
  const items = [log.templates.claudeDir];
  if (log.templates.codexDir) items.push(log.templates.codexDir);
  if (log.templates.opencodeDir) items.push(log.templates.opencodeDir);
  return items.join(", ");
}
function defaultSpawn2(cmd, args) {
  return spawnSync2(cmd, [...args], { encoding: "utf8", stdio: "pipe", timeout: 12e4 });
}
function defaultRm(path2) {
  if (existsSync15(path2)) {
    rmSync(path2, { recursive: true, force: true });
  }
}
function registerUninstallCommand(cli2) {
  cli2.command("uninstall", "Uninstall harness assets (log-based reverse)").option("--project-dir <path>", "[Project] Target project directory", {
    default: process.cwd()
  }).option("--dry-run", "[Mode] List reverse steps without executing").option(
    "--keep-templates",
    "[Mode] Keep `.claude/`, `.codex/`, `.opencode/` templates (remove only external assets)"
  ).action((options) => {
    uninstallAction(options);
  });
}

// src/interactive.ts
init_esm_shims();

// src/prompts.ts
init_esm_shims();

// node_modules/@clack/prompts/dist/index.mjs
init_esm_shims();

// node_modules/@clack/core/dist/index.mjs
init_esm_shims();
import { styleText as v } from "util";
import { stdout as S, stdin as D } from "process";
import * as b from "readline";
import E from "readline";

// node_modules/fast-wrap-ansi/lib/main.js
init_esm_shims();

// node_modules/fast-string-width/dist/index.js
init_esm_shims();

// node_modules/fast-string-truncated-width/dist/index.js
init_esm_shims();

// node_modules/fast-string-truncated-width/dist/utils.js
init_esm_shims();
var getCodePointsLength = /* @__PURE__ */ (() => {
  const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  return (input) => {
    let surrogatePairsNr = 0;
    SURROGATE_PAIR_RE.lastIndex = 0;
    while (SURROGATE_PAIR_RE.test(input)) {
      surrogatePairsNr += 1;
    }
    return input.length - surrogatePairsNr;
  };
})();
var isFullWidth = (x) => {
  return x === 12288 || x >= 65281 && x <= 65376 || x >= 65504 && x <= 65510;
};
var isWideNotCJKTNotEmoji = (x) => {
  return x === 8987 || x === 9001 || x >= 12272 && x <= 12287 || x >= 12289 && x <= 12350 || x >= 12441 && x <= 12543 || x >= 12549 && x <= 12591 || x >= 12593 && x <= 12686 || x >= 12688 && x <= 12771 || x >= 12783 && x <= 12830 || x >= 12832 && x <= 12871 || x >= 12880 && x <= 19903 || x >= 65040 && x <= 65049 || x >= 65072 && x <= 65106 || x >= 65108 && x <= 65126 || x >= 65128 && x <= 65131 || x >= 127488 && x <= 127490 || x >= 127504 && x <= 127547 || x >= 127552 && x <= 127560 || x >= 131072 && x <= 196605 || x >= 196608 && x <= 262141;
};

// node_modules/fast-string-truncated-width/dist/index.js
var ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
var CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
var CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
var TAB_RE = /\t{1,1000}/y;
var EMOJI_RE = new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F\\u20E3?))*", "yu");
var LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
var MODIFIER_RE = new RegExp("\\p{M}+", "gu");
var NO_TRUNCATION = { limit: Infinity, ellipsis: "" };
var getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
  const LIMIT = truncationOptions.limit ?? Infinity;
  const ELLIPSIS = truncationOptions.ellipsis ?? "";
  const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
  const ANSI_WIDTH = 0;
  const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
  const TAB_WIDTH = widthOptions.tabWidth ?? 8;
  const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
  const FULL_WIDTH_WIDTH = 2;
  const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
  const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
  const PARSE_BLOCKS = [
    [LATIN_RE, REGULAR_WIDTH],
    [ANSI_RE, ANSI_WIDTH],
    [CONTROL_RE, CONTROL_WIDTH],
    [TAB_RE, TAB_WIDTH],
    [EMOJI_RE, EMOJI_WIDTH],
    [CJKT_WIDE_RE, WIDE_WIDTH]
  ];
  let indexPrev = 0;
  let index = 0;
  let length = input.length;
  let lengthExtra = 0;
  let truncationEnabled = false;
  let truncationIndex = length;
  let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
  let unmatchedStart = 0;
  let unmatchedEnd = 0;
  let width = 0;
  let widthExtra = 0;
  outer: while (true) {
    if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
      const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
      lengthExtra = 0;
      for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
        const codePoint = char.codePointAt(0) || 0;
        if (isFullWidth(codePoint)) {
          widthExtra = FULL_WIDTH_WIDTH;
        } else if (isWideNotCJKTNotEmoji(codePoint)) {
          widthExtra = WIDE_WIDTH;
        } else {
          widthExtra = REGULAR_WIDTH;
        }
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        lengthExtra += char.length;
        width += widthExtra;
      }
      unmatchedStart = unmatchedEnd = 0;
    }
    if (index >= length) {
      break outer;
    }
    for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
      const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
      BLOCK_RE.lastIndex = index;
      if (BLOCK_RE.test(input)) {
        lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
        widthExtra = lengthExtra * BLOCK_WIDTH;
        if (width + widthExtra > truncationLimit) {
          truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
        }
        if (width + widthExtra > LIMIT) {
          truncationEnabled = true;
          break outer;
        }
        width += widthExtra;
        unmatchedStart = indexPrev;
        unmatchedEnd = index;
        index = indexPrev = BLOCK_RE.lastIndex;
        continue outer;
      }
    }
    index += 1;
  }
  return {
    width: truncationEnabled ? truncationLimit : width,
    index: truncationEnabled ? truncationIndex : length,
    truncated: truncationEnabled,
    ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
  };
};
var dist_default = getStringTruncatedWidth;

// node_modules/fast-string-width/dist/index.js
var NO_TRUNCATION2 = {
  limit: Infinity,
  ellipsis: "",
  ellipsisWidth: 0
};
var fastStringWidth = (input, options = {}) => {
  return dist_default(input, NO_TRUNCATION2, options).width;
};
var dist_default2 = fastStringWidth;

// node_modules/fast-wrap-ansi/lib/main.js
var ESC = "\x1B";
var CSI = "\x9B";
var END_CODE = 39;
var ANSI_ESCAPE_BELL = "\x07";
var ANSI_CSI = "[";
var ANSI_OSC = "]";
var ANSI_SGR_TERMINATOR = "m";
var ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
var GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
var getClosingCode = (openingCode) => {
  if (openingCode >= 30 && openingCode <= 37)
    return 39;
  if (openingCode >= 90 && openingCode <= 97)
    return 39;
  if (openingCode >= 40 && openingCode <= 47)
    return 49;
  if (openingCode >= 100 && openingCode <= 107)
    return 49;
  if (openingCode === 1 || openingCode === 2)
    return 22;
  if (openingCode === 3)
    return 23;
  if (openingCode === 4)
    return 24;
  if (openingCode === 7)
    return 27;
  if (openingCode === 8)
    return 28;
  if (openingCode === 9)
    return 29;
  if (openingCode === 0)
    return 0;
  return void 0;
};
var wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
var wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
var wrapWord = (rows, word, columns) => {
  const characters = word[Symbol.iterator]();
  let isInsideEscape = false;
  let isInsideLinkEscape = false;
  let lastRow = rows.at(-1);
  let visible = lastRow === void 0 ? 0 : dist_default2(lastRow);
  let currentCharacter = characters.next();
  let nextCharacter = characters.next();
  let rawCharacterIndex = 0;
  while (!currentCharacter.done) {
    const character = currentCharacter.value;
    const characterLength = dist_default2(character);
    if (visible + characterLength <= columns) {
      rows[rows.length - 1] += character;
    } else {
      rows.push(character);
      visible = 0;
    }
    if (character === ESC || character === CSI) {
      isInsideEscape = true;
      isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
    }
    if (isInsideEscape) {
      if (isInsideLinkEscape) {
        if (character === ANSI_ESCAPE_BELL) {
          isInsideEscape = false;
          isInsideLinkEscape = false;
        }
      } else if (character === ANSI_SGR_TERMINATOR) {
        isInsideEscape = false;
      }
    } else {
      visible += characterLength;
      if (visible === columns && !nextCharacter.done) {
        rows.push("");
        visible = 0;
      }
    }
    currentCharacter = nextCharacter;
    nextCharacter = characters.next();
    rawCharacterIndex += character.length;
  }
  lastRow = rows.at(-1);
  if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) {
    rows[rows.length - 2] += rows.pop();
  }
};
var stringVisibleTrimSpacesRight = (string) => {
  const words = string.split(" ");
  let last = words.length;
  while (last) {
    if (dist_default2(words[last - 1])) {
      break;
    }
    last--;
  }
  if (last === words.length) {
    return string;
  }
  return words.slice(0, last).join(" ") + words.slice(last).join("");
};
var exec = (string, columns, options = {}) => {
  if (options.trim !== false && string.trim() === "") {
    return "";
  }
  let returnValue = "";
  let escapeCode;
  let escapeUrl;
  const words = string.split(" ");
  let rows = [""];
  let rowLength = 0;
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (options.trim !== false) {
      const row = rows.at(-1) ?? "";
      const trimmed = row.trimStart();
      if (row.length !== trimmed.length) {
        rows[rows.length - 1] = trimmed;
        rowLength = dist_default2(trimmed);
      }
    }
    if (index !== 0) {
      if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
        rows.push("");
        rowLength = 0;
      }
      if (rowLength || options.trim === false) {
        rows[rows.length - 1] += " ";
        rowLength++;
      }
    }
    const wordLength = dist_default2(word);
    if (options.hard && wordLength > columns) {
      const remainingColumns = columns - rowLength;
      const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
      const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
      if (breaksStartingNextLine < breaksStartingThisLine) {
        rows.push("");
      }
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    if (rowLength + wordLength > columns && rowLength && wordLength) {
      if (options.wordWrap === false && rowLength < columns) {
        wrapWord(rows, word, columns);
        rowLength = dist_default2(rows.at(-1) ?? "");
        continue;
      }
      rows.push("");
      rowLength = 0;
    }
    if (rowLength + wordLength > columns && options.wordWrap === false) {
      wrapWord(rows, word, columns);
      rowLength = dist_default2(rows.at(-1) ?? "");
      continue;
    }
    rows[rows.length - 1] += word;
    rowLength += wordLength;
  }
  if (options.trim !== false) {
    rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
  }
  const preString = rows.join("\n");
  let inSurrogate = false;
  for (let i = 0; i < preString.length; i++) {
    const character = preString[i];
    returnValue += character;
    if (!inSurrogate) {
      inSurrogate = character >= "\uD800" && character <= "\uDBFF";
      if (inSurrogate) {
        continue;
      }
    } else {
      inSurrogate = false;
    }
    if (character === ESC || character === CSI) {
      GROUP_REGEX.lastIndex = i + 1;
      const groupsResult = GROUP_REGEX.exec(preString);
      const groups = groupsResult?.groups;
      if (groups?.code !== void 0) {
        const code = Number.parseFloat(groups.code);
        escapeCode = code === END_CODE ? void 0 : code;
      } else if (groups?.uri !== void 0) {
        escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
      }
    }
    if (preString[i + 1] === "\n") {
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink("");
      }
      const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
      if (escapeCode && closingCode) {
        returnValue += wrapAnsiCode(closingCode);
      }
    } else if (character === "\n") {
      if (escapeCode && getClosingCode(escapeCode)) {
        returnValue += wrapAnsiCode(escapeCode);
      }
      if (escapeUrl) {
        returnValue += wrapAnsiHyperlink(escapeUrl);
      }
    }
  }
  return returnValue;
};
var CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
  return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}

// node_modules/@clack/core/dist/index.mjs
var import_sisteransi = __toESM(require_src(), 1);
import { ReadStream as O } from "tty";
function d(r, t, s) {
  if (!s.some((o) => !o.disabled)) return r;
  const e2 = r + t, i = Math.max(s.length - 1, 0), n = e2 < 0 ? i : e2 > i ? 0 : e2;
  return s[n].disabled ? d(n, t < 0 ? -1 : 1, s) : n;
}
var G = ["up", "down", "left", "right", "space", "enter", "cancel"];
var K = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var h = { actions: new Set(G), aliases: /* @__PURE__ */ new Map([["k", "up"], ["j", "down"], ["h", "left"], ["l", "right"], ["", "cancel"], ["escape", "cancel"]]), messages: { cancel: "Canceled", error: "Something went wrong" }, withGuide: true, date: { monthNames: [...K], messages: { required: "Please enter a valid date", invalidMonth: "There are only 12 months in a year", invalidDay: (r, t) => `There are only ${r} days in ${t}`, afterMin: (r) => `Date must be on or after ${r.toISOString().slice(0, 10)}`, beforeMax: (r) => `Date must be on or before ${r.toISOString().slice(0, 10)}` } } };
function C(r, t) {
  if (typeof r == "string") return h.aliases.get(r) === t;
  for (const s of r) if (s !== void 0 && C(s, t)) return true;
  return false;
}
function z(r, t) {
  if (r === t) return;
  const s = r.split(`
`), e2 = t.split(`
`), i = Math.max(s.length, e2.length), n = [];
  for (let o = 0; o < i; o++) s[o] !== e2[o] && n.push(o);
  return { lines: n, numLinesBefore: s.length, numLinesAfter: e2.length, numLines: i };
}
var Y = globalThis.process.platform.startsWith("win");
var k = /* @__PURE__ */ Symbol("clack:cancel");
function q(r) {
  return r === k;
}
function w(r, t) {
  const s = r;
  s.isTTY && s.setRawMode(t);
}
var A = (r) => "columns" in r && typeof r.columns == "number" ? r.columns : 80;
var L = (r) => "rows" in r && typeof r.rows == "number" ? r.rows : 20;
function W(r, t, s, e2 = s, i) {
  const n = A(r ?? S);
  return wrapAnsi(t, n - s.length, { hard: true, trim: false }).split(`
`).map((o, u) => {
    const a = i ? i(o, u) : o;
    return `${u === 0 ? e2 : s}${a}`;
  }).join(`
`);
}
var p = class {
  input;
  output;
  _abortSignal;
  rl;
  opts;
  _render;
  _track = false;
  _prevFrame = "";
  _subscribers = /* @__PURE__ */ new Map();
  _cursor = 0;
  state = "initial";
  error = "";
  value;
  userInput = "";
  constructor(t, s = true) {
    const { input: e2 = D, output: i = S, render: n, signal: o, ...u } = t;
    this.opts = u, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = n.bind(this), this._track = s, this._abortSignal = o, this.input = e2, this.output = i;
  }
  unsubscribe() {
    this._subscribers.clear();
  }
  setSubscriber(t, s) {
    const e2 = this._subscribers.get(t) ?? [];
    e2.push(s), this._subscribers.set(t, e2);
  }
  on(t, s) {
    this.setSubscriber(t, { cb: s });
  }
  once(t, s) {
    this.setSubscriber(t, { cb: s, once: true });
  }
  emit(t, ...s) {
    const e2 = this._subscribers.get(t) ?? [], i = [];
    for (const n of e2) n.cb(...s), n.once && i.push(() => e2.splice(e2.indexOf(n), 1));
    for (const n of i) n();
  }
  prompt() {
    return new Promise((t) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted) return this.state = "cancel", this.close(), t(k);
        this._abortSignal.addEventListener("abort", () => {
          this.state = "cancel", this.close();
        }, { once: true });
      }
      this.rl = E.createInterface({ input: this.input, tabSize: 2, prompt: "", escapeCodeTimeout: 50, terminal: true }), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), w(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), w(this.input, false), t(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), w(this.input, false), t(k);
      });
    });
  }
  _isActionKey(t, s) {
    return t === "	";
  }
  _shouldSubmit(t, s) {
    return true;
  }
  _setValue(t) {
    this.value = t, this.emit("value", this.value);
  }
  _setUserInput(t, s) {
    this.userInput = t ?? "", this.emit("userInput", this.userInput), s && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
  }
  _clearUserInput() {
    this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
  }
  onKeypress(t, s) {
    if (this._track && s.name !== "return" && (s.name && this._isActionKey(t, s) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), s?.name && (!this._track && h.aliases.has(s.name) && this.emit("cursor", h.aliases.get(s.name)), h.actions.has(s.name) && this.emit("cursor", s.name)), t && (t.toLowerCase() === "y" || t.toLowerCase() === "n") && this.emit("confirm", t.toLowerCase() === "y"), this.emit("key", t?.toLowerCase(), s), s?.name === "return" && this._shouldSubmit(t, s)) {
      if (this.opts.validate) {
        const e2 = this.opts.validate(this.value);
        e2 && (this.error = e2 instanceof Error ? e2.message : e2, this.state = "error", this.rl?.write(this.userInput));
      }
      this.state !== "error" && (this.state = "submit");
    }
    C([t, s?.name, s?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), w(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const t = wrapAnsi(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, t * -1));
  }
  render() {
    const t = wrapAnsi(this._render(this) ?? "", process.stdout.columns, { hard: true, trim: false });
    if (t !== this._prevFrame) {
      if (this.state === "initial") this.output.write(import_sisteransi.cursor.hide);
      else {
        const s = z(this._prevFrame, t), e2 = L(this.output);
        if (this.restoreCursor(), s) {
          const i = Math.max(0, s.numLinesAfter - e2), n = Math.max(0, s.numLinesBefore - e2);
          let o = s.lines.find((u) => u >= i);
          if (o === void 0) {
            this._prevFrame = t;
            return;
          }
          if (s.lines.length === 1) {
            this.output.write(import_sisteransi.cursor.move(0, o - n)), this.output.write(import_sisteransi.erase.lines(1));
            const u = t.split(`
`);
            this.output.write(u[o]), this._prevFrame = t, this.output.write(import_sisteransi.cursor.move(0, u.length - o - 1));
            return;
          } else if (s.lines.length > 1) {
            if (i < n) o = i;
            else {
              const a = o - n;
              a > 0 && this.output.write(import_sisteransi.cursor.move(0, a));
            }
            this.output.write(import_sisteransi.erase.down());
            const u = t.split(`
`).slice(o);
            this.output.write(u.join(`
`)), this._prevFrame = t;
            return;
          }
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(t), this.state === "initial" && (this.state = "active"), this._prevFrame = t;
    }
  }
};
var X = class extends p {
  get cursor() {
    return this.value ? 0 : 1;
  }
  get _value() {
    return this.cursor === 0;
  }
  constructor(t) {
    super(t, false), this.value = !!t.initialValue, this.on("userInput", () => {
      this.value = this._value;
    }), this.on("confirm", (s) => {
      this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = s, this.state = "submit", this.close();
    }), this.on("cursor", () => {
      this.value = !this.value;
    });
  }
};
var it = class extends p {
  options;
  cursor = 0;
  #s;
  getGroupItems(t) {
    return this.options.filter((s) => s.group === t);
  }
  isGroupSelected(t) {
    const s = this.getGroupItems(t), e2 = this.value;
    return e2 === void 0 ? false : s.every((i) => e2.includes(i.value));
  }
  toggleValue() {
    const t = this.options[this.cursor];
    if (this.value === void 0 && (this.value = []), t.group === true) {
      const s = t.value, e2 = this.getGroupItems(s);
      this.isGroupSelected(s) ? this.value = this.value.filter((i) => e2.findIndex((n) => n.value === i) === -1) : this.value = [...this.value, ...e2.map((i) => i.value)], this.value = Array.from(new Set(this.value));
    } else {
      const s = this.value.includes(t.value);
      this.value = s ? this.value.filter((e2) => e2 !== t.value) : [...this.value, t.value];
    }
  }
  constructor(t) {
    super(t, false);
    const { options: s } = t;
    this.#s = t.selectableGroups !== false, this.options = Object.entries(s).flatMap(([e2, i]) => [{ value: e2, group: true, label: e2 }, ...i.map((n) => ({ ...n, group: e2 }))]), this.value = [...t.initialValues ?? []], this.cursor = Math.max(this.options.findIndex(({ value: e2 }) => e2 === t.cursorAt), this.#s ? 0 : 1), this.on("cursor", (e2) => {
      switch (e2) {
        case "left":
        case "up": {
          this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
          const i = this.options[this.cursor]?.group === true;
          !this.#s && i && (this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1);
          break;
        }
        case "down":
        case "right": {
          this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
          const i = this.options[this.cursor]?.group === true;
          !this.#s && i && (this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1);
          break;
        }
        case "space":
          this.toggleValue();
          break;
      }
    });
  }
};
var nt = class extends p {
  options;
  cursor = 0;
  get _value() {
    return this.options[this.cursor].value;
  }
  get _enabledOptions() {
    return this.options.filter((t) => t.disabled !== true);
  }
  toggleAll() {
    const t = this._enabledOptions, s = this.value !== void 0 && this.value.length === t.length;
    this.value = s ? [] : t.map((e2) => e2.value);
  }
  toggleInvert() {
    const t = this.value;
    if (!t) return;
    const s = this._enabledOptions.filter((e2) => !t.includes(e2.value));
    this.value = s.map((e2) => e2.value);
  }
  toggleValue() {
    this.value === void 0 && (this.value = []);
    const t = this.value.includes(this._value);
    this.value = t ? this.value.filter((s) => s !== this._value) : [...this.value, this._value];
  }
  constructor(t) {
    super(t, false), this.options = t.options, this.value = [...t.initialValues ?? []];
    const s = Math.max(this.options.findIndex(({ value: e2 }) => e2 === t.cursorAt), 0);
    this.cursor = this.options[s].disabled ? d(s, 1, this.options) : s, this.on("key", (e2) => {
      e2 === "a" && this.toggleAll(), e2 === "i" && this.toggleInvert();
    }), this.on("cursor", (e2) => {
      switch (e2) {
        case "left":
        case "up":
          this.cursor = d(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = d(this.cursor, 1, this.options);
          break;
        case "space":
          this.toggleValue();
          break;
      }
    });
  }
};
var ut = class extends p {
  options;
  cursor = 0;
  get _selectedValue() {
    return this.options[this.cursor];
  }
  changeValue() {
    this.value = this._selectedValue.value;
  }
  constructor(t) {
    super(t, false), this.options = t.options;
    const s = this.options.findIndex(({ value: i }) => i === t.initialValue), e2 = s === -1 ? 0 : s;
    this.cursor = this.options[e2].disabled ? d(e2, 1, this.options) : e2, this.changeValue(), this.on("cursor", (i) => {
      switch (i) {
        case "left":
        case "up":
          this.cursor = d(this.cursor, -1, this.options);
          break;
        case "down":
        case "right":
          this.cursor = d(this.cursor, 1, this.options);
          break;
      }
      this.changeValue();
    });
  }
};

// node_modules/@clack/prompts/dist/index.mjs
import { styleText as e, stripVTControlCharacters as nt2 } from "util";
import j2 from "process";
var import_sisteransi2 = __toESM(require_src(), 1);
import { existsSync as zt, lstatSync as wt, readdirSync as Qt } from "fs";
import { dirname as bt, join as Zt } from "path";
function te() {
  return j2.platform !== "win32" ? j2.env.TERM !== "linux" : !!j2.env.CI || !!j2.env.WT_SESSION || !!j2.env.TERMINUS_SUBLIME || j2.env.ConEmuTask === "{cmd::Cmder}" || j2.env.TERM_PROGRAM === "Terminus-Sublime" || j2.env.TERM_PROGRAM === "vscode" || j2.env.TERM === "xterm-256color" || j2.env.TERM === "alacritty" || j2.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
var tt = te();
var w2 = (t, r) => tt ? t : r;
var _t = w2("\u25C6", "*");
var ot2 = w2("\u25A0", "x");
var ut2 = w2("\u25B2", "x");
var F = w2("\u25C7", "o");
var lt = w2("\u250C", "T");
var $ = w2("\u2502", "|");
var E2 = w2("\u2514", "\u2014");
var It = w2("\u2510", "T");
var Et = w2("\u2518", "\u2014");
var z2 = w2("\u25CF", ">");
var H = w2("\u25CB", " ");
var et2 = w2("\u25FB", "[\u2022]");
var U = w2("\u25FC", "[+]");
var J = w2("\u25FB", "[ ]");
var Gt = w2("\u25AA", "\u2022");
var st = w2("\u2500", "-");
var ct = w2("\u256E", "+");
var xt = w2("\u251C", "+");
var $t = w2("\u256F", "+");
var dt = w2("\u2570", "+");
var Ot = w2("\u256D", "+");
var ht2 = w2("\u25CF", "\u2022");
var pt = w2("\u25C6", "*");
var mt = w2("\u25B2", "!");
var gt = w2("\u25A0", "x");
var M = (t) => {
  switch (t) {
    case "initial":
    case "active":
      return e("cyan", _t);
    case "cancel":
      return e("red", ot2);
    case "error":
      return e("yellow", ut2);
    case "submit":
      return e("green", F);
  }
};
var yt = (t) => {
  switch (t) {
    case "initial":
    case "active":
      return e("cyan", $);
    case "cancel":
      return e("red", $);
    case "error":
      return e("yellow", $);
    case "submit":
      return e("green", $);
  }
};
var ee = (t, r, s, i, u) => {
  let n = r, o = 0;
  for (let c3 = s; c3 < i; c3++) {
    const a = t[c3];
    if (n = n - a.length, o++, n <= u) break;
  }
  return { lineCount: n, removals: o };
};
var Y2 = ({ cursor: t, options: r, style: s, output: i = process.stdout, maxItems: u = Number.POSITIVE_INFINITY, columnPadding: n = 0, rowPadding: o = 4 }) => {
  const c3 = A(i) - n, a = L(i), l = e("dim", "..."), d2 = Math.max(a - o, 0), y = Math.max(Math.min(u, d2), 5);
  let p2 = 0;
  t >= y - 3 && (p2 = Math.max(Math.min(t - y + 3, r.length - y), 0));
  let m = y < r.length && p2 > 0, g = y < r.length && p2 + y < r.length;
  const S2 = Math.min(p2 + y, r.length), h2 = [];
  let f = 0;
  m && f++, g && f++;
  const v2 = p2 + (m ? 1 : 0), T = S2 - (g ? 1 : 0);
  for (let b2 = v2; b2 < T; b2++) {
    const G2 = wrapAnsi(s(r[b2], b2 === t), c3, { hard: true, trim: false }).split(`
`);
    h2.push(G2), f += G2.length;
  }
  if (f > d2) {
    let b2 = 0, G2 = 0, x = f;
    const A2 = t - v2, P = (N, D2) => ee(h2, x, N, D2, d2);
    m ? ({ lineCount: x, removals: b2 } = P(0, A2), x > d2 && ({ lineCount: x, removals: G2 } = P(A2 + 1, h2.length))) : ({ lineCount: x, removals: G2 } = P(A2 + 1, h2.length), x > d2 && ({ lineCount: x, removals: b2 } = P(0, A2))), b2 > 0 && (m = true, h2.splice(0, b2)), G2 > 0 && (g = true, h2.splice(h2.length - G2, G2));
  }
  const C2 = [];
  m && C2.push(l);
  for (const b2 of h2) for (const G2 of b2) C2.push(G2);
  return g && C2.push(l), C2;
};
var ue = (t) => {
  const r = t.active ?? "Yes", s = t.inactive ?? "No";
  return new X({ active: r, inactive: s, signal: t.signal, input: t.input, output: t.output, initialValue: t.initialValue ?? true, render() {
    const i = t.withGuide ?? h.withGuide, u = `${M(this.state)}  `, n = i ? `${e("gray", $)}  ` : "", o = W(t.output, t.message, n, u), c3 = `${i ? `${e("gray", $)}
` : ""}${o}
`, a = this.value ? r : s;
    switch (this.state) {
      case "submit": {
        const l = i ? `${e("gray", $)}  ` : "";
        return `${c3}${l}${e("dim", a)}`;
      }
      case "cancel": {
        const l = i ? `${e("gray", $)}  ` : "";
        return `${c3}${l}${e(["strikethrough", "dim"], a)}${i ? `
${e("gray", $)}` : ""}`;
      }
      default: {
        const l = i ? `${e("cyan", $)}  ` : "", d2 = i ? e("cyan", E2) : "";
        return `${c3}${l}${this.value ? `${e("green", z2)} ${r}` : `${e("dim", H)} ${e("dim", r)}`}${t.vertical ? i ? `
${e("cyan", $)}  ` : `
` : ` ${e("dim", "/")} `}${this.value ? `${e("dim", H)} ${e("dim", s)}` : `${e("green", z2)} ${s}`}
${d2}
`;
      }
    }
  } }).prompt();
};
var pe = (t) => {
  const { selectableGroups: r = true, groupSpacing: s = 0 } = t, i = (n, o, c3 = []) => {
    const a = n.label ?? String(n.value), l = typeof n.group == "string", d2 = l && (c3[c3.indexOf(n) + 1] ?? { group: true }), y = l && d2 && d2.group === true, p2 = l ? r ? `${y ? E2 : $} ` : "  " : "";
    let m = "";
    if (s > 0 && !l) {
      const S2 = `
${e("cyan", $)}`;
      m = `${S2.repeat(s - 1)}${S2}  `;
    }
    if (o === "active") return `${m}${e("dim", p2)}${e("cyan", et2)} ${a}${n.hint ? ` ${e("dim", `(${n.hint})`)}` : ""}`;
    if (o === "group-active") return `${m}${p2}${e("cyan", et2)} ${e("dim", a)}`;
    if (o === "group-active-selected") return `${m}${p2}${e("green", U)} ${e("dim", a)}`;
    if (o === "selected") {
      const S2 = l || r ? e("green", U) : "";
      return `${m}${e("dim", p2)}${S2} ${e("dim", a)}${n.hint ? ` ${e("dim", `(${n.hint})`)}` : ""}`;
    }
    if (o === "cancelled") return `${e(["strikethrough", "dim"], a)}`;
    if (o === "active-selected") return `${m}${e("dim", p2)}${e("green", U)} ${a}${n.hint ? ` ${e("dim", `(${n.hint})`)}` : ""}`;
    if (o === "submitted") return `${e("dim", a)}`;
    const g = l || r ? e("dim", J) : "";
    return `${m}${e("dim", p2)}${g} ${e("dim", a)}`;
  }, u = t.required ?? true;
  return new it({ options: t.options, signal: t.signal, input: t.input, output: t.output, initialValues: t.initialValues, required: u, cursorAt: t.cursorAt, selectableGroups: r, validate(n) {
    if (u && (n === void 0 || n.length === 0)) return `Please select at least one option.
${e("reset", e("dim", `Press ${e(["gray", "bgWhite", "inverse"], " space ")} to select, ${e("gray", e(["bgWhite", "inverse"], " enter "))} to submit`))}`;
  }, render() {
    const n = t.withGuide ?? h.withGuide, o = `${n ? `${e("gray", $)}
` : ""}${M(this.state)}  ${t.message}
`, c3 = this.value ?? [];
    switch (this.state) {
      case "submit": {
        const a = this.options.filter(({ value: d2 }) => c3.includes(d2)).map((d2) => i(d2, "submitted")), l = a.length === 0 ? "" : `  ${a.join(e("dim", ", "))}`;
        return `${o}${n ? e("gray", $) : ""}${l}`;
      }
      case "cancel": {
        const a = this.options.filter(({ value: l }) => c3.includes(l)).map((l) => i(l, "cancelled")).join(e("dim", ", "));
        return `${o}${n ? `${e("gray", $)}  ` : ""}${a.trim() ? `${a}${n ? `
${e("gray", $)}` : ""}` : ""}`;
      }
      case "error": {
        const a = this.error.split(`
`).map((l, d2) => d2 === 0 ? `${n ? `${e("yellow", E2)}  ` : ""}${e("yellow", l)}` : `   ${l}`).join(`
`);
        return `${o}${n ? `${e("yellow", $)}  ` : ""}${this.options.map((l, d2, y) => {
          const p2 = c3.includes(l.value) || l.group === true && this.isGroupSelected(`${l.value}`), m = d2 === this.cursor;
          return !m && typeof l.group == "string" && this.options[this.cursor].value === l.group ? i(l, p2 ? "group-active-selected" : "group-active", y) : m && p2 ? i(l, "active-selected", y) : p2 ? i(l, "selected", y) : i(l, m ? "active" : "inactive", y);
        }).join(`
${n ? `${e("yellow", $)}  ` : ""}`)}
${a}
`;
      }
      default: {
        const a = this.options.map((d2, y, p2) => {
          const m = c3.includes(d2.value) || d2.group === true && this.isGroupSelected(`${d2.value}`), g = y === this.cursor, S2 = !g && typeof d2.group == "string" && this.options[this.cursor].value === d2.group;
          let h2 = "";
          return S2 ? h2 = i(d2, m ? "group-active-selected" : "group-active", p2) : g && m ? h2 = i(d2, "active-selected", p2) : m ? h2 = i(d2, "selected", p2) : h2 = i(d2, g ? "active" : "inactive", p2), `${y !== 0 && !h2.startsWith(`
`) ? "  " : ""}${h2}`;
        }).join(`
${n ? e("cyan", $) : ""}`), l = a.startsWith(`
`) ? "" : "  ";
        return `${o}${n ? e("cyan", $) : ""}${l}${a}
${n ? e("cyan", E2) : ""}
`;
      }
    }
  } }).prompt();
};
var me = (t = "", r) => {
  const s = r?.output ?? process.stdout, i = r?.withGuide ?? h.withGuide ? `${e("gray", E2)}  ` : "";
  s.write(`${i}${e("red", t)}

`);
};
var ge = (t = "", r) => {
  const s = r?.output ?? process.stdout, i = r?.withGuide ?? h.withGuide ? `${e("gray", lt)}  ` : "";
  s.write(`${i}${t}
`);
};
var ye = (t = "", r) => {
  const s = r?.output ?? process.stdout, i = r?.withGuide ?? h.withGuide ? `${e("gray", $)}
${e("gray", E2)}  ` : "";
  s.write(`${i}${t}

`);
};
var Q2 = (t, r) => t.split(`
`).map((s) => r(s)).join(`
`);
var ve = (t) => {
  const r = (i, u) => {
    const n = i.label ?? String(i.value);
    return u === "disabled" ? `${e("gray", J)} ${Q2(n, (o) => e(["strikethrough", "gray"], o))}${i.hint ? ` ${e("dim", `(${i.hint ?? "disabled"})`)}` : ""}` : u === "active" ? `${e("cyan", et2)} ${n}${i.hint ? ` ${e("dim", `(${i.hint})`)}` : ""}` : u === "selected" ? `${e("green", U)} ${Q2(n, (o) => e("dim", o))}${i.hint ? ` ${e("dim", `(${i.hint})`)}` : ""}` : u === "cancelled" ? `${Q2(n, (o) => e(["strikethrough", "dim"], o))}` : u === "active-selected" ? `${e("green", U)} ${n}${i.hint ? ` ${e("dim", `(${i.hint})`)}` : ""}` : u === "submitted" ? `${Q2(n, (o) => e("dim", o))}` : `${e("dim", J)} ${Q2(n, (o) => e("dim", o))}`;
  }, s = t.required ?? true;
  return new nt({ options: t.options, signal: t.signal, input: t.input, output: t.output, initialValues: t.initialValues, required: s, cursorAt: t.cursorAt, validate(i) {
    if (s && (i === void 0 || i.length === 0)) return `Please select at least one option.
${e("reset", e("dim", `Press ${e(["gray", "bgWhite", "inverse"], " space ")} to select, ${e("gray", e("bgWhite", e("inverse", " enter ")))} to submit`))}`;
  }, render() {
    const i = t.withGuide ?? h.withGuide, u = W(t.output, t.message, i ? `${yt(this.state)}  ` : "", `${M(this.state)}  `), n = `${i ? `${e("gray", $)}
` : ""}${u}
`, o = this.value ?? [], c3 = (a, l) => {
      if (a.disabled) return r(a, "disabled");
      const d2 = o.includes(a.value);
      return l && d2 ? r(a, "active-selected") : d2 ? r(a, "selected") : r(a, l ? "active" : "inactive");
    };
    switch (this.state) {
      case "submit": {
        const a = this.options.filter(({ value: d2 }) => o.includes(d2)).map((d2) => r(d2, "submitted")).join(e("dim", ", ")) || e("dim", "none"), l = W(t.output, a, i ? `${e("gray", $)}  ` : "");
        return `${n}${l}`;
      }
      case "cancel": {
        const a = this.options.filter(({ value: d2 }) => o.includes(d2)).map((d2) => r(d2, "cancelled")).join(e("dim", ", "));
        if (a.trim() === "") return `${n}${e("gray", $)}`;
        const l = W(t.output, a, i ? `${e("gray", $)}  ` : "");
        return `${n}${l}${i ? `
${e("gray", $)}` : ""}`;
      }
      case "error": {
        const a = i ? `${e("yellow", $)}  ` : "", l = this.error.split(`
`).map((p2, m) => m === 0 ? `${i ? `${e("yellow", E2)}  ` : ""}${e("yellow", p2)}` : `   ${p2}`).join(`
`), d2 = n.split(`
`).length, y = l.split(`
`).length + 1;
        return `${n}${a}${Y2({ output: t.output, options: this.options, cursor: this.cursor, maxItems: t.maxItems, columnPadding: a.length, rowPadding: d2 + y, style: c3 }).join(`
${a}`)}
${l}
`;
      }
      default: {
        const a = i ? `${e("cyan", $)}  ` : "", l = n.split(`
`).length, d2 = i ? 2 : 1;
        return `${n}${a}${Y2({ output: t.output, options: this.options, cursor: this.cursor, maxItems: t.maxItems, columnPadding: a.length, rowPadding: l + d2, style: c3 }).join(`
${a}`)}
${i ? e("cyan", E2) : ""}
`;
      }
    }
  } }).prompt();
};
var Vt = { light: w2("\u2500", "-"), heavy: w2("\u2501", "="), block: w2("\u2588", "#") };
var it2 = (t, r) => t.includes(`
`) ? t.split(`
`).map((s) => r(s)).join(`
`) : r(t);
var Ee = (t) => {
  const r = (s, i) => {
    const u = s.label ?? String(s.value);
    switch (i) {
      case "disabled":
        return `${e("gray", H)} ${it2(u, (n) => e("gray", n))}${s.hint ? ` ${e("dim", `(${s.hint ?? "disabled"})`)}` : ""}`;
      case "selected":
        return `${it2(u, (n) => e("dim", n))}`;
      case "active":
        return `${e("green", z2)} ${u}${s.hint ? ` ${e("dim", `(${s.hint})`)}` : ""}`;
      case "cancelled":
        return `${it2(u, (n) => e(["strikethrough", "dim"], n))}`;
      default:
        return `${e("dim", H)} ${it2(u, (n) => e("dim", n))}`;
    }
  };
  return new ut({ options: t.options, signal: t.signal, input: t.input, output: t.output, initialValue: t.initialValue, render() {
    const s = t.withGuide ?? h.withGuide, i = `${M(this.state)}  `, u = `${yt(this.state)}  `, n = W(t.output, t.message, u, i), o = `${s ? `${e("gray", $)}
` : ""}${n}
`;
    switch (this.state) {
      case "submit": {
        const c3 = s ? `${e("gray", $)}  ` : "", a = W(t.output, r(this.options[this.cursor], "selected"), c3);
        return `${o}${a}`;
      }
      case "cancel": {
        const c3 = s ? `${e("gray", $)}  ` : "", a = W(t.output, r(this.options[this.cursor], "cancelled"), c3);
        return `${o}${a}${s ? `
${e("gray", $)}` : ""}`;
      }
      default: {
        const c3 = s ? `${e("cyan", $)}  ` : "", a = s ? e("cyan", E2) : "", l = o.split(`
`).length, d2 = s ? 2 : 1;
        return `${o}${c3}${Y2({ output: t.output, cursor: this.cursor, options: this.options, maxItems: t.maxItems, columnPadding: c3.length, rowPadding: l + d2, style: (y, p2) => r(y, y.disabled ? "disabled" : p2 ? "active" : "inactive") }).join(`
${c3}`)}
${a}
`;
      }
    }
  } }).prompt();
};
var jt = `${e("gray", $)}  `;

// src/router.ts
init_esm_shims();
function buildRouterChoices(state) {
  const detected = state.tracks.length > 0 ? state.tracks.join(", ") : "(none detected)";
  return [
    {
      value: "add",
      label: "Add a new Track",
      hint: `Current: ${detected}`,
      enabled: true
    },
    {
      value: "update",
      label: "Update policy files (auto-backup)",
      hint: "Refresh rules / agents / commands / hooks from latest templates",
      enabled: true
    },
    {
      value: "remove",
      label: "Remove a Track (unsupported)",
      hint: "Manual edit of .claude/ required \u2014 not automated",
      enabled: false
    },
    {
      value: "reinstall",
      label: "Reinstall (backs up current .claude/ first)",
      hint: "Use when state is corrupted",
      enabled: true
    },
    {
      value: "exit",
      label: "Exit",
      enabled: true
    }
  ];
}
function summarizeState(state) {
  if (state.state === "new") {
    return "No prior install detected \u2014 new install flow.";
  }
  const trackList2 = state.tracks.length > 0 ? state.tracks.join(", ") : "(no tracks resolved)";
  const sourceLabel = state.source === "metafile" ? "via .claude/.installed-tracks" : state.source === "legacy" ? "via legacy rules/*.md heuristic" : "via no source";
  return `Existing install detected ${sourceLabel}. Tracks: ${trackList2}.`;
}

// src/wizard-steps.ts
init_esm_shims();
var WIZARD_TOTAL = 6;
var WIZARD = {
  TRACKS: { current: 1, total: WIZARD_TOTAL },
  CLI: { current: 2, total: WIZARD_TOTAL },
  TARGETS: { current: 3, total: WIZARD_TOTAL },
  SCOPE: { current: 4, total: WIZARD_TOTAL },
  CONFIRM: { current: 5, total: WIZARD_TOTAL },
  INSTALL: { current: 6, total: WIZARD_TOTAL }
};
function stepLabel(step, suffix) {
  if (!step) return suffix;
  return `Step ${step.current}/${step.total} \u2014 ${suffix}`;
}

// src/prompts.ts
var TRACK_LABELS = {
  tooling: "tooling \u2014 Bash + Markdown meta-project",
  "csr-supabase": "csr-supabase \u2014 Vite + React + Supabase",
  "csr-fastify": "csr-fastify \u2014 Vite + React + Fastify",
  "csr-fastapi": "csr-fastapi \u2014 Vite + React + FastAPI",
  "ssr-htmx": "ssr-htmx \u2014 htmx + FastAPI",
  "ssr-nextjs": "ssr-nextjs \u2014 Next.js (App Router)",
  data: "data \u2014 Python data / DuckDB / PySide6",
  executive: "executive \u2014 proposals / DD / pitch (no agent-skills)",
  full: "full \u2014 all dev capabilities",
  "project-management": "project-management \u2014 PM / Scrum / Jira / Confluence",
  "growth-marketing": "growth-marketing \u2014 Growth / Marketing / Content"
};
var VISIBLE_OPTION_DEFS = [
  {
    key: "withTauri",
    category: "frontend",
    source: "this project",
    label: "Tauri desktop rule (option)",
    hint: "CSR / full tracks \xB7 manifest rule mapping"
  },
  {
    key: "withUzysHarness",
    category: "workflow",
    source: "this project",
    label: "uzys-harness 6-Gate workflow (option)",
    hint: "/uzys:spec /uzys:plan /uzys:build /uzys:test /uzys:review /uzys:ship"
  }
];
var CLI_BASE_LABELS = {
  claude: "Claude Code",
  codex: "Codex (OpenAI)",
  opencode: "OpenCode (anomalyco)",
  antigravity: "Antigravity (Google)"
};
function viewportItems(itemCount) {
  const rows = process.stdout.rows ?? 24;
  return Math.max(8, Math.min(itemCount, rows - 10));
}
var defaultPrompts = {
  intro: (msg) => ge(msg),
  outro: (msg) => ye(msg),
  cancel: (msg) => me(msg),
  selectTracks: async (initial, step) => {
    const result = await ve({
      message: stepLabel(step, "Select Track(s)"),
      options: TRACKS.map((t) => ({ value: t, label: TRACK_LABELS[t] })),
      ...initial ? { initialValues: initial } : {},
      maxItems: viewportItems(11),
      required: true
    });
    return q(result) ? null : result;
  },
  selectCli: async (initial, step) => {
    const initialValues = initial && initial.length > 0 ? [...initial] : ["claude"];
    const result = await ve({
      message: stepLabel(step, "Target CLI(s)"),
      options: [
        { value: "claude", label: CLI_BASE_LABELS.claude },
        { value: "codex", label: CLI_BASE_LABELS.codex },
        { value: "opencode", label: CLI_BASE_LABELS.opencode },
        { value: "antigravity", label: CLI_BASE_LABELS.antigravity }
      ],
      initialValues,
      required: true
    });
    if (q(result)) return null;
    return [...result].sort(
      (a, b2) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b2]
    );
  },
  selectAction: async (state) => {
    const result = await Ee({
      message: summarizeState(state),
      options: buildRouterChoices(state).map((c3) => {
        const label = c3.enabled ? c3.label : `${c3.label} [disabled]`;
        return {
          value: c3.value,
          label,
          ...c3.hint ? { hint: c3.hint } : {},
          ...c3.enabled ? {} : { disabled: true }
        };
      })
    });
    return q(result) ? null : result;
  },
  /**
   * v26.64.0 (ADR-020) — Installation scope select. Default Project (D16 — no global write).
   * Global 은 사용자 명시 opt-in 시에만.
   */
  selectScope: async (initial = "project", step) => {
    const result = await Ee({
      message: stepLabel(step, "Installation scope"),
      initialValue: initial,
      options: [
        {
          value: "project",
          label: "Project",
          hint: "Install in current directory (committed with your project)"
        },
        {
          value: "global",
          label: "Global",
          hint: "Write to ~/.claude/, ~/.codex/, npm -g (shared across all projects)"
        }
      ]
    });
    return q(result) ? null : result;
  },
  confirmInstall: async (summary) => {
    const result = await ue({
      message: `${summary}

Proceed?`,
      initialValue: true
    });
    return q(result) ? null : result;
  },
  selectInstallTargets: async (initialChecked, step, recap) => {
    const initialSet = new Set(initialChecked);
    const collected = new Set(initialChecked);
    const pages = [
      {
        label: "Dev (Frontend \xB7 Backend \xB7 Dev Tools \xB7 Data)",
        cats: ["frontend", "backend", "dev-tools", "data"]
      },
      { label: "Business (PM \xB7 Executive \xB7 Documents)", cats: ["business"] },
      { label: "Workflow & ECC Suite", cats: ["workflow", "ecc-suite"] }
    ];
    const buildPageGroups = (cats) => {
      const groups = {};
      const flatItems = [];
      for (const cat of cats) {
        const items = [];
        for (const o of VISIBLE_OPTION_DEFS.filter((d2) => d2.category === cat)) {
          items.push({
            value: `option:${o.key}`,
            // v26.62.3 — group header 와 옵션 사이 시각 hierarchy 강화. label prefix 4 space.
            label: `    ${o.label}  [${o.source}]`,
            hint: o.hint
          });
        }
        const tierOrder = { official: 0, vetted: 1, experimental: 2 };
        const catAssets = [...EXTERNAL_ASSETS.filter((x) => x.category === cat)].sort(
          (a, b2) => tierOrder[assetTrustTier(a.id)] - tierOrder[assetTrustTier(b2.id)]
        );
        for (const a of catAssets) {
          const tier = assetTrustTier(a.id);
          const badge = tier === "official" ? "  \u2605 official" : tier === "experimental" ? "  \u26A0 experimental (opt-in)" : "";
          items.push({
            value: `asset:${a.id}`,
            label: `    ${a.id}  [${a.source}]${badge}`,
            hint: a.description
          });
        }
        if (items.length === 0) continue;
        const selectedInCat = items.filter((it3) => initialSet.has(it3.value)).length;
        const header = `${CATEGORY_TITLES[cat]}  [${selectedInCat}/${items.length} \u2713 default]`;
        groups[header] = items;
        flatItems.push(...items);
      }
      return { groups, flatItems };
    };
    const recapLine = recap ? `Tracks: ${recap.tracks.join(", ")}  \xB7  CLIs: ${recap.cli.join(", ")}` : "";
    process.stdout.write("\x1B[?1049h");
    let resultIds = null;
    let aborted = false;
    try {
      let pageIdx = 0;
      while (pageIdx < pages.length) {
        const page = pages[pageIdx];
        if (!page) break;
        const { groups, flatItems } = buildPageGroups(page.cats);
        const selectedNow = flatItems.filter((it3) => collected.has(it3.value)).map((it3) => it3.value);
        const pageDefault = flatItems.filter((it3) => initialSet.has(it3.value)).length;
        const totalSelected = collected.size;
        const message = [
          `Step ${step.current}/${step.total}  \xB7  Page ${pageIdx + 1}/${pages.length}  \xB7  ${page.label}`,
          recapLine ? `  ${recapLine}` : "",
          `  Selected so far: ${totalSelected} items  \xB7  This page default \u2713 ${pageDefault}/${flatItems.length}`,
          "  Space toggle \xB7 Enter \u2192 next \xB7 ESC \u2192 prev"
        ].filter(Boolean).join("\n");
        const groupOpts = {
          message,
          options: groups,
          initialValues: selectedNow,
          required: false,
          selectableGroups: false
        };
        const result = await pe(groupOpts);
        if (q(result)) {
          if (pageIdx === 0) {
            aborted = true;
            break;
          }
          pageIdx--;
          continue;
        }
        for (const it3 of flatItems) collected.delete(it3.value);
        for (const v2 of result) collected.add(v2);
        pageIdx++;
      }
      if (!aborted) {
        resultIds = [...collected];
      }
    } finally {
      process.stdout.write("\x1B[?1049l");
    }
    if (resultIds !== null) {
      process.stdout.write(
        `\u25C7  Step ${step.current}/${step.total} \u2014 Install targets  \xB7  ${resultIds.length} selected
\u2502
`
      );
    }
    return resultIds;
  }
};

// src/state.ts
init_esm_shims();
import { existsSync as existsSync16, readFileSync as readFileSync15 } from "fs";
import { join as join14 } from "path";
var META_FILE = ".claude/.installed-tracks";
var LEGACY_SIGNATURES = [
  { rule: "htmx.md", track: "ssr-htmx" },
  { rule: "nextjs.md", track: "ssr-nextjs" },
  { rule: "data-analysis.md", track: "data" },
  { rule: "pyside6.md", track: "data" },
  { rule: "cli-development.md", track: "tooling" }
];
function detectInstallState(projectDir) {
  const claudeDir = join14(projectDir, ".claude");
  const hasClaudeDir = existsSync16(claudeDir);
  if (!hasClaudeDir) {
    return { state: "new", tracks: [], source: "none", hasClaudeDir: false };
  }
  const metaPath = join14(projectDir, META_FILE);
  if (existsSync16(metaPath)) {
    const tracks2 = readMetafile(metaPath);
    return { state: "existing", tracks: tracks2, source: "metafile", hasClaudeDir: true };
  }
  const tracks = inferFromLegacySignatures(projectDir);
  return { state: "existing", tracks, source: "legacy", hasClaudeDir: true };
}
function readMetafile(path2) {
  const raw = readFileSync15(path2, "utf8");
  const seen = /* @__PURE__ */ new Set();
  for (const line of raw.split(/\s+/)) {
    const trimmed = line.trim();
    if (isTrack(trimmed)) {
      seen.add(trimmed);
    }
  }
  return [...seen].sort();
}
function inferFromLegacySignatures(projectDir) {
  const rulesDir = join14(projectDir, ".claude/rules");
  if (!existsSync16(rulesDir)) {
    return [];
  }
  const found = /* @__PURE__ */ new Set();
  for (const sig of LEGACY_SIGNATURES) {
    if (existsSync16(join14(rulesDir, sig.rule))) {
      found.add(sig.track);
    }
  }
  return [...found].sort();
}

// src/interactive.ts
function splitInstallTargets(targets) {
  const optionKeys = [];
  const assetIds = [];
  for (const t of targets) {
    if (t.startsWith("option:")) {
      optionKeys.push(t.slice("option:".length));
    } else if (t.startsWith("asset:")) {
      assetIds.push(t.slice("asset:".length));
    }
  }
  return { optionKeys, assetIds };
}
function toOptionFlags(keys) {
  const picked = new Set(keys);
  return {
    withTauri: picked.has("withTauri"),
    withGsd: picked.has("withGsd"),
    withEcc: picked.has("withEcc"),
    withPrune: picked.has("withPrune"),
    withTob: picked.has("withTob"),
    withCodexSkills: picked.has("withCodexSkills"),
    withCodexTrust: picked.has("withCodexTrust"),
    withKarpathyHook: picked.has("withKarpathyHook"),
    withCodexPrompts: false,
    withAddyAgentSkills: picked.has("withAddyAgentSkills"),
    withUzysHarness: picked.has("withUzysHarness"),
    withSuperpowers: picked.has("withSuperpowers"),
    withAntigravityGlobal: picked.has("withAntigravityGlobal")
  };
}
function applyOptionRules(flags) {
  if (flags.withPrune && !flags.withEcc) {
    return { ...flags, withEcc: true };
  }
  return flags;
}
async function runInteractive(projectDir, deps = {}) {
  const prompts = deps.prompts ?? defaultPrompts;
  const detect = deps.detect ?? detectInstallState;
  const isTty = deps.isTty ?? (() => Boolean(process.stdin.isTTY));
  if (!isTty()) {
    return {
      ok: false,
      reason: "no-tty",
      message: "Interactive mode requires a TTY. Use `claude-harness install --track <name>` for non-interactive use."
    };
  }
  prompts.intro("uzys-claude-harness installer");
  const state = detect(projectDir);
  let initialTracks;
  let mode = "fresh";
  if (state.state === "existing") {
    const action = await prompts.selectAction(state);
    if (action === null) {
      prompts.cancel("Cancelled.");
      return { ok: false, reason: "cancelled" };
    }
    if (action === "exit") {
      prompts.outro("Exiting without changes.");
      return { ok: false, reason: "exit" };
    }
    if (action === "remove") {
      prompts.cancel("Track removal is not automated \u2014 manually edit `.claude/`. Aborting.");
      return { ok: false, reason: "disabled-action" };
    }
    if (action === "update") {
      mode = "update";
      const summary = formatSummary({
        tracks: state.tracks,
        options: applyOptionRules(toOptionFlags([])),
        cli: ["claude"],
        projectDir
      });
      const confirmed = await prompts.confirmInstall(`UPDATE policy files only:
${summary}`);
      if (!confirmed) {
        prompts.outro("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro("Running update mode...");
      return {
        ok: true,
        mode: "update",
        spec: {
          tracks: state.tracks,
          options: applyOptionRules(toOptionFlags([])),
          cli: ["claude"],
          projectDir
        }
      };
    }
    if (action === "add") {
      mode = "add";
      initialTracks = state.tracks;
    } else if (action === "reinstall") {
      mode = "reinstall";
    }
  }
  let step = "tracks";
  let tracks = null;
  let cli2 = null;
  let targetSelections = null;
  let scope = "project";
  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(tracks ?? initialTracks, WIZARD.TRACKS);
      if (result === null) {
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      if (tracks !== null && !tracksEqual(tracks, result)) {
        targetSelections = null;
      }
      tracks = result;
      step = "cli";
    } else if (step === "cli") {
      const result = await prompts.selectCli(cli2 ?? ["claude"], WIZARD.CLI);
      if (result === null) {
        step = "tracks";
        continue;
      }
      cli2 = result;
      step = "targets";
    } else if (step === "targets") {
      const initial = targetSelections !== null ? [...targetSelections] : recommendedExternalAssets(tracks ?? []).map((id) => `asset:${id}`);
      const result = await prompts.selectInstallTargets(initial, WIZARD.TARGETS, {
        tracks: tracks ?? [],
        cli: cli2 ?? ["claude"]
      });
      if (result === null) {
        step = "cli";
        continue;
      }
      targetSelections = result;
      step = "scope";
    } else if (step === "scope") {
      const result = await prompts.selectScope(scope, WIZARD.SCOPE);
      if (result === null) {
        step = "targets";
        continue;
      }
      scope = result;
      step = "confirm";
    } else {
      const finalTracks = tracks;
      const finalCli = cli2;
      const { optionKeys, assetIds } = splitInstallTargets(targetSelections ?? []);
      const options = applyOptionRules(toOptionFlags(optionKeys));
      const userOverride = targetSelections === null ? void 0 : computeUserOverride(finalTracks, assetIds);
      const scopeLabel = scope === "global" ? "Global (writes to ~/.claude/, ~/.codex/, npm -g)" : "Project (current directory only)";
      const summary = `${formatSummary({
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        ...userOverride ? { userOverride } : {}
      })}
  SCOPE     ${scopeLabel}`;
      const confirmed = await prompts.confirmInstall(
        `${stepLabel(WIZARD.CONFIRM, "Confirm")}
${summary}`
      );
      if (confirmed === null) {
        step = "scope";
        continue;
      }
      if (!confirmed) {
        prompts.outro("Cancelled by user.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro(stepLabel(WIZARD.INSTALL, "Installing..."));
      return {
        ok: true,
        mode,
        spec: {
          tracks: finalTracks,
          options,
          cli: finalCli,
          projectDir,
          scope,
          ...userOverride ? { userOverride } : {}
        }
      };
    }
  }
}
function tracksEqual(a, b2) {
  if (a.length !== b2.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b2].sort();
  return sortedA.every((t, i) => t === sortedB[i]);
}
function computeUserOverride(tracks, assetIds) {
  const recommended = new Set(recommendedExternalAssets(tracks));
  const selected = new Set(assetIds);
  const forceExclude = [...recommended].filter((id) => !selected.has(id)).sort();
  const forceInclude = [...selected].filter((id) => !recommended.has(id)).sort();
  if (forceInclude.length === 0 && forceExclude.length === 0) return void 0;
  return { forceInclude, forceExclude };
}
function formatSummary(spec) {
  const opts = Object.keys(spec.options).filter((k2) => spec.options[k2]).map((k2) => k2.replace(/^with/, "").toLowerCase());
  const optsLabel = opts.length > 0 ? opts.join(", ") : "(none added)";
  const lines = [
    `Tracks:    ${spec.tracks.join(", ")}`,
    `Options:   ${optsLabel}`,
    `CLI:       ${spec.cli.join(" \xB7 ")}`,
    `Target:    ${spec.projectDir}`
  ];
  const recommended = new Set(recommendedExternalAssets(spec.tracks));
  if (spec.userOverride) {
    for (const id of spec.userOverride.forceExclude) recommended.delete(id);
    for (const id of spec.userOverride.forceInclude) recommended.add(id);
  }
  const finalAssets = [...recommended].sort();
  if (finalAssets.length > 0) {
    lines.push(`Assets:    ${finalAssets.length} selected`);
    const byCategory = /* @__PURE__ */ new Map();
    for (const id of finalAssets) {
      const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
      const cat = asset?.category ?? "other";
      const list = byCategory.get(cat) ?? [];
      list.push(id);
      byCategory.set(cat, list);
    }
    for (const [cat, ids] of byCategory) {
      lines.push(`  \xB7 ${cat}: ${ids.join(", ")}`);
    }
  }
  if (spec.userOverride) {
    if (spec.userOverride.forceInclude.length > 0) {
      lines.push(`  +User added: ${spec.userOverride.forceInclude.join(", ")}`);
    }
    if (spec.userOverride.forceExclude.length > 0) {
      lines.push(`  -User removed: ${spec.userOverride.forceExclude.join(", ")}`);
    }
  }
  return lines.join("\n");
}

// src/cli.ts
var VERSION = "0.4.0";
async function defaultAction(deps = {}) {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const run = deps.run ?? ((cwd) => runInteractive(cwd));
  const execute = deps.execute ?? executeSpec;
  const result = await run(process.cwd());
  if (!result.ok) {
    if (result.message) {
      err(result.message);
    }
    exit(result.reason === "no-tty" ? 2 : 0);
    return;
  }
  if (!result.spec) {
    err("Internal error: interactive returned ok=true without a spec.");
    exit(1);
    return;
  }
  const execDeps = {
    log,
    err,
    exit,
    fromWizard: true
  };
  if (result.mode) execDeps.mode = result.mode;
  execute(result.spec, execDeps);
}
function buildCli() {
  const cli2 = cac("claude-harness");
  cli2.help();
  cli2.version(VERSION);
  registerInstallCommand(cli2);
  registerUninstallCommand(cli2);
  cli2.command("", "Interactive installer (state detection + prompts)").action(() => defaultAction());
  return cli2;
}

// src/index.ts
var cli = buildCli();
cli.parse(process.argv);
//# sourceMappingURL=index.js.map