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
  /** 생성된 백업 파일의 절대경로 — 설치 화면의 `backup` 행이 이걸 쓴다. */
  backupPaths: string[];
}

export interface OwnedWriter {
  /**
   * 소유자 판정을 거쳐 쓴다.
   *
   * | 디스크 vs 기준선 | 뜻 | 처리 |
   * |---|---|---|
   * | 파일 없음 | 신규 | 그냥 쓴다 |
   * | 내용 동일 | 이미 최신 | 아무것도 안 한다 (백업도 쓰기도) |
   * | 기준선과 같다 | 사용자가 안 고쳤다 | 조용히 덮어쓴다 |
   * | 기준선과 다르다 | 사용자가 고쳤다 | `.backup-<stamp>` 남기고 최신판을 자리에 |
   * | 기록 없음 | 판정 불가 | 보수적으로 백업 |
   */
  write(absPath: string, content: string): void;
  /** 이번 실행의 소유권 결과 — transform 이 그대로 report 에 실어 반환한다. */
  result(): OwnedWriteResult;
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
  now: Date = new Date(),
): OwnedWriter {
  const written = new Map<string, string>();
  const backedUp: string[] = [];
  const backupPaths: string[] = [];

  return {
    write(absPath, content) {
      const rel = relative(projectDir, absPath).split(sep).join("/");
      const digest = hashContent(content);

      if (!existsSync(absPath)) {
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content);
      } else {
        const current = readFileSync(absPath, "utf8");
        if (current !== content) {
          if (!isHarnessOwned(baseline, rel, current)) {
            backupPaths.push(backupFile(absPath, now));
            backedUp.push(rel);
          }
          writeFileSync(absPath, content);
        }
      }

      written.set(rel, digest);
    },
    result() {
      return {
        files: [...written].map(([path, sha256]) => ({ path, sha256 })),
        backedUp: [...backedUp],
        backupPaths: [...backupPaths],
      };
    },
  };
}
