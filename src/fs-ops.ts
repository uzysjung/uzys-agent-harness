import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  symlinkSync,
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
 * Move an existing directory to a timestamped backup sibling.
 * Returns the backup path, or null when nothing to back up.
 */
export function backupDir(target: string, now: Date = new Date()): string | null {
  if (!existsSync(target)) {
    return null;
  }
  const backup = claimBackupPath(`${target}.backup-${formatStamp(now)}`, (c) => mkdirSync(c));
  // 선점은 빈 디렉터리로 해 두고, 옮기기 직전에 치운다. 존재하는 디렉터리로의 rename 은
  // POSIX 에선 (비어 있으면) 통하지만 Windows 는 거부하므로 양쪽 다 되게 rmdir 을 먼저 한다.
  rmdirSync(backup);
  // 심볼릭 링크는 **풀지 않는다**. rename 은 옮기는 것이라 target 이 링크면 링크가 통째로
  // 백업 자리로 가고, 재설치는 빈 자리에 새 실체 디렉터리를 만든다 — 링크도 링크가 가리키던
  // 내용도 그대로 남는다. (copyBackupDir 은 원본을 계속 쓰면서 복사하므로 판단이 반대다.)
  renameSync(target, backup);
  return backup;
}

/**
 * Copy backup — original target preserved (for in-place update mode).
 * bash setup-harness.sh L477 `cp -R .claude "$BACKUP_DIR"` 등가.
 *
 * 무엇을 보존하려는 백업인가: **update 직전 상태로 되돌아갈 수 있게 하는 스냅샷**. 원본은
 * 그 자리에 남아 계속 덮어써지므로, 백업은 그 시점 **내용**을 들고 있어야 의미가 있다.
 * 그래서 최상위와 안쪽 링크의 처리가 갈린다:
 *
 * | 대상 | 처리 | 왜 |
 * |---|---|---|
 * | target 자체가 링크 (`.claude` → 공유 dotfiles) | **실체를 복사** | 링크를 복사하면 update 가 그 링크를 통해 원본을 덮는 순간 백업이 가리키는 내용도 같이 바뀐다 — 되돌릴 수 없는 백업 |
 * | 안쪽 링크 (`skills/<id>` → `npx skills add` 저장소) | **링크인 채로** | 남의 저장소를 백업에 복제해 넣지 않는다. 끊어진 링크(스킬을 지운 뒤)에서도 죽지 않는다 |
 *
 * (#678 · ADR-098 이후 install · update 는 밖 실체에 쓰지 않는다 — 이 표는 백업의 의미만 정한다.)
 *
 * 최상위를 `realpathSync` 로 풀어 넘긴다. `dereference: true` 로도 이 케이스는 통과하지만
 * 그 옵션에 기대지 않는다 — 문서상 의미("심볼릭 링크를 따라간다")와 실측(Node 26.5.0 에선
 * 안쪽 링크를 풀지 않았다)이 갈리는 옵션이라, 버전이 바뀌면 위 표의 두 번째 행이 조용히
 * 뒤집힌다. "최상위만 실체로"는 옵션이 아니라 코드로 적는다.
 */
export function copyBackupDir(target: string, now: Date = new Date()): string | null {
  if (!existsSync(target)) {
    return null;
  }
  const backup = claimBackupPath(`${target}.backup-${formatStamp(now)}`, (c) => mkdirSync(c));
  // #594 — 통짜 cpSync(recursive) 는 VirtioFS(도커 바인드마운트) 등 공유 FS 에서 EACCES 로
  // 죽고 부분 복사 고아를 남긴다. 파일 단위 순회로 바꾸되 cpSync 의 **심링크 계약은 계속
  // 지킨다** — 링크는 링크로 보존하고(남의 저장소를 복제하지 않는다, backup-symlink 계약),
  // 끊어진 링크도 죽지 않고 옮긴다.
  // #594 — 도중에 실패하면 반쯤 만든 백업을 남기지 않고(고아 + 안내 없음) 원인을 한 줄로 알린다.
  try {
    copyTreePreservingLinks(realpathSync(target), backup);
  } catch (e: unknown) {
    rmSync(backup, { recursive: true, force: true });
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`backup of ${target} failed, partial copy removed — ${detail}`);
  }
  return backup;
}

/**
 * #594 — 백업용 디렉터 복사: 파일은 copyFile, 디렉터는 재귀, 심볼릭 링크는 **링크 그대로**
 * (cpSync 의 기본 동작과 같다). listFilesRecursive 기반 copyDir 은 링크를 풀어버려 남의
 * 저장소를 통째로 복제하므로 여기에 쓸 수 없다.
 */
function copyTreePreservingLinks(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const src = join(source, entry.name);
    const dst = join(target, entry.name);
    if (entry.isSymbolicLink()) {
      // 끊어진 링크도 readlink 자체는 되므로 링크로 보존된다 — 풀지 않는다.
      symlinkSync(readlinkSync(src), dst);
      continue;
    }
    if (entry.isDirectory()) copyTreePreservingLinks(src, dst);
    else if (entry.isFile()) copyFile(src, dst);
    // FIFO·소켓·장치는 건너뛴다 — copyFile 이 FIFO 에서 영원히 멈춘다.
  }
}

/**
 * 기존 파일을 timestamp 백업본으로 복사하고 그 경로를 반환한다. **판정은 호출자 몫.**
 *
 * 판정을 여기 두지 않는 이유는 술어가 "새 내용과 다른가"가 아니기 때문이다 — update 의 스킬
 * 갱신(ADR-046)은 "**설치 시점**과 다른가"로 판정한다. 하네스가 개선해서
 * 달라진 파일은 사용자가 안 건드렸으므로 백업 없이 덮어써야 하고, 내용 비교만으로는 그
 * 둘을 구분할 수 없다.
 *
 * 심볼릭 링크는 **실체 내용으로** 백업된다 (`copyFileSync` 가 링크를 따라간다) — `copyBackupDir`
 * 최상위와 같은 잣대다. 호출자는 백업 직후 같은 경로를 덮어쓰는데, 그 쓰기도 링크를 따라가
 * 링크 대상을 바꾼다. 링크 사본을 남기면 백업이 가리키는 내용도 같이 바뀌어 아무것도 못 지킨다.
 */
export function backupFile(target: string, now: Date = new Date()): string {
  return claimBackupPath(`${target}.backup-${formatStamp(now)}`, (c) =>
    copyFileSync(target, c, fsConstants.COPYFILE_EXCL),
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
export function ensureProjectSkeleton(projectDir: string): void {
  const dirs = [
    ".claude/commands/uzys",
    ".claude/rules",
    ".claude/skills",
    ".claude/agents",
    ".claude/hooks",
    "docs/decisions",
  ];
  for (const d of dirs) {
    // ADR-098 — 실체가 프로젝트 밖(예: `.claude` → dotfiles)이면 빈 폴더도 만들지 않는다.
    if (outsideProjectTarget(projectDir, join(projectDir, d)) !== null) continue;
    mkdirSync(join(projectDir, d), { recursive: true });
  }
}

/**
 * #556 — 두 디렉터 트리가 내용 기준 동일한가 (경로 집합 + 파일별 sha). update 가 시작 시 만든
 * `.claude.backup-<ts>` 가 실행 끝까지 원본과 동일하다면 이번 실행은 `.claude/` 를 하나도 안
 * 고친 것이다 — 그 백업은 아무것도 지키지 않으므로 지운다(실행마다 쌓이는 것이 #556).
 */
export function dirTreesIdentical(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  // 파일은 바이트 해시(손실 디코딩 없음), 심링크는 링크 대상 문자열로 비교한다 —
  // 링크가 사라지거나 바뀐 변경도 "변경 있음"으로 본다.
  const signature = (
    root: string,
    rel = "",
    out = new Map<string, string>(),
  ): Map<string, string> => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isSymbolicLink()) out.set(r, `link:${readlinkSync(join(root, r))}`);
      else if (e.isDirectory()) signature(root, r, out);
      else if (e.isFile()) {
        out.set(
          r,
          createHash("sha256")
            .update(readFileSync(join(root, r)))
            .digest("hex"),
        );
      }
    }
    return out;
  };
  const sa = signature(a);
  const sb = signature(b);
  if (sa.size !== sb.size) return false;
  for (const [rel, sha] of sa) {
    if (sb.get(rel) !== sha) return false;
  }
  return true;
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
