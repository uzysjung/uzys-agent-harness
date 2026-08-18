/**
 * owned-write.ts — 소유자 판정을 붙인 파일 쓰기 (v26.133.0 · ADR-048).
 *
 * ADR-046(스킬) → ADR-047(`.claude/` 정책 파일)이 정한 규칙을 **하네스가 렌더해서 내보내는
 * 모든 산출물**에 쓰기 위한 공통 도구. 그 두 ADR 의 구현이 각각 자기 자산 종류에만 걸려서
 * 같은 버그가 두 번 났다 — 세 번째를 막으려면 규칙이 자산별 코드가 아니라 **한 도구**에 있어야
 * 한다 (`feedback_surface_symmetry` "결정의 범위 ≠ 구현의 범위").
 *
 * `.claude/` 쪽과 다른 점 하나: 저기는 templates 파일을 **복사**하므로 기준선을 나중에
 * 디스크에서 다시 훑지만(`collectPolicyHashes`), 외부 CLI 산출물은 템플릿을 **렌더**한
 * 결과라 디스크를 훑어도 "무엇이 하네스 것인지" 알 수 없다. 대신 쓰는 쪽이 방금 쓴 내용을
 * 알고 있으므로 **그 자리에서 기준선을 만든다** — 경로 목록을 따로 하드코딩할 필요가 없고,
 * 그래서 `POLICY_DIRS` 같은 열거 사본이 여기엔 생기지 않는다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { foreignOwnedTarget } from "./foreign-slot.js";
import { backupFile } from "./fs-ops.js";
import { hashContent, type InstallLogSkillFile, isHarnessOwned } from "./install-log.js";

/**
 * 한 transform 실행의 소유권 결과. **세 transform 이 같은 타입을 반환한다** — 필드가 늘 때
 * 세 곳을 따로 고쳐야 하는 구조를 만들지 않기 위해서다 (이 파일이 존재하는 이유와 같다).
 */
export interface OwnedWriteResult {
  /** 이번 실행이 쓴 산출물의 기준선 (projectDir 상대경로 → sha256). install log 에 실린다. */
  files: InstallLogSkillFile[];
  /** 사용자 편집분이라 백업한 **원본**의 project-relative 경로 — 사용자가 알아보는 이름. */
  backedUp: string[];
  /**
   * #343 — 다른 도구가 소유한 스킬 슬롯이라 **쓰지 않은** 자리 (project-relative).
   *
   * `.agents/skills/<id>` 는 codex·antigravity 산출물의 자리이자 `npx skills add --agent` 의
   * 설치처다. 그동안 이 writer 는 그 자리가 링크여도 따라 써서 사용자의 다른 저장소를 덮고,
   * 백업까지 **그 저장소 안에** 떨궜다 — 사용자가 찾을 자리가 아니다 (ADR-062 와 같은 논거).
   */
  foreignOwned: string[];
  /** 생성된 백업 파일의 절대경로 — 설치 화면의 `backup` 행이 이걸 쓴다. */
  backupPaths: string[];
  /**
   * 실제로 디스크가 바뀐 파일 수 (신규 + 내용이 달라 덮어쓴 것). 이미 최신이라 아무것도 안 한
   * 파일은 세지 않는다 — update 화면이 "N files updated" 로 쓰므로, 안 한 일을 셌다가는
   * 매번 같은 숫자가 떠서 갱신이 일어난 것처럼 보인다.
   */
  updated: number;
}

export interface OwnedWriter {
  /**
   * 소유자 판정을 거쳐 쓴다.
   *
   * | 디스크 vs 기준선 | 뜻 | 처리 |
   * |---|---|---|
   * | 파일 없음 | 신규 | 그냥 쓴다 (refresh 모드에서는 **건너뛴다**) |
   * | 내용 동일 | 이미 최신 | 아무것도 안 한다 (백업도 쓰기도) |
   * | 기준선과 같다 | 사용자가 안 고쳤다 | 조용히 덮어쓴다 |
   * | 기준선과 다르다 | 사용자가 고쳤다 | `.backup-<stamp>` 남기고 최신판을 자리에 |
   * | 기록 없음 | 판정 불가 | 보수적으로 백업 |
   *
   * @returns 이 경로를 이번에 담당했는가. **refresh 모드에서 건너뛴 경우만 false** 다 —
   *   호출자가 쓰기 성공을 전제로 하는 후속 동작(예: `chmod`)을 그때 건너뛰게 하려는 것이고,
   *   반환을 무시해도 되는 호출부는 무시해도 안전하다. `void` 로 두면 건너뛴 경로에
   *   `chmodSync` 가 걸려 ENOENT 로 터진다.
   */
  write(absPath: string, content: string, opts?: WriteOptions): boolean;
  /** 이번 실행의 소유권 결과 — transform 이 그대로 report 에 실어 반환한다. */
  result(): OwnedWriteResult;
}

/**
 * @param now 백업 파일명 stamp — 테스트가 고정값을 주입한다.
 * @param refreshOnly 이미 있는 파일만 갱신하고 **없는 파일은 만들지 않는다** (v26.134.0 · ADR-049).
 *
 * `update` 가 쓰는 모드다. update 는 사용자가 고르지 않은 것을 새로 깔면 안 된다 —
 * `.claude/` 쪽 `updateDir` 이 "target 에 이미 있는 파일만"으로 오래 지켜 온 규율(Track 혼입
 * 방지)과 같은 것이고, 외부 CLI 에 그대로 적용하면 **"어느 CLI 가 설치돼 있나"를 판정할 필요
 * 자체가 없어진다** — 안 깔린 CLI 는 대상 파일이 하나도 없어 자연히 아무것도 안 쓴다.
 * 판정을 안 하니 CLI 목록·스킬 목록의 열거 사본도 생기지 않는다.
 */
/** 개별 write 의 refresh 정책 예외. */
export interface WriteOptions {
  /**
   * refresh 모드에서도 **없으면 만든다**.
   *
   * `refreshOnly` 의 규율은 "사용자가 안 고른 CLI 의 자산을 새로 깔지 않는다"이고, 그 판정을
   * 파일 존재로 대신해 왔다. 그런데 **이미 설치된 CLI 에 하네스가 새 자산을 추가한 경우**엔
   * 그 판정이 반대로 작동한다 — 파일이 없는 이유가 "안 골라서"가 아니라 "그때는 없던
   * 자산이라서"인데, update 가 영원히 건너뛴다(독립 검증 C-2 실측: 기존 설치자는 새 룰을
   * 재설치 전에는 못 받는다).
   *
   * 그래서 호출부가 **그 CLI 가 설치돼 있다는 별도 증거**를 잡았을 때만 이 예외를 쓴다.
   * 증거 없이 쓰면 안 깐 CLI 에 디렉터리가 생겨 `refreshOnly` 자체가 무의미해진다.
   */
  createInRefresh?: boolean;
}

export interface OwnedWriterOptions {
  now?: Date;
  refreshOnly?: boolean;
}

/**
 * @param projectDir 기준 디렉터리 — 기록되는 경로는 전부 여기 기준 상대경로다.
 *   절대경로를 기록하면 프로젝트를 옮긴 순간 기준선이 통째로 무효가 된다.
 * @param baseline 설치 시점 기준선 (install log `externalFiles`). 빈 Map = 판정 불가.
 *
 * writer 하나는 **transform 하나**를 담당한다. codex 와 opencode 가 같은 `AGENTS.md` 를 쓰는
 * 것 같은 교차 누적은 호출자(installer)가 다음 writer 를 만들기 전에 기준선을 갱신해서
 * 처리한다 — 누적을 여기와 거기 양쪽에 두면 한쪽이 죽은 코드가 되고, 죽은 줄은 테스트가
 * 잡지 못한다 (이 파일의 첫 판이 실제로 그랬고 음성 대조에서 드러났다).
 */
export function createOwnedWriter(
  projectDir: string,
  baseline: ReadonlyMap<string, string>,
  options: OwnedWriterOptions = {},
): OwnedWriter {
  const { now = new Date(), refreshOnly = false } = options;
  const written = new Map<string, string>();
  const backedUp: string[] = [];
  const backupPaths: string[] = [];
  const foreignOwned: string[] = [];
  let updated = 0;

  return {
    write(absPath, content, opts) {
      const rel = relative(projectDir, absPath).split(sep).join("/");
      // #343 — 남의 도구가 소유한 스킬 슬롯이면 쓰지 않는다 (판정 SSOT = foreign-slot.ts).
      // `false` 반환은 기존 계약 그대로다 — 호출부는 이미 "안 썼으면 report 에 안 싣는다".
      const foreign = foreignOwnedTarget(projectDir, rel);
      if (foreign !== null) {
        if (!foreignOwned.includes(foreign)) foreignOwned.push(foreign);
        return false;
      }
      const digest = hashContent(content);

      if (!existsSync(absPath)) {
        // refresh 모드: 없는 파일은 사용자가 안 고른 것 → 새로 깔지 않는다.
        // 기준선에도 넣지 않는다 — 디스크에 없는 파일의 해시를 기록하면 그게 곧 거짓 기록이다.
        // 예외 = `createInRefresh` (호출부가 그 CLI 의 설치 증거를 이미 잡은 경우).
        if (refreshOnly && !opts?.createInRefresh) return false;
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content);
        updated++;
      } else {
        const current = readFileSync(absPath, "utf8");
        if (current !== content) {
          if (!isHarnessOwned(baseline, rel, current)) {
            backupPaths.push(backupFile(absPath, now));
            backedUp.push(rel);
          }
          writeFileSync(absPath, content);
          updated++;
        }
      }

      written.set(rel, digest);
      return true;
    },
    result() {
      return {
        foreignOwned: [...foreignOwned],
        files: [...written].map(([path, sha256]) => ({ path, sha256 })),
        backedUp: [...backedUp],
        backupPaths: [...backupPaths],
        updated,
      };
    },
  };
}
