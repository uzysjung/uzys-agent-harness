/**
 * Update command — 비대화형 정책 파일 갱신.
 *
 * 왜 있나: `install`·`list`·`uninstall` 은 전부 플래그로 비대화형 실행이 되는데 `update` 만
 * 위저드 전용이었다. CI 로 하네스를 **깔 수는 있는데 갱신할 수는 없다**는 건 수요의 문제가
 * 아니라 명령 계열의 비대칭이다 — 빠진 쪽이 사유를 대야 한다 (사용자 지시 2026-07-20).
 *
 * 동작: 기존 설치를 감지해 위저드의 update 액션과 **동일한 spec**(`buildUpdateSpec`)으로
 * `mode: "update"` 파이프라인을 돈다. 백업은 update mode 가 자동으로 뜬다 (`.claude.backup-*`).
 *
 * 하지 않는 것: track 추가(=`install`), 자산 재설치, 대화형 확인. update 는 이미 깔린
 * 정책 파일만 최신판으로 맞춘다.
 */

import { resolve } from "node:path";
import { c, status } from "../design.js";
import { type DetectedInstall, detectInstallState } from "../state.js";
import type { InstallSpec } from "../types.js";
import { buildUpdateSpec } from "../update-mode.js";
import { type ExecuteSpecDeps, executeSpec } from "./install.js";

export interface UpdateOptions {
  projectDir?: string;
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
  // v26.135.0 (#253) — 판정 기준이 `.claude/` 존재에서 **설치 여부**로 바뀌었다. update 는
  // v26.134.0(ADR-049)부터 외부 CLI 산출물도 갱신하므로, `.claude/` 없는 opencode/codex 단독
  // 설치도 정당한 update 대상이다. `.claude/` 로 막으면 갱신할 게 있는데 거절한다.
  if (state.state === "new") {
    err(status.failure(c.red(`No harness install found at ${projectDir}`)));
    err(c.dim("  Run `agent-harness install --track <name>` first."));
    exit(1);
    return;
  }

  log(c.dim(`Updating installed harness files in ${projectDir}`));
  execute(buildUpdateSpec(projectDir, state.tracks), { log, err, exit, mode: "update" });
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
    /* v8 ignore next 3 — cac action callback. updateAction 자체는 별도 tests 로 검증. */
    .action((options: UpdateOptions) => {
      updateAction(options);
    });
}
