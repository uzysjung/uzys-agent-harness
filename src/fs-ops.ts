import {
  copyFileSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { outsideProjectTarget } from "./outside-project.js";

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

/**
 * Copy a directory's **files** recursively. Creates target if missing.
 *
 * 계약이 통짜 `cpSync` 보다 좁다 — source 쪽 **심볼릭 링크와 빈 디렉터리는 재현되지 않는다**.
 * 지금 `templates/` 에는 둘 다 0개이고(git 은 빈 디렉터리를 담지 못한다) 실행 비트·내용·
 * 사용자 추가 파일 보존은 종전과 같다. 스킬에 심링크를 넣게 되면 이 줄부터 다시 볼 것.
 *
 * **파일 단위로 돈다** (`cpSync` 통짜 복사가 아니다, #343). 통짜 복사는 대상 트리 안에 링크가
 * 섞여 있어도 그대로 따라가 남의 파일을 덮는데, 그것을 걸러낼 자리가 호출자에게 없었다.
 * 무엇을 건너뛸지 **판정은 호출자 몫**이다 — fs 층에 소유권 정책을 넣으면 그 정책이 두 번째
 * 사본으로 자라난다(`foreign-slot.ts` 가 그 SSOT).
 *
 * @param foreignOf **필수**다. 옵셔널로 두면 다음 호출자가 조용히 빠뜨리고, 그 형태가
 *   이 사이클에 세 번 났다(쓰는 주체가 판정을 안 부름). 가드가 필요 없는 호출은 `() => null` 로
 *   **명시**한다 — 사람이 매번 기억해야 하는 규약은 규약이 아니다.
 *   source 기준 상대경로를 받아, 그 파일을 쓰면 남의 것을 건드리는 경우
 *   **그 자리의 경로**를 돌려준다(아니면 null). 파일 경로가 아니라 자리를 받는 이유는
 *   사용자가 옮겨야 할 대상이 파일이 아니라 그 자리(예: 중간 디렉터리 링크)이기 때문이다.
 * @returns 건너뛴 자리들 (**중복 포함** — 거르는 것은 호출자 몫). 화면에 낸다 — 침묵 금지
 */
export function copyDir(
  source: string,
  target: string,
  foreignOf: (relFile: string) => string | null,
): string[] {
  if (!existsSync(source)) {
    throw new Error(`Source dir not found: ${source}`);
  }
  mkdirSync(target, { recursive: true });
  const skipped: string[] = [];
  for (const rel of listFilesRecursive(source)) {
    const foreign = foreignOf(rel);
    if (foreign !== null) {
      // 한 자리가 여러 파일을 가릴 수 있다(중간 디렉터리 링크) — 같은 자리가 여러 번 담긴다.
      // 중복 제거는 **호출자가** 한다: 엔트리를 넘나드는 중복은 여기서 볼 수 없어 어차피
      // 그쪽이 한 번 더 걸러야 하고, 같은 규칙을 두 곳에 두면 한쪽이 죽은 줄이 된다.
      skipped.push(foreign);
      continue;
    }
    copyFile(join(source, rel), join(target, rel));
  }
  return skipped;
}

/** 같은 초 안에서 허용하는 백업 개수 상한. 넘으면 조용히 덮는 대신 크게 실패한다. */
const MAX_BACKUP_CLAIMS = 100;

/**
 * 한 이름을 **원자적으로 선점**해서 돌려준다 — 같은 stamp 로 두 번 백업해도 앞선 백업을 덮지 않게.
 *
 * `formatStamp` 은 초 해상도라 사용자가 `update`/재설치를 연달아 돌리면 같은 이름이 나온다.
 * 그때 세 백업 함수가 서로 다르게 망가졌다 (R-3m):
 *   - `cpSync`/`copyFileSync` 는 조용히 **앞선 백업을 덮는다** — 지키려던 사용자 편집분이 사라진다.
 *   - `renameSync` 는 ENOTEMPTY 로 죽는다 — 재설치가 크래시한다.
 *
 * `existsSync` 로 "비었나"를 **판정하지 않는다**: 확인과 생성 사이가 곧 경합 창이다 (ADR-049
 * "판정하지 말고 디스크가 답하게 하라"). 생성 자체를 원자적으로 시도하고 EEXIST 를 디스크의
 * 대답으로 받는다 — `mkdirSync`(비재귀)와 `copyFileSync(..., COPYFILE_EXCL)` 둘 다 그 성질을 준다.
 */
function claimBackupPath(base: string, claim: (candidate: string) => void): string {
  for (let n = 1; n <= MAX_BACKUP_CLAIMS; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    try {
      claim(candidate);
      return candidate;
    } catch (err) {
      // EEXIST = "그 이름은 이미 누가 썼다". 그 외(ENOENT·EACCES…)는 재시도로 풀릴 문제가 아니다.
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
  throw new Error(`Cannot allocate a backup path for ${base} (${MAX_BACKUP_CLAIMS} taken)`);
}

/**
 * 기존 파일을 timestamp 백업본으로 복사하고 그 경로를 반환한다. **판정은 호출자 몫.**
 *
 * 판정을 여기 두지 않는 이유는 술어가 "새 내용과 다른가"가 아니기 때문이다 — update 의 스킬
 * 갱신(ADR-046)은 "**설치 시점**과 다른가"로 판정한다. 하네스가 개선해서
 * 달라진 파일은 사용자가 안 건드렸으므로 백업 없이 덮어써야 하고, 내용 비교만으로는 그
 * 둘을 구분할 수 없다.
 *
 * 심볼릭 링크는 **실체 내용으로** 백업된다 (`copyFileSync` 가 링크를 따라간다). 호출자는 백업 직후 같은 경로를 덮어쓰는데, 그 쓰기도 링크를 따라가
 * 링크 대상을 바꾼다. 링크 사본을 남기면 백업이 가리키는 내용도 같이 바뀌어 아무것도 못 지킨다.
 */
export function backupFile(target: string, now: Date = new Date()): string {
  return claimBackupPath(`${target}.backup-${formatStamp(now)}`, (c) =>
    copyFileSync(target, c, fsConstants.COPYFILE_EXCL),
  );
}

/**
 * #770 — `backupFile` 과 같은 이름 규칙으로 **미리 읽어 둔 내용**을 백업으로 쓴다. 쓰기 주체가 폴더째 지우고 다시
 * 만드는 외부 도구(`npx skills add --copy` 는 스킬 폴더를 새로 만든다 — 컨테이너 실측)면 호출 전에 옆에 둔 백업이
 * 함께 지워지므로, 내용을 들고 있다가 호출 뒤에 쓴다.
 */
export function backupContent(target: string, content: Buffer, now: Date = new Date()): string {
  mkdirSync(dirname(target), { recursive: true });
  return claimBackupPath(`${target}.backup-${formatStamp(now)}`, (c) =>
    writeFileSync(c, content, { flag: "wx" }),
  );
}

/**
 * #600 — `backupFile` 이 만든 이름에서 원본 경로를 되찾는다(`<file>.backup-<stamp>[-n]`). 이름 규칙을 아는 곳이
 * 이 파일 하나라 여기 둔다. 그 모양이 아니면 `null`.
 */
export function backupOriginal(backupPath: string): string | null {
  const m = /^(.+)\.backup-\d{8}T\d{6}(?:-\d+)?$/.exec(backupPath);
  return m?.[1] ?? null;
}

/**
 * `dir` 아래 모든 파일의 상대 경로 (디렉터리 자체는 제외). 순서는 readdir 순.
 *
 * `readdirSync(dir, { recursive: true })` 를 안 쓰는 이유: 그 옵션은 Node 20.1.0 에 들어왔는데
 * `engines` 는 `>=20.0.0` 이다. 20.0.x 에서 조용히 `undefined` 를 흘리는 대신 직접 순회한다.
 */
export function listFilesRecursive(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function formatStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .slice(0, 15);
}

/** Create a project skeleton: <project>/.claude/{commands/uzys,rules,skills,agents,hooks}. */
/**
 * install 이 기록 없이 만드는 빈 뼈대 — uninstall 은 같은 목록을 빈 디렉터리 걷기의 시작점으로 쓴다(#746 · 설계 §2.3 #8 ⓑ).
 * 비어 있을 때만 걷힌다 — 설치자가 무엇이든 넣었으면 남는다.
 */
export const PROJECT_SKELETON_DIRS: ReadonlyArray<string> = [
  ".claude/commands/uzys",
  ".claude/rules",
  ".claude/skills",
  ".claude/agents",
  ".claude/hooks",
  "docs/decisions",
];

export function ensureProjectSkeleton(projectDir: string): void {
  for (const d of PROJECT_SKELETON_DIRS) {
    // ADR-098 — 실체가 프로젝트 밖(예: `.claude` → dotfiles)이면 빈 폴더도 만들지 않는다.
    if (outsideProjectTarget(projectDir, join(projectDir, d)) !== null) continue;
    mkdirSync(join(projectDir, d), { recursive: true });
  }
}

/**
 * #653 — 유효하지 않은 UTF-8 바이트가 섞인 파일을 문자열 왕복(read-utf8 → write-utf8)으로
 * 다시 쓰면 해당 바이트가 영구 변형되고, uninstall 로는 원본으로 돌아오지 않는다.
 * 루트 `CLAUDE.md` 의 마커 삽입/제거 경로가 이 왕복을 쓰므로, **변형이 일어나기 전에** 원시
 * 바이트를 옆에 백업해 둔다. 무경고 변형이 아니라 "백업했음 + 원인"을 사용자에게 말한다.
 *
 * 문자열로 다시 조립한 뒤에도 바이트가 동일한 파일(정상 UTF-8)은 아무것도 하지 않는다.
 */
export function backupIfLossyUtf8(target: string, now: Date = new Date()): string | null {
  if (!existsSync(target)) return null;
  let raw: Buffer;
  try {
    raw = readFileSync(target);
  } catch {
    return null;
  }
  if (Buffer.from(raw.toString("utf8")).equals(raw)) return null;
  const backup = backupFile(target, now);
  console.error(
    `⚠ ${target} contains bytes that are not valid UTF-8 — rewriting would alter them permanently. Original bytes saved as ${backup}`,
  );
  return backup;
}
