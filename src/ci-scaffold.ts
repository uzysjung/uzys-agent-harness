/**
 * CI scaffold (v26.108.0, 라이프사이클 자산화 ② — ADR-037) — `.github/workflows/` fill-in
 * 워크플로 템플릿 설치. 실무 CI 패턴(실DB 서비스 컨테이너 · tag-only 트리거 +
 * 로컬 검증 1차 게이트 · Playwright E2E · coverage 게이트)의 도메인 중립 일반화
 * (docs/plans/lifecycle-codification-2026-07-18.md ② — CI 0 인 실프로젝트가 갭의 존재 증명).
 *
 * 본 하네스가 `.claude/` 밖에 쓰는 첫 자산 — 안전 계약 2가지:
 *   1. opt-in 전용 (`--with ci-scaffold` / wizard 체크) — 무인지 설치 없음.
 *   2. **기존 파일 절대 덮어쓰지 않음** — 이미 존재하는 워크플로 파일은 skip 하고
 *      `skippedExisting` 으로 정직 보고 (manifest copyFile 의 무조건 overwrite 와 다른 이유).
 *      uninstall 도 `.github/` 를 건드리지 않는다 (install-log 미기록 — 설치 후 사용자 소유물).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { copyFile } from "./fs-ops.js";
import { anyTrack, hasUiTrack } from "./track-match.js";
import type { Track } from "./types.js";

export interface CiScaffoldReport {
  /** 새로 쓴 워크플로 파일 (project-relative). */
  written: string[];
  /** 이미 존재해 보존한 파일 (project-relative) — no-clobber 정직 보고용. */
  skippedExisting: string[];
}

interface WorkflowVariant {
  /** `templates/github-workflows/` 안의 소스 파일명. */
  source: string;
  /** `.github/workflows/` 안의 타깃 파일명. */
  target: string;
  applies: (tracks: ReadonlyArray<Track>) => boolean;
}

const PYTHON_TRACKS = "data|csr-fastapi|full";

/**
 * Track → 변형 매핑 (결정론 — Rule 5, 사용자가 받는 파일을 사전에 알 수 있어야 한다):
 *  - node CI: node 계열 트랙, 또는 python 계열이 전혀 없을 때의 fallback — 명시 opt-in 이
 *    트랙 매핑 밖(예: PM 단독)이라고 무설치가 되면 silent no-op (no-false-ship 위반).
 *  - python CI: python 계열 트랙. csr-fastapi·full 은 polyglot — node 와 양쪽 설치.
 *  - e2e(Playwright): UI 트랙만 (playwright-launch 룰과 동일 게이팅).
 */
const VARIANTS: ReadonlyArray<WorkflowVariant> = [
  {
    source: "ci-node.yml",
    target: "ci.yml",
    applies: (tracks) =>
      anyTrack(tracks, "csr-*|ssr-*|tooling|full") || !anyTrack(tracks, PYTHON_TRACKS),
  },
  {
    source: "ci-python.yml",
    target: "ci-python.yml",
    applies: (tracks) => anyTrack(tracks, PYTHON_TRACKS),
  },
  {
    source: "e2e.yml",
    target: "e2e.yml",
    applies: (tracks) => hasUiTrack(tracks),
  },
];

export function installCiScaffold(ctx: {
  harnessRoot: string;
  projectDir: string;
  tracks: ReadonlyArray<Track>;
}): CiScaffoldReport {
  const report: CiScaffoldReport = { written: [], skippedExisting: [] };
  for (const v of VARIANTS) {
    if (!v.applies(ctx.tracks)) continue;
    const relTarget = `.github/workflows/${v.target}`;
    const target = join(ctx.projectDir, relTarget);
    if (existsSync(target)) {
      report.skippedExisting.push(relTarget);
      continue;
    }
    copyFile(join(ctx.harnessRoot, "templates/github-workflows", v.source), target);
    report.written.push(relTarget);
  }
  return report;
}
