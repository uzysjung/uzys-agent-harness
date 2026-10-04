/**
 * Update command — 비대화형 정책 파일 갱신.
 *
 * 왜 있나: `install`·`list`·`uninstall` 은 전부 플래그로 비대화형 실행이 되는데 `update` 만
 * 위저드 전용이었다. CI 로 하네스를 **깔 수는 있는데 갱신할 수는 없다**는 건 수요의 문제가
 * 아니라 명령 계열의 비대칭이다 — 빠진 쪽이 사유를 대야 한다 (사용자 지시 2026-07-20).
 *
 * 동작: 기존 설치를 감지해 위저드의 update 액션과 **동일한 spec**(`buildUpdateSpec`)으로
 * `mode: "update"` 파이프라인을 돈다. 백업은 update mode 가 자동으로 뜬다 (`.claude.backup-*`).
 * 설치 기록이 없거나 깨졌으면 `list` · `uninstall` 과 같은 줄로 거절하고 아무것도 쓰지 않는다(#595).
 *
 * 하지 않는 것: track 추가(=`install`), 자산 재설치, 대화형 확인. update 는 이미 깔린
 * 정책 파일만 최신판으로 맞춘다.
 */

import { resolve } from "node:path";
import { c, status } from "../design.js";
import { type DetectedInstall, detectInstallState, reportNotInstalled } from "../state.js";
import { type InstallSpec, UPDATE_GROUPS } from "../types.js";
import { buildUpdateSpec, parseUpdateOnly } from "../update-mode.js";
import { type ExecuteSpecDeps, executeSpec } from "./install.js";

export interface UpdateOptions {
  projectDir?: string;
  /** #480 — `--only <group>` (반복). cac 는 한 번이면 string, 여러 번이면 string[] 을 준다. */
  only?: string | string[];
}

export interface UpdateActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  detect?: (projectDir: string) => DetectedInstall;
  execute?: (spec: InstallSpec, deps: ExecuteSpecDeps) => void;
}

export function updateAction(options: UpdateOptions = {}, deps: UpdateActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const detect = deps.detect ?? detectInstallState;
  const execute = deps.execute ?? executeSpec;

  const projectDir = resolve(options.projectDir ?? process.cwd());
  const state = detect(projectDir);

  // Pre-flight: 갱신할 대상이 없으면 조용히 성공하지 않는다. 파이프라인도 같은 조건에서
  // throw 하지만, 그건 "install failed" 로 렌더돼 원인이 안 보인다.
  // #595 — 판정은 설치 기록 하나다(`detectInstallState`). `.claude/` 나 메타파일이 있다고 설치로 보면
  // 기록 없는 프로젝트에 백업 폴더 · 앵커 · import 를 쓰고 성공한다 — 그 화면을 `list` · `uninstall` 과 맞춘다.
  if (state.state !== "installed") {
    reportNotInstalled(state, projectDir, err);
    exit(1);
    return;
  }

  // cac 는 `--only` 를 값 없이 주면 boolean true 를 준다 — "true" 가 모르는 값으로 거절되게 문자열로.
  const rawOnly =
    options.only === undefined
      ? []
      : [options.only].flat().map((v) => (typeof v === "string" ? v : "(missing value)"));
  const parsed = parseUpdateOnly(rawOnly);
  if (!parsed.ok) {
    err(status.failure(c.red(`Unknown --only value: ${parsed.invalid.join(", ")}`)));
    err(c.dim(`  Valid groups: ${UPDATE_GROUPS.join(" | ")}`));
    exit(1);
    return;
  }
  log(c.dim(`Updating installed harness files in ${projectDir}`));
  execute(buildUpdateSpec(projectDir, state.tracks, parsed.groups), {
    log,
    err,
    exit,
    mode: "update",
  });
}

export function registerUpdateCommand(cli: import("../cli.js").Cli): void {
  cli
    .command(
      "update",
      "Refresh installed policy files (rules / agents / commands / hooks / skills)",
    )
    .option("--project-dir <path>", "[Project] Target project directory", {
      default: process.cwd(),
    })
    .option(
      "--only <group>",
      `[Scope] Update only this group (repeatable): ${UPDATE_GROUPS.join(" | ")}`,
    )
    /* v8 ignore next 3 — cac action callback. updateAction 자체는 별도 tests 로 검증. */
    .action((options: UpdateOptions) => {
      updateAction(options);
    });
}
