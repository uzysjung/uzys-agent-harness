/**
 * owned-write.ts — 소유자 판정을 붙인 파일 쓰기 (v26.133.0 · ADR-048).
 *
 * ADR-046(스킬) → ADR-047(`.claude/` 정책 파일)이 정한 규칙을 **하네스가 렌더해서 내보내는
 * 모든 산출물**에 쓰기 위한 공통 도구. 그 두 ADR 의 구현이 각각 자기 자산 종류에만 걸려서
 * 같은 버그가 두 번 났다 — 세 번째를 막으려면 규칙이 자산별 코드가 아니라 **한 도구**에 있어야
 * 한다 (`feedback_surface_symmetry` "결정의 범위 ≠ 구현의 범위").
 *
 * 쓰는 쪽이 방금 쓴 내용을 알고 있으므로 **그 자리에서 기준선을 만든다** — `.claude/` 쪽 writer(`install-writes.ts`)와
 * 같은 방식이다(#796 PR-A 로 update 의 디스크 재스캔이 사라졌다). 경로 목록을 따로 하드코딩할 필요가 없다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { foreignOwnedTarget } from "./foreign-slot.js";
import { backupFile } from "./fs-ops.js";
import {
  hashContent,
  type InstallLogPortion,
  type InstallLogRootFile,
  type InstallLogSkillFile,
} from "./install-log.js";
import type { JudgedWrite } from "./install-writes.js";
import { judge, type Recorded, withBackup } from "./judge.js";
import { createOutsideGuard, type OutsideLink } from "./outside-project.js";

/**
 * #600 — 쓴 것을 **쓰는 그 자리에서** 받아 적는 곳. transform 의 결과(`result()`)는 transform 이 끝까지 돌아야
 * 나오므로, 중간에 던지면(EACCES · ENOTDIR …) 그때까지 쓴 파일이 기록 밖에 남는다. install 은 이 저널로 중단된
 * 실행의 기록을 남겨 같은 install 재실행 · `uninstall` 이 그 파일을 하네스 몫으로 알아보게 한다.
 */
export interface WriteJournal {
  /** 하네스 파일 하나를 썼다(같은 내용이라 기준선만 이었을 때도) — `result().files` 와 같은 항목. */
  file(f: InstallLogSkillFile): void;
  /** 함께 쓰는 파일 하나의 몫을 판정해 썼다 — 이 경로의 몫 전체(빼기는 기록하지 않는다 — ADR-099 R1). */
  portions(path: string, portions: ReadonlyArray<InstallLogPortion>): void;
  /** 설치자 파일을 덮기 전에 남긴 백업(절대경로) — 멈춘 화면이 "당신 파일은 여기 있다" 를 말한다. */
  backup(absPath: string): void;
  /** #761 — 첫 접촉 자리(`rootFiles.change = displaced`). 멈춘 실행의 기록도 되돌리기 근거를 잃지 않는다. */
  displaced?(f: InstallLogRootFile): void;
}

/**
 * 한 transform 실행의 소유권 결과. **세 transform 이 같은 타입을 반환한다** — 필드가 늘 때
 * 세 곳을 따로 고쳐야 하는 구조를 만들지 않기 위해서다 (이 파일이 존재하는 이유와 같다).
 */
export interface OwnedWriteResult {
  /** 이번 실행이 쓴 산출물의 기준선 (projectDir 상대경로 → sha256). install log 에 실린다. */
  files: InstallLogSkillFile[];
  /**
   * 사용자 편집분이라 백업한 **원본**의 project-relative 경로 — 사용자가 알아보는 이름. 기준선에 **있는** 경로만이다 —
   * 기준선에 없는 자리(첫 접촉)는 고친 것이 아니라 설치자 파일이라 `displaced` 로 간다(#761).
   */
  backedUp: string[];
  /** #817 — 판정이 백업을 낸 파일마다 그 줄(실제 백업 경로가 든 것) — update 화면이 파일마다 그대로 말한다. 부재 = 없음. */
  judged?: JudgedWrite[];
  /**
   * #761 (ADR-097 결정 7) — 기준선에 없는 자리에 있던 설치자 파일(첫 접촉). 다르면 `notes[0]` = 백업(project-relative)이고
   * 하네스 판이 자리를 잡는다(`files` 에도 든다) · 같으면 백업 없이 그대로 두고 하네스 것으로 삼지 않는다(Q3 — `files` 에 없다).
   * 기록의 `rootFiles` 로 가서 하네스가 떠날 때 되돌리는 근거가 된다. optional = 손으로 만드는 결과 stub 은 "없음".
   */
  displaced?: InstallLogRootFile[];
  /**
   * #343 — 다른 도구가 소유한 스킬 슬롯이라 **쓰지 않은** 자리 (project-relative).
   *
   * `.agents/skills/<id>` 는 codex·antigravity 산출물의 자리이자 `npx skills add --agent` 의
   * 설치처다. 그동안 이 writer 는 그 자리가 링크여도 따라 써서 사용자의 다른 저장소를 덮고,
   * 백업까지 **그 저장소 안에** 떨궜다 — 사용자가 찾을 자리가 아니다 (ADR-062 와 같은 논거).
   */
  foreignOwned: string[];
  /**
   * #678 — 링크를 따라가면 **프로젝트 밖**이라 쓰지 않은 자리. 남의 도구 슬롯(`foreignOwned`)과 다른 사실이다 —
   * 저쪽은 "그 자리가 남의 것", 이쪽은 "그 실체가 이 프로젝트 밖"이고 화면이 대상 경로를 함께 댄다.
   */
  outside?: OutsideLink[];
  /** 생성된 백업 파일의 절대경로 — 설치 화면의 `backup` 행이 이걸 쓴다. */
  backupPaths: string[];
  /**
   * ADR-099 R2 — refresh 모드(update)에서 기준선(`externalFiles` 기록)에 있는데 디스크에 없어 **되살린** 파일
   * (project-relative). 손으로 지운 것은 빼기가 아니다 — update 화면이 `was missing — restored` 로 알린다.
   */
  restored?: string[];
  /**
   * 실제로 디스크가 바뀐 파일 수 (신규 + 내용이 달라 덮어쓴 것). 이미 최신이라 아무것도 안 한
   * 파일은 세지 않는다 — update 화면이 "N files updated" 로 쓰므로, 안 한 일을 셌다가는
   * 매번 같은 숫자가 떠서 갱신이 일어난 것처럼 보인다.
   */
  updated: number;
}

export interface OwnedWriter {
  /**
   * 소유자 판정을 거쳐 쓴다 — 판정은 ADR-097 표(`judge`, `kind: "harness"`) 하나다(#797). 기록 상태는 기준선에 있으면
   * `sha` · `owned` 면 `no-sha`(체크섬 없는 옛 판) · 아니면 `none`(첫 접촉 → `displaced`). refresh 모드에서 없는 파일은
   * **건너뛴다** — 기준선에 있는 경로만 되살린다(ADR-099 R2).
   *
   * @returns 이 경로를 이번에 담당했는가. `false` 는 **안 썼다**는 뜻이고 경우는 둘이다 —
   *   refresh 모드에서 없는 파일을 건너뛴 경우, 그리고 #343 이후 **남의 도구가 소유한 슬롯**인 경우.
   *   호출자가 쓰기 성공을 전제로 하는 후속 동작(예: `chmod`)을 그때 건너뛰게 하려는 것이고,
   *   반환을 무시해도 되는 호출부는 무시해도 안전하다. `void` 로 두면 건너뛴 경로에
   *   `chmodSync` 가 걸려 ENOENT 로 터진다.
   */
  write(absPath: string, content: string, opts?: WriteOptions): boolean;
  /**
   * #678 — 이 writer 를 거치지 않고 직접 쓰는 자리(설치자 파일에 몫만 더하는 `shared-write`)도 같은 판정을 받는다.
   * true 면 실체가 프로젝트 밖이다 — 쓰지 말 것. 그 자리는 `result().outside` 에 실린다.
   */
  skipOutside(absPath: string): boolean;
  /** 이번 실행의 소유권 결과 — transform 이 그대로 report 에 실어 반환한다. */
  result(): OwnedWriteResult;
  /** #600 — 함께 쓰는 파일(`writeShared`)도 같은 저널에 적도록 넘긴다. 없으면 적지 않는다. */
  readonly journal?: WriteJournal;
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
  /**
   * #774 (ADR-111) — 기준선 그대로인 하네스 파일이라도 바꾸기 **전** `.backup-<stamp>` 1회를 남긴다. 이번 쓰기가 옛 판이 바이트
   * 그대로 쓴 몫(현행 번들에 없어 다시 깔아도 돌아오지 않는다)을 떨어뜨릴 때 호출부가 켠다. 설치자 편집이 아니므로 `backedUp` 에는
   * 싣지 않는다(화면이 "edited" 라 부르지 않게) — 백업 경로만 남긴다.
   */
  backupFirst?: boolean;
}

export interface OwnedWriterOptions {
  now?: Date;
  refreshOnly?: boolean;
  /** #600 — 쓰는 즉시 받아 적을 곳(install). update 는 넘기지 않는다. */
  journal?: WriteJournal;
  /**
   * #761 B-1 — 기준선 밖이어도 기록이 하네스 것이라 말하는 경로(`recordedOwner(log)` — 외부 기록이 아예 없던 옛 판의 산출물은
   * `no-sha`). 그 자리는 첫 접촉이 아니라 체크섬 없는 하네스 파일이다: 같으면 기준선에 싣고, 다르면 1회 백업 뒤 `backedUp`.
   * 생략 = 기준선만 본다(로그 없는 엔진 호출).
   */
  owned?: (rel: string) => boolean;
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
  const { now = new Date(), refreshOnly = false, journal, owned = () => false } = options;
  const written = new Map<string, string>();
  const backedUp: string[] = [];
  const judged: JudgedWrite[] = [];
  const backupPaths: string[] = [];
  const foreignOwned: string[] = [];
  const restored: string[] = [];
  const displaced = new Map<string, InstallLogRootFile>();
  const outside = createOutsideGuard(projectDir);
  const displace = (f: InstallLogRootFile): void => {
    displaced.set(f.path, f);
    journal?.displaced?.(f);
  };
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
      // #678 — 실체가 프로젝트 밖이면 쓰지도 · 백업하지도 · 기준선에 싣지도 않는다(같은 `false` 계약).
      if (outside.skip(absPath)) return false;
      const recordedSha = baseline.get(rel);
      // 기록 상태 — 기준선에 있으면 sha · 기준선 밖이어도 기록이 하네스 것이라 말하면(B-1 · 옛 판) no-sha · 아니면 첫 접촉.
      const rec: Recorded =
        recordedSha !== undefined
          ? { state: "sha", sha256: recordedSha }
          : { state: owned(rel) ? "no-sha" : "none" };
      const disk = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
      // refresh 모드: 없는 파일은 사용자가 안 고른 것 → 새로 깔지 않는다(판정이 아니라 대상 선택). 예외 ⓐ `createInRefresh`
      // (호출부가 그 CLI 의 설치 증거를 이미 잡은 경우) ⓑ **기준선에 있는 경로**(ADR-099 R2) — '기록에 있다' 가 그 CLI 의
      // 설치 증거다. 손으로 지운 것은 빼기가 아니라 되살린다(빼기는 `uninstall --cli`).
      if (disk === null && refreshOnly && !opts?.createInRefresh && rec.state !== "sha")
        return false;
      const { verdict, record, line } = judge({
        op: "write",
        kind: "harness",
        rec,
        disk,
        next: content,
      });
      let backupRel: string | null = null;
      // #774 (ADR-111) `backupFirst` — 기준선 그대로인 파일을 덮기 전 1회. 판정이 아니라 실행 방식이라 `overwrite` 에서만 읽는다.
      if (
        verdict === "backup+overwrite" ||
        (verdict === "overwrite" && opts?.backupFirst === true)
      ) {
        const backup = backupFile(absPath, now);
        backupPaths.push(backup);
        journal?.backup(backup);
        backupRel = relative(projectDir, backup).split(sep).join("/");
        // 고친 것(sha) · 체크섬 없는 옛 판(no-sha) — 까닭은 판정의 줄이 말한다(#817). 첫 접촉은 `displaced` 로도 간다.
        if (verdict === "backup+overwrite") {
          if (rec.state !== "none") backedUp.push(rel);
          judged.push({
            path: rel,
            verdict,
            line: withBackup(line, backupRel),
            backup: backupRel,
            backupAbs: backup,
          });
        }
      }
      // #761 — 첫 접촉 자리는 하네스가 떠날 때 되돌릴 근거(`displaced`). Q3 같음 = 백업 없이 두고 하네스 것으로 적지 않는다 —
      // 그래도 이 경로를 **담당했다**(`true`): `writeBundledSkillDirs` 는 `SKILL.md` 를 맡았을 때만 형제 파일을 쓴다(설계 §11 ⑦).
      // 쓰기 **전에** 적는다 — 덮어쓰기가 실패해 설치가 멈춰도 기록이 백업 자리를 가리킨다(PR #810 리뷰 MEDIUM).
      if (record === "displaced" || record === "displaced+sha") {
        displace({ path: rel, change: "displaced", notes: backupRel === null ? [] : [backupRel] });
      }
      if (verdict !== "leave") {
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content);
        updated++;
        if (refreshOnly && verdict === "create" && rec.state === "sha") restored.push(rel);
      }
      if (record === "sha" || record === "displaced+sha") {
        const digest = hashContent(content);
        written.set(rel, digest);
        journal?.file({ path: rel, sha256: digest });
      }
      return true;
    },
    ...(journal === undefined ? {} : { journal }),
    skipOutside: (absPath) => outside.skip(absPath),
    result() {
      return {
        foreignOwned: [...foreignOwned],
        outside: outside.list(),
        files: [...written].map(([path, sha256]) => ({ path, sha256 })),
        backedUp: [...backedUp],
        judged: [...judged],
        backupPaths: [...backupPaths],
        updated,
        restored: [...restored],
        displaced: [...displaced.values()],
      };
    },
  };
}
