import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 훅 command 가 **이 프로젝트의** `.claude/` 아래 스크립트를 부르는가 — 판정 한 곳 (#551).
 *
 * `update-mode.ts` 의 죽은 참조 치유기(`keepHookRef`)와 함께 쓰는 파일 어댑터(`adapters/json-keys.ts` 의
 * settings.json 훅 핸들러 식별)가 같은 규칙을 써야 한다 — 둘이 갈라지면 한쪽이 홈 `~/.claude/` 의 설치자
 * 훅을 하네스 것으로 읽는다(H-2 · #551 리뷰 B1). 그래서 치유기 안에 살던 함수를 그대로 옮겨 왔다.
 */

/**
 * `.claude/` 라는 이름이 가리키는 대상은 **둘**이다 — 이 프로젝트의 `<projectDir>/.claude/` 와
 * 사용자 홈의 `~/.claude/`. 치유기가 소유를 주장할 수 있는 것은 앞의 것뿐이고, 뒤의 것은
 * 사용자 전역 설정(플러그인 훅이 실제로 사는 `~/.claude/plugins/**` 포함)이다. 지우면 치유가
 * 아니라 파손이다 (ADR-057 Decision 2).
 *
 * 그래서 **앵커 화이트리스트**로 짠다: 참조가 아래 접두사 중 하나로 시작할 때만 판정 대상이고,
 * 나머지는 전부 기본값 = 보존으로 떨어진다. 반대 방향(`$HOME` 을 빼고, `~` 를 빼고,
 * `${CLAUDE_CONFIG_DIR}` 를 빼고 …)으로 짜면 그 예외 목록이 두 번째 하드코딩 사본이 되어
 * **다음에 나올 표기 하나가 곧 다음 서식지**가 된다 (`no-false-ship` §게이트는 열거하지 말고
 * 훑어라 — 5회 재발한 실패 모드).
 *
 * @param claudeDir 이 프로젝트의 `.claude/` 절대경로. 문자열 비교이지 경로 정규화가 아니다 —
 *   심볼릭 링크·마운트로 표기가 갈리면 **어느 방향이든 앵커가 성립하지 않아 보존**된다:
 *   기준보다 짧게 쓰인 방향(`claudeDir` = `/private/var/…`, command = `/var/…`)은 앵커 문자열
 *   자체가 없고, 앞에 뭔가 더 붙은 방향(`/private/var/…` · 바인드마운트 `/mnt/host/var/…`)은
 *   문자열은 품고 있지만 **토큰 시작이 아니라서** 앵커가 아니다(H-4). 후자를 앵커로 세면
 *   실경로가 다른, 실존하는 남의 훅을 지운다. 정규화를 붙이려면 양쪽을 같이 정규화해야 한다.
 *   **생략하면** 절대경로 앵커 없이 `$CLAUDE_PROJECT_DIR` 두 표기만 본다 — 프로젝트 경로를 모르는 호출부
 *   (함께 쓰는 파일의 어댑터가 경로 없이 불릴 때)가 빈 문자열을 넘겨 앵커가 `/` 로 넓어지는 것을 막는다.
 * @returns `.claude/` 기준 상대경로. 앵커가 없거나 `.sh` 참조가 아니면 undefined.
 */
export function projectAnchoredRef(command: string, claudeDir?: string): string | undefined {
  const anchors = [
    "$CLAUDE_PROJECT_DIR/.claude/",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 훅 command 원문의 셸 변수 표기 (JS 템플릿 아님)
    "${CLAUDE_PROJECT_DIR}/.claude/",
    // 레거시 설치는 `$CLAUDE_PROJECT_DIR` 이전에 절대경로를 그대로 박아 넣었다 — 가리키는 곳이
    // 같은 프로젝트이므로 표기가 다르다고 면제할 이유가 없다.
    ...(claudeDir === undefined ? [] : [`${claudeDir}/`]),
  ];
  for (const anchor of anchors) {
    // 앵커는 command **어딘가에 박혀 있는 문자열**이 아니라 "참조가 여기서 시작한다"는 주장이다.
    // 그래서 출현마다 시작 경계를 보고, 토큰 중간 출현은 건너뛴 뒤 **다음 출현**을 계속 본다 —
    // 첫 출현만 보고 포기하면 (`… /mnt/host<claudeDir>/x.sh … <claudeDir>/y.sh` 처럼) 뒤에 있는
    // 진짜 앵커를 놓친다.
    for (let at = command.indexOf(anchor); at >= 0; at = command.indexOf(anchor, at + 1)) {
      // 시작 고정은 끝과 **같은 개념**이다 — 앞 문자가 토큰 문자가 아니면(= 없거나 따옴표·공백)
      // 토큰 시작이다. 구분자를 열거하면 그 목록이 토큰 정의의 두 번째 사본이 되어 빠진 형태
      // 하나가 다음 서식지가 된다. 안 하면 실경로가 다른 참조(`/private…` · 바인드마운트 ·
      // 백업 트리)를 이 프로젝트 것으로 오인해 **실존하는 남의 훅을 지운다** (ADR-057).
      // command 맨 앞(`at === 0`)은 `charAt(-1)` 이 빈 문자열이라 토큰 시작으로 떨어진다.
      if (/[^"\s]/.test(command.charAt(at - 1))) continue;
      // 끝 고정도 **토큰 경계**로 짠다 — 같은 클래스의 부정 룩어헤드가 "토큰 문자가 더 없다"
      // 하나로 따옴표·공백·문자열 끝을 전부 덮는다. 안 하면 `.sh` 가 접두사인 경로
      // (`run.shell` · `x.sh.bak`)에서 앞부분만 캡처해 실존하는 훅을 stale 로 오판한다.
      const rel = command.slice(at + anchor.length).match(/^[^"\s]+\.sh(?![^"\s])/)?.[0];
      if (rel) return rel;
    }
  }
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────────
 * settings.json 죽은 훅 참조 치유기 — update(#536) 와 install(#603) 이 같이 쓴다.
 * update-mode.ts 에서 옮겼다: installer 가 import 하려는데 installer←update-mode 의존이
 * 이미 있어 반대 방향 import 는 순환이 된다. 판정(SSOT)도 여기(projectAnchoredRef)다.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface HookCommand {
  type?: string;
  command?: string;
}

export interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

interface SettingsJson {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

/** `hook.command` 가 이 프로젝트 `.claude/` 의 스크립트를 부르는가 — 안 부르면 보존. */
export function keepHookRef(hook: HookCommand, claudeDir: string, removed: string[]): boolean {
  const relPath = projectAnchoredRef(hook?.command ?? "", claudeDir);
  if (relPath === undefined) return true; // 이 프로젝트에 앵커된 hook script 참조 아님 — 보존
  const exists = existsSync(join(claudeDir, relPath));
  // 중복 제거는 **경로 기준**. 파일명 기준이면 같은 이름이 두 디렉터리에 있을 때
  // 살아 있는 쪽 때문에 죽은 쪽이 보고에서 사라진다.
  if (!exists && !removed.includes(relPath)) removed.push(relPath);
  return exists;
}

/**
 * settings.json 의 PreToolUse/PostToolUse hooks 중 실존 파일 없는 hook script 참조 제거.
 * USAGE: "Install and update both remove any settings.json hook entry whose script file is
 * missing, and note it in the summary." 반환값 = 지운 참조의 `.claude/` 상대경로.
 */
export function cleanStaleHookRefs(settingsPath: string, claudeDir: string): string[] {
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
        hooks: entry.hooks.filter((hook) => keepHookRef(hook, claudeDir, removed)),
      }))
      .filter((entry) => entry.hooks.length > 0); // stale 제거 후 hooks 빈 entry 제거
  }

  if (removed.length > 0) {
    const next: SettingsJson = { ...settings, hooks: cleanedHooks };
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  return removed;
}
