import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// v26.121.0 — 세션 정리 유출 + 검증 명령의 조용한 실패. 둘 다 구조 게이트로 내린다.
//
// 왜 게이트인가 (recurrence-prevention 사다리):
//  · 정리 유출 — 프로즈는 이미 있었다(model-orchestration "Worker lifecycle", v26.109.0).
//    그런데 실측상 최근 30일 3,661 세션 중 백그라운드/에이전트를 쓴 30건의 **66%가 정리 흔적 0**
//    이었고, 고아 프로세스가 18시간 넘게 살아 있었다. 프로즈가 실패했으므로 구조로 내린다.
//  · 조용한 실패 — cli-development 의 BSD/GNU 표도 이미 있었다. 그런데 그 표는 *배포 스크립트*
//    를 겨냥하고, 실제 사고는 *즉석 검증 명령*에서 났다(한 세션에 3회, 마지막은 거짓 보고).
//    그 표면에는 소유자가 없었다.

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("세션 시작 시 이전 세션 고아 프로세스 감지", () => {
  const hook = read("templates/hooks/session-start.sh");

  it("탐지 로직이 훅에 있고 메시지로 연결된다", () => {
    // 계산만 하고 메시지에 안 붙이면 사용자에게 도달하지 않는다 — 있으나 마나다.
    expect(hook).toMatch(/ORPHANS=/);
    expect(hook).toMatch(/\$\{ORPHAN_NOTE\}/);
  });

  it("자기 프로젝트로 범위를 좁힌다", () => {
    // 남의 프로젝트 프로세스를 내 세션이 판정하면 안 된다. 실제로 그 오판을 한 적이 있다 —
    // 다른 저장소 소속 프로세스를 정리 대상으로 올렸다가 소유 관계를 확인하고 물러섰다.
    expect(hook).toMatch(/PROJ_DIR=/);
    expect(hook).toMatch(/index\(\$0,\s*d\)/); // awk 가 커맨드라인에서 프로젝트 경로를 찾는다
    expect(hook).toMatch(/\$2==1/); // ppid==1 = 고아만
  });

  it("죽이지 않는다 — 탐지와 보고까지만", () => {
    // 무엇을 죽일지는 사람이 정한다. 훅이 프로세스를 죽이면 되돌릴 수 없는 부수효과다.
    expect(hook).not.toMatch(/\bkill\b\s+["$]/);
    expect(hook).not.toMatch(/pkill/);
  });

  it("이식성 함정 명령을 쓰지 않는다", () => {
    // 이 훅의 실패 모드가 정확히 그것이다 — 조용히 빈 결과를 내고 "이상 없음"으로 읽힌다.
    // 주석은 제외한다: 왜 안 쓰는지 설명하려면 이름을 적어야 하고, 그걸 위반으로 세면
    // 사유를 지우는 방향으로 압력이 걸린다(이 테스트 1차 판본이 정확히 그렇게 걸렸다).
    const code = hook
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    for (const bad of ["realpath -m", "-newermt", "stat -c", "setsid"]) {
      expect(code, `${bad} 는 BSD 에서 실패한다`).not.toContain(bad);
    }
    // 주석 제거가 훅 전체를 날려버리면 위 단언이 공허해진다 — 시어터 방지.
    expect(code).toMatch(/ORPHANS=/);
  });
});

describe("무승인 git pull 을 실행하지 않는다 (D3ⓐ, ADR-058)", () => {
  // 이전에는 브랜치가 있고 detached HEAD 가 아니면 매 세션마다 승인 없이 `git pull --rebase`
  // 를 조용히(`>/dev/null 2>&1`) 돌렸다 — 로컬 커밋을 다시 쓰는 조작인데 무슨 일이 일어났는지도
  // 안 보였다. 배포판·설치본 양쪽에서 제거됐는지를 본다(한쪽만 고치면 파는 것과 쓰는 것이 갈린다).
  it.each([
    "templates/hooks/session-start.sh",
    ".claude/hooks/session-start.sh",
  ])("%s 가 git pull 을 호출하지 않는다", (path) => {
    const code = read(path)
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/git\s+pull/);
  });
});

describe("session-start 훅 실동작 (실제 고아를 만들어 검증)", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  /** 훅을 임의 cwd 에서 돌린다. 훅은 `git rev-parse` 만 쓰고 그 디렉터리가 repo 가 아니면 빈 문자열로 폴백한다. */
  const runHook = (cwd: string) =>
    execFileSync("bash", [join(ROOT, "templates/hooks/session-start.sh")], {
      cwd,
      encoding: "utf8",
    });

  it("고아가 없으면 경고하지 않고, 있으면 경고한다", () => {
    dir = mkdtempSync(join(tmpdir(), "orphan-gate-"));
    // macOS 의 /var 는 /private/var 심볼릭 링크라 mkdtemp 경로와 셸의 pwd 가 다르다.
    // 훅은 pwd 를 쓰므로 probe 경로도 pwd 기준으로 만들어야 매칭된다 — 안 그러면 이 테스트가
    // 훅의 결함이 아니라 경로 표기 차이 때문에 실패한다(1차 판본이 그랬다).
    const resolved = execFileSync("pwd", { cwd: dir, encoding: "utf8" }).trim();

    // 1) 고아 없음 → 경고 없음
    expect(runHook(dir)).not.toContain("orphaned");

    // 2) 이 디렉터리 경로를 argv 에 담은 고아를 만든다. 부모 sh 가 즉시 끝나 ppid=1 로 재부모화된다.
    const probe = join(resolved, "probe.sh");
    writeFileSync(probe, "#!/bin/sh\nsleep 30\n", { mode: 0o755 });
    const devnull = openSync("/dev/null", "w");
    try {
      execFileSync("sh", ["-c", `nohup ${probe} >/dev/null 2>&1 &`], { stdio: "ignore" });
      // 프로세스가 뜰 때까지 짧게 기다린다 — 폴링이라 느린 머신에서도 견딘다.
      let seen = false;
      for (let i = 0; i < 50 && !seen; i++) {
        seen = execFileSync("ps", ["-eo", "command"], { encoding: "utf8" }).includes(probe);
        if (!seen) execFileSync("sleep", ["0.1"]);
      }
      expect(seen, "probe 프로세스가 뜨지 않았다 — 테스트 전제 실패").toBe(true);

      expect(runHook(dir)).toContain("orphaned");
    } finally {
      closeSync(devnull);
      // 이 테스트가 만든 것은 이 테스트가 치운다 — 정리 유출을 막는 테스트가 유출하면 곤란하다.
      try {
        execFileSync("pkill", ["-f", probe], { stdio: "ignore" });
      } catch {
        /* 이미 종료 */
      }
    }
  });
});

// 2026-08-26 (사용자 결정) — 아래에 있던 **룰 산문 단언 3블록을 걷어냈다.**
//   ⓐ cli-development 가 "빈 결과는 부재의 증거가 아니다" 등 원칙 문장을 담는지
//   ⓑ 룰에 날짜·사고 서사가 없는지  ⓒ git-policy §Session Cleanup 이 특정 낱말을 담는지
//
// 룰·스킬·훅은 **개별 독립 자산**이고 바꿀 때 그 이유나 이슈를 커밋에 첨부한다 — 본문의
// 뜻이 옳은지는 코드가 아니라 리뷰어가 판정하고, 왜 바뀌었는지는 git 이 기록한다
// (`change-management` §독립 변경 요청). 어휘로 의미를 판정하는 설계는 #345 에서 세 라운드
// 내내 우회당했다: 조이면 정당한 동의어 개정이 막히고 풀면 의미 반전이 샌다.
//
// **위에 남은 것은 산문이 아니라 실행 가능한 계약이다** — 훅 스크립트가 프로세스를 죽이지
// 않는지, 이식성 함정 명령을 쓰지 않는지, 고아가 있을 때만 경고하는지. 그건 돌려서 판정된다.
