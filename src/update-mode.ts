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
 * 보존: gate-status.json, .mcp.json (사용자 추가 항목), docs/SPEC.md, settings.local.json
 */

import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export interface UpdateModeReport {
  /** 덮어쓰기된 파일 갯수 (디렉토리별). */
  updated: Record<string, number>;
  /** 제거된 orphan 파일명 목록 (디렉토리별). */
  pruned: Record<string, string[]>;
  /** 제거된 stale hook ref 파일명 목록. */
  staleHookRefs: string[];
  /** 갱신된 CLAUDE.md (true if updated). */
  claudeMdUpdated: boolean;
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
