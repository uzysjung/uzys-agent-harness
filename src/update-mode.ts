/**
 * update-mode.ts — Update / Add / Reinstall router 액션 처리.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F5, F6
 * Source: bash setup-harness.sh@911c246~1 L460~573 (update mode 113 LOC)
 *
 * Update 모드 동작:
 *   1. backup: .claude/ → .claude.backup-<timestamp>/
 *   2. update_dir: target에 이미 존재하는 파일만 templates로 덮어쓰기 (Track 혼입 방지)
 *   3. prune_orphans: templates에 없는데 target에 있는 파일 제거 (예: 폐기된 rule)
 *   4. clean_stale_hook_refs: settings.json hook 참조 중 실존 파일 없는 것 제거
 *
 * 보존: .mcp.json (사용자 추가 항목), docs/SPEC.md, settings.local.json
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { backupFile, listFilesRecursive } from "./fs-ops.js";
import {
  collectSkillHashes,
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "./install-log.js";
import { DEFAULT_OPTIONS, type InstallSpec, type Track } from "./types.js";

export interface UpdateModeReport {
  /** 덮어쓰기된 파일 갯수 (디렉토리별). */
  updated: Record<string, number>;
  /** 제거된 orphan 파일명 목록 (디렉토리별). */
  pruned: Record<string, string[]>;
  /** 제거된 stale hook ref 파일명 목록. */
  staleHookRefs: string[];
  /** 갱신된 CLAUDE.md (true if updated). */
  claudeMdUpdated: boolean;
  /**
   * v26.126.0 (R-3a) — 사용자가 고쳐서 백업본을 남긴 스킬 파일 (`.claude/skills/` 상대경로).
   * 화면에 그대로 노출한다. 안 보이면 사용자는 자기 편집분이 어디 갔는지 알 수 없다.
   */
  skillsBackedUp: string[];
}

/**
 * Update 진입점이 쓰는 InstallSpec — **위저드와 `update` 명령이 공유한다.**
 *
 * update 는 `.claude/` 만 건드리므로 spec 에서 실제로 소비되는 건 `projectDir` 와
 * (보고용) `tracks` 뿐이다. `cli`/`options` 는 타입을 채우기 위한 값이라 어느 진입점이든
 * 같아야 하고, 두 곳에서 각자 리터럴로 쓰면 한쪽만 바뀌었을 때 조용히 갈린다 — 이 repo 가
 * 반복해서 당한 실패 모드라 처음부터 한 곳에 둔다.
 */
export function buildUpdateSpec(projectDir: string, tracks: ReadonlyArray<Track>): InstallSpec {
  return {
    tracks: [...tracks],
    options: DEFAULT_OPTIONS,
    cli: ["claude"],
    projectDir,
  };
}

/**
 * Update mode 메인 — backup은 caller가 별도 처리.
 *
 * @param projectDir 대상 프로젝트 root
 * @param templatesDir templates/ 디렉토리 (sync source)
 */
export function runUpdateMode(projectDir: string, templatesDir: string): UpdateModeReport {
  const claudeDir = join(projectDir, ".claude");
  const report: UpdateModeReport = {
    updated: {},
    pruned: {},
    staleHookRefs: [],
    claudeMdUpdated: false,
    skillsBackedUp: [],
  };

  // 1) update_dir × 4 (rules/agents/commands/uzys/hooks)
  const targets = [
    {
      target: join(claudeDir, "rules"),
      source: join(templatesDir, "rules"),
      pattern: ".md",
      label: ".claude/rules",
    },
    {
      target: join(claudeDir, "agents"),
      source: join(templatesDir, "agents"),
      pattern: ".md",
      label: ".claude/agents",
    },
    {
      target: join(claudeDir, "commands/uzys"),
      source: join(templatesDir, "commands/uzys"),
      pattern: ".md",
      label: ".claude/commands/uzys",
    },
    {
      target: join(claudeDir, "hooks"),
      source: join(templatesDir, "hooks"),
      pattern: ".sh",
      label: ".claude/hooks",
    },
  ];

  for (const t of targets) {
    report.updated[t.label] = updateDir(t.target, t.source, t.pattern);
    report.pruned[t.label] = pruneOrphans(t.target, t.source, t.pattern);
  }

  // 1.5) `.claude/skills/` — v26.126.0 (R-3a · ADR-046).
  // 위 4개와 달리 스킬은 디렉터리 단위라 재귀가 필요하고, 사용자 편집분 판정이 붙는다.
  const skillSync = syncSkills(
    join(claudeDir, "skills"),
    join(templatesDir, "skills"),
    skillBaseline(projectDir),
  );
  report.updated[".claude/skills"] = skillSync.updated;
  report.skillsBackedUp = skillSync.backedUp;
  refreshSkillBaseline(projectDir);

  // 2) .claude/CLAUDE.md
  const claudeMd = join(claudeDir, "CLAUDE.md");
  const templateMd = join(templatesDir, "CLAUDE.md");
  if (existsSync(claudeMd) && existsSync(templateMd)) {
    copyFileSync(templateMd, claudeMd);
    report.claudeMdUpdated = true;
  }

  // 3) settings.json stale hook ref cleanup
  const settingsPath = join(claudeDir, "settings.json");
  if (existsSync(settingsPath)) {
    report.staleHookRefs = cleanStaleHookRefs(settingsPath, join(claudeDir, "hooks"));
  }

  return report;
}

/**
 * `target`에 이미 존재하는 파일 중 `source`에 동일 이름 있는 것만 덮어쓰기.
 * Track 혼입 방지 (새 파일 추가 X) — bash update_dir 등가.
 */
export function updateDir(target: string, source: string, ext: string): number {
  if (!existsSync(target) || !existsSync(source)) return 0;
  let count = 0;
  for (const file of readdirSync(target)) {
    if (!file.endsWith(ext)) continue;
    const targetFile = join(target, file);
    const sourceFile = join(source, file);
    if (existsSync(sourceFile)) {
      copyFileSync(sourceFile, targetFile);
      count++;
    }
  }
  return count;
}

/**
 * `.claude/skills/` 를 templates 기준으로 갱신한다 (v26.126.0 · R-3a · ADR-046).
 *
 * **설치된 스킬만 손댄다** — templates 에 있어도 target 에 그 스킬 디렉터리가 없으면 건너뛴다.
 * 스킬은 트랙/opt-in 으로 게이팅돼 설치되므로(`installer.ts` selectedInternalSkills), 전부
 * 복사하면 사용자가 고르지 않은 스킬이 딸려 들어간다 (`updateDir` 의 "Track 혼입 방지"와 같은 취지).
 *
 * 파일 단위 판정:
 * | 디스크 vs 기준선 | 뜻 | 처리 |
 * |---|---|---|
 * | 같다 | 사용자가 안 고쳤다 | 조용히 덮어쓴다 |
 * | 다르다 | 사용자가 고쳤다 | `.backup-<stamp>` 남기고 덮어쓴다 |
 * | 기준선 기록 없음 | 판정 불가 | 보수적으로 백업 (레거시 설치의 첫 update 1회) |
 *
 * **orphan prune 은 하지 않는다** — 스킬 디렉터리 안에는 사용자가 자기 참고 파일을 넣을 수 있고,
 * templates 에 없다는 이유로 지우면 그게 곧 사용자 파일 삭제다 (ADR-046 "지우지 않는다").
 */
export function syncSkills(
  targetDir: string,
  sourceDir: string,
  baseline: ReadonlyMap<string, string>,
  now: Date = new Date(),
): { updated: number; backedUp: string[] } {
  if (!existsSync(targetDir) || !existsSync(sourceDir)) return { updated: 0, backedUp: [] };
  let updated = 0;
  const backedUp: string[] = [];

  for (const skill of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const targetSkill = join(targetDir, skill.name);
    if (!existsSync(targetSkill)) continue; // 사용자가 선택하지 않은 스킬 — 새로 깔지 않는다

    for (const rel of listFilesRecursive(join(sourceDir, skill.name))) {
      const targetFile = join(targetSkill, rel);
      const next = readFileSync(join(sourceDir, skill.name, rel), "utf8");

      if (!existsSync(targetFile)) {
        // 스킬 안에 새로 생긴 파일 (예: references/ 추가) — 스킬 자체는 이미 설치돼 있다.
        mkdirSync(dirname(targetFile), { recursive: true });
        writeFileSync(targetFile, next);
        updated++;
        continue;
      }

      const current = readFileSync(targetFile, "utf8");
      if (current === next) continue; // 이미 최신 — 백업도 갱신도 불필요

      const recorded = baseline.get(`${skill.name}/${rel}`);
      if (recorded === undefined || hashContent(current) !== recorded) {
        backupFile(targetFile, now);
        backedUp.push(`${skill.name}/${rel}`);
      }
      writeFileSync(targetFile, next);
      updated++;
    }
  }
  return { updated, backedUp };
}

/** 설치 시점 기준선을 Map 으로. 기록이 없으면 빈 Map — 그때는 보수적 백업으로 폴백한다. */
function skillBaseline(projectDir: string): ReadonlyMap<string, string> {
  const log = readInstallLog(projectDir);
  return new Map((log?.skillFiles ?? []).map((f) => [f.path, f.sha256]));
}

/**
 * 갱신 직후 기준선을 다시 찍는다.
 *
 * 이걸 빼면 다음 update 가 **방금 자기가 덮어쓴 파일**을 전부 "사용자가 고쳤다"로 오판해
 * 백업본을 매번 새로 쌓는다. update 는 install log 를 안 쓰는 단축 경로라
 * (`installer.ts` runUpdateInstall) 여기서 안 하면 아무도 안 한다.
 *
 * 로그가 없으면 **만들지 않는다** — update 가 설치 기록을 날조하면 uninstall 이 그걸 믿는다.
 */
function refreshSkillBaseline(projectDir: string): void {
  const log = readInstallLog(projectDir);
  if (!log) return;
  const skillFiles = collectSkillHashes(projectDir);
  const next: InstallLog = { ...log };
  if (skillFiles.length > 0) next.skillFiles = skillFiles;
  else delete next.skillFiles;
  try {
    writeInstallLog(projectDir, next);
  } catch {
    // 기록 실패가 update 자체를 실패시키지는 않는다 (D16 — 설치/갱신 성공 우선과 같은 방침).
  }
}

/**
 * Templates에 없는데 target에 있는 파일 제거 (orphan prune) — bash prune_orphans 등가.
 */
export function pruneOrphans(target: string, source: string, ext: string): string[] {
  if (!existsSync(target) || !existsSync(source)) return [];
  const removed: string[] = [];
  for (const file of readdirSync(target)) {
    if (!file.endsWith(ext)) continue;
    const sourceFile = join(source, file);
    if (!existsSync(sourceFile)) {
      const targetFile = join(target, file);
      try {
        unlinkSync(targetFile);
        removed.push(file);
      } catch {
        // best-effort — read-only? 다음 update 시 재시도
      }
    }
  }
  return removed;
}

/**
 * settings.json의 PreToolUse/PostToolUse hooks 중 실존 파일 없는 hook script 참조 제거.
 * bash clean_stale_hook_refs 등가 (jq 의존 없이 JSON 직접 파싱).
 *
 * @returns 제거된 hook script 파일명 목록
 */
export function cleanStaleHookRefs(settingsPath: string, hooksDir: string): string[] {
  let settings: SettingsJson;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8")) as SettingsJson;
  } catch {
    return [];
  }
  const hookEvents = settings.hooks ?? {};
  const removed: string[] = [];
  const cleanedHooks: Record<string, HookEntry[]> = {};

  for (const [eventName, eventEntries] of Object.entries(hookEvents)) {
    if (!Array.isArray(eventEntries)) {
      cleanedHooks[eventName] = eventEntries; // non-array event — 그대로 보존
      continue;
    }
    cleanedHooks[eventName] = eventEntries
      .filter((entry) => Array.isArray(entry?.hooks))
      .map((entry) => ({
        ...entry,
        hooks: entry.hooks.filter((hook) => keepHookRef(hook, hooksDir, removed)),
      }))
      .filter((entry) => entry.hooks.length > 0); // stale 제거 후 hooks 빈 entry 제거
  }

  if (removed.length > 0) {
    const next: SettingsJson = { ...settings, hooks: cleanedHooks };
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  return removed;
}

/** hook command 가 실존 `.sh` 참조면 true. stale(파일 부재) 이면 removed 에 fname 수집 후 false. */
function keepHookRef(hook: HookCommand, hooksDir: string, removed: string[]): boolean {
  const refMatch = (hook?.command ?? "").match(/\/\.claude\/hooks\/([^"\s/]+\.sh)/);
  if (!refMatch?.[1]) return true; // hook script 참조 아님 — 보존
  const fname = refMatch[1];
  const exists = existsSync(join(hooksDir, fname));
  if (!exists && !removed.includes(fname)) removed.push(fname);
  return exists;
}

interface HookCommand {
  type?: string;
  command?: string;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

interface SettingsJson {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}
