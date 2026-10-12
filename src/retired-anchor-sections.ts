/**
 * #739 — 마커 없는 옛 판(v26.70.0 ~ v26.159.0) `AGENTS.md` 의 `## Project Rules` 에 하네스가 통째로 써 넣은 앵커 절의 지문.
 *
 * 그 판들은 `templates/CLAUDE.md` 본문(첫 h1 제거 · `/uzys:` → `/uzys-`)을 그대로 넣었고 앵커 마커가 없었다(마커 = v26.160.0, #503).
 * update 가 그 본문을 최신판으로 갈아 끼울 때, 지금 렌더에 없는 `## ` 절이 **하네스가 쓰고 은퇴시킨 앵커 절**인지
 * **설치자가 적은 절**인지를 이 지문으로 가른다 — 제목과 본문이 옛 판 그대로일 때만 하네스 것이다(설치자가 한 줄이라도
 * 고쳤으면 설치자 글로 남긴다 — 잃는 쪽보다 남는 쪽이 안전하다).
 *
 * **고정 목록이다** — v26.160.0 부터는 앵커가 마커 안에 있어 이 경로를 타지 않으므로 새 판이 나와도 늘지 않는다.
 * 지문 = sha256(절 줄들의 끝 공백 제거 · 끝 빈 줄 제거 · "\n" 으로 이음). 뽑은 방법 = 위 태그 범위의 `templates/CLAUDE.md`
 * 를 같은 규칙으로 절로 나눠 해시(`retiredAnchorSectionKey`).
 *
 * #774 (ADR-111) — 목록과 지문 함수는 생성물 `src/legacy-fingerprints.ts`(생성기 `scripts/gen-legacy-fingerprints.mjs`)가 SSOT 다.
 * 여기서는 기존 이름으로 다시 내보낸다 — 손목록 53개가 생성 집합과 같음은 `tests/legacy-fingerprints.test.ts` 가 못 박는다.
 */
export {
  legacySectionKey as retiredAnchorSectionKey,
  RETIRED_ANCHOR_SECTION_KEYS,
} from "./legacy-fingerprints.js";
