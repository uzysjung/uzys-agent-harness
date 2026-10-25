/**
 * #919 — 화면 문장 안에 찍는 기록 · 디스크 유래 이름(설치 기록의 경로 · 링크 대상 · 디렉터리 항목)을 한 토막에 가둔다. 남이 커밋한 기록은
 * 경로에 줄바꿈 · 공백 · 셸 메타 문자를 넣어 화면에 진짜와 같은 명령 줄(`mv -i .env.backup-… .env`)을 끼울 수 있다 — 줄바꿈은 새 줄을,
 * 공백 채우기는 터미널 줄바꿈으로 보이는 줄을, `$(…)` · `;` 는 복사해 친 줄에서 명령을 만든다.
 *
 * 경로에 흔한 글자(글자 · 숫자 · `._-/~+@:,=%`)와 **낱개 공백**(앞뒤가 공백이 아닌 글자인 공백 하나 — `My Drive` · `Application
 * Support`)은 그대로 두고, 나머지(앞뒤 끝의 공백 · 두 칸 이상 이어진 공백 포함)는 `\uXXXX` 로 적는다. 하네스가 쓰는 경로 · 평범한 링크
 * 대상(`../shared` · `/Users/me/My Drive/dotfiles` · 한글 폴더)은 그대로라 정상 설치본의 화면은 바뀌지 않는다.
 */
export function screenText(text: string): string {
  return text.replace(/[^\p{L}\p{N}\p{M}._\-/~+@:,=%]/gu, (ch, at: number) => {
    if (
      ch === " " &&
      at > 0 &&
      at < text.length - 1 &&
      text[at - 1] !== " " &&
      text[at + 1] !== " "
    ) {
      return ch;
    }
    return asCode(ch);
  });
}

/**
 * #910 · #919 — 문장(공백이 정상인 글자)에 찍는 기록 유래 글자의 제어 문자(줄바꿈 · CR · ESC 포함)만 `\uXXXX` 로 적어 한 줄에 가둔다.
 * 평범한 문장은 그대로다.
 */
export function oneLine(text: string): string {
  return text.replace(/[\p{Cc}\u2028\u2029]/gu, asCode);
}

function asCode(ch: string): string {
  const cp = ch.codePointAt(0) as number;
  return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, "0")}`;
}
