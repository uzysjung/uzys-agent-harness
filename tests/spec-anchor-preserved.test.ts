import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Foundation(v26.38) SPEC 앵커는 `DO NOT CHANGE 본문` 으로 의도적으로 보존된 문서다.
 * 2026-07-29 사용자 승인으로 `docs/SPEC.md` → `docs/archive/` 로 **이동만** 했고,
 * 그 승인의 전제가 **"없어지는 내용 0줄"** 이었다.
 *
 * 이동은 되돌리기 쉽지만 "옮기면서 조금 고치기"는 조용하다 — 그래서 해시로 고정한다.
 * 이 테스트가 red 면 둘 중 하나다: ⓐ 보존 약속이 깨졌다 ⓑ 사용자가 새로 승인해 바꿨다.
 * ⓑ 라면 승인 근거를 커밋 본문에 적고 아래 상수를 갱신한다 — 상수만 조용히 고치지 않는다.
 */
const ANCHOR = join(__dirname, "..", "docs", "archive", "spec-foundation-v26.38.md");
const ANCHOR_SHA256 = "4d74d989a5bf28afb533b5e34aee4a4f529081a4e5a17358404dccd454674b12";

describe("보존된 SPEC 앵커 (docs/archive/spec-foundation-v26.38.md)", () => {
  it("파일이 존재한다 — 부재를 통과로 읽지 않는다", () => {
    // 경로가 바뀌면 아래 해시 단언은 읽을 대상이 없어 조용히 죽는다. 존재부터 단언한다.
    expect(existsSync(ANCHOR), `보존 앵커가 없다: ${ANCHOR}`).toBe(true);
  });

  it("내용이 이동 전과 byte 단위로 같다", () => {
    const actual = createHash("sha256").update(readFileSync(ANCHOR)).digest("hex");
    expect(
      actual,
      "보존 앵커의 내용이 바뀌었다 — 이동 승인의 전제는 '없어지는 내용 0줄' 이었다. " +
        "의도한 변경이면 승인 근거를 커밋 본문에 적고 ANCHOR_SHA256 을 갱신하라.",
    ).toBe(ANCHOR_SHA256);
  });

  it("DO NOT CHANGE 표식이 살아 있다 — 해시가 무엇을 지키는지의 의미 확인", () => {
    // 해시만 있으면 '무엇을 지키는지'가 상수 뒤에 숨는다. 지키려는 성질을 따로 단언한다.
    const body = readFileSync(ANCHOR, "utf8");
    expect(body).toContain("DO NOT CHANGE");
    expect(body).toContain("의도적으로 보존");
  });
});
