/**
 * env-files.ts — 환경 파일 자동 생성.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F7, F8
 * Source: bash setup-harness.sh@911c246~1 L880~890 + L954~996.
 *
 * 2 종 산출:
 *   1. .env.example  (csr-supabase / full Track) — Supabase 토큰 가이드. 없을 때만 한 번 쓴다.
 *   2. .gitignore 의 하네스 몫 렌더(`gitignoreRender`) — 쓰기는 installer 가 `lines` 어댑터로 한다(#551 PR-3).
 *
 * 2026-08-16 (ADR-072) — `.mcp-allowlist` 생성기 제거. 그 파일을 읽던 `mcp-pre-exec.sh` 훅이
 * 목적 부적합으로 빠지면서(루트 `CLAUDE.md` §판정은 목적에서 시작한다) 읽는 쪽이 없어졌다.
 * 생성기만 남기면 아무도 안 보는 파일을 남의 저장소에 계속 만든다.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Track } from "./types.js";

const ENV_EXAMPLE_BODY = `# .env.example — csr-supabase Track
# Copy to .env (gitignored) and fill in values: cp .env.example .env

# ===== Supabase Management API (MCP server용) =====
# Personal Access Token — @supabase/mcp-server가 프로젝트 생성/마이그레이션/Edge Functions 배포에 사용
# 발급: https://supabase.com/dashboard/account/tokens
SUPABASE_ACCESS_TOKEN=

# 프로젝트 참조 ID (예: "abcdefghijklmnop")
# 위치: Supabase Dashboard → Project Settings → General
SUPABASE_PROJECT_REF=

# DB 패스워드 (supabase db push 등 직접 DB 접근용)
# 위치: Supabase Dashboard → Project Settings → Database
SUPABASE_DB_PASSWORD=

# ===== Frontend (public, 클라이언트 노출 OK) =====
# 위치: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ===== Optional — 앱 측 AI 기능용 =====
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# ===== Note =====
# - Vercel/Netlify는 별도 CLI login 사용 (env 불필요): vercel login / netlify login
# - Supabase CLI(supabase login)는 OAuth로 ~/.config/supabase/에 토큰 저장 — env 별개
# - .env는 .gitignore됨 (자동 추가). 절대 commit 금지.
`;

const ENV_EXAMPLE_TRACKS: ReadonlyArray<Track> = ["csr-supabase", "full"];

const GITIGNORE_ENV_COMMENT = "# Secret env (auto-added by agent-harness install)";

const AGENT_ARTIFACT_DIRS = [
  ".factory/",
  ".goose/",
  ".uzys-agent-harness/",
  // #657 — 하네스가 만드는 백업 디렉터·파일. gitignore 에 안 걸면 팀원의 `git add -A` 가
  // update 마다 백업을 커밋한다(#556 으로 no-op 사본은 없어지지만, 진짜 백업은 계속 생긴다).
  ".claude.backup-*/",
  ".codex.backup-*/",
  ".opencode.backup-*/",
  "*.backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T*",
];
const GITIGNORE_AGENT_ARTIFACT_HEADER =
  "# agent CLI / harness 자동 생성물 (auto-added by agent-harness)";

/**
 * .env.example 생성 (csr-supabase/full Track 한정, idempotent).
 * @returns true if created, false if skipped (already exists or non-applicable track)
 */
export function writeEnvExample(projectDir: string, tracks: ReadonlyArray<Track>): boolean {
  if (!tracks.some((t) => ENV_EXAMPLE_TRACKS.includes(t))) {
    return false;
  }
  const path = join(projectDir, ".env.example");
  if (existsSync(path)) {
    return false;
  }
  writeFileSync(path, ENV_EXAMPLE_BODY);
  return true;
}

/**
 * `.gitignore` 의 하네스 몫 — `lines` 어댑터의 렌더(#551 PR-3 · ADR-097 §6.2). 키 = 줄 원문, 값 = 그 줄 앞에 딸린
 * 주석 + 그 줄. 없는 줄만 파일 끝에 붙고, 설치자가 이미 둔 같은 줄은 설치자 것이다(기록하지 않는다).
 *
 * - `.env` — 시크릿 파일을 커밋하지 않게.
 * - `.factory/` · `.goose/` — v0.8.0 `npx skills` 가 다중 CLI 로 깔 때 만드는 자리(사용자 보고 #3).
 * - `.uzys-agent-harness/` — 설치 기록 + 훅 차단 로그(2026-08-02). 계측이 남의 저장소를 더럽히면 안 된다.
 *
 * 머리 주석은 묶음의 첫 줄(`.factory/`)에 딸린다 — 그 줄을 설치자가 이미 갖고 있으면 머리 없이 붙는다.
 */
export function gitignoreRender(): Map<string, string> {
  return new Map([
    [".env", `${GITIGNORE_ENV_COMMENT}\n.env`],
    ...AGENT_ARTIFACT_DIRS.map((line, i): [string, string] => [
      line,
      i === 0 ? `${GITIGNORE_AGENT_ARTIFACT_HEADER}\n${line}` : line,
    ]),
  ]);
}
