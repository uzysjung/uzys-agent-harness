import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

/** Ensure a directory exists, creating parents as needed. Idempotent. */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export interface CopyResult {
  copied: number;
  skipped: number;
}

/** Copy a single file, creating parent dirs as needed. Idempotent. */
export function copyFile(source: string, target: string): void {
  if (!existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

/** Copy a directory recursively. Creates target if missing. */
export function copyDir(source: string, target: string): void {
  if (!existsSync(source)) {
    throw new Error(`Source dir not found: ${source}`);
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

/**
 * Move an existing directory to a timestamped backup sibling.
 * Returns the backup path, or null when nothing to back up.
 */
export function backupDir(target: string, now: Date = new Date()): string | null {
  if (!existsSync(target)) {
    return null;
  }
  const backup = `${target}.backup-${formatStamp(now)}`;
  renameSync(target, backup);
  return backup;
}

/**
 * Copy backup — original target preserved (for in-place update mode).
 * bash setup-harness.sh L477 `cp -R .claude "$BACKUP_DIR"` 등가.
 */
export function copyBackupDir(target: string, now: Date = new Date()): string | null {
  if (!existsSync(target)) {
    return null;
  }
  const backup = `${target}.backup-${formatStamp(now)}`;
  cpSync(target, backup, { recursive: true });
  return backup;
}

/**
 * 사용자 편집 가능 파일(settings.json·CLAUDE.md)을 덮어쓰기 전 보호.
 * 기존 파일이 있고 새 내용과 다르면 timestamp 백업본을 만들고 그 경로를 반환한다.
 * 부재하거나 내용이 동일하면(idempotent 재설치) null — 불필요한 백업을 만들지 않는다.
 * audit SEC-1/CODE-2 — add 모드(.claude/ backup 없음)에서 통째 덮어쓰기로 인한 데이터 손실 방지.
 */
export function backupFileIfChanged(
  target: string,
  newContent: string,
  now: Date = new Date(),
): string | null {
  if (!existsSync(target)) {
    return null;
  }
  if (readFileSync(target, "utf-8") === newContent) {
    return null;
  }
  const backup = `${target}.backup-${formatStamp(now)}`;
  copyFileSync(target, backup);
  return backup;
}

function formatStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .slice(0, 15);
}

/** Create a project skeleton: <project>/.claude/{commands/{uzys,ecc},rules,skills,agents,hooks}. */
export function ensureProjectSkeleton(projectDir: string): void {
  const dirs = [
    ".claude/commands/uzys",
    ".claude/commands/ecc",
    ".claude/rules",
    ".claude/skills",
    ".claude/agents",
    ".claude/hooks",
    "docs/decisions",
  ];
  for (const d of dirs) {
    mkdirSync(join(projectDir, d), { recursive: true });
  }
}
