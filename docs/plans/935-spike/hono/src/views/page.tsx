// #935 spike — Hono 서버 JSX(hono/jsx) 템플릿. 줄 번호로 보고를 대조한다.
import type { FC } from "hono/jsx";
// 깨끗해야 하는 줄 (daisyUI 컴포넌트 클래스)
export const OkClass: FC = () => <div class="card bg-base-100"><button class="btn btn-primary" hx-post="/save">ok</button></div>;
// 위반 줄 — class 속성
export const BadClass: FC = () => <button class="btn bg-pink-500 p-[13px]">bad</button>;
// 인라인 style — 문자열(8행)·객체(9행) 두 형태. 실측 2026-11-03: no-inline-styles 는 객체(9행)만 잡고 문자열(8행)은 놓친다
export const BadStyle: FC = () => <div class="card" style="color: red">bad</div>;
export const BadStyleObj: FC = () => <div class="card" style={{ color: "red" }}>bad</div>;
// 양성 대조 — 오타 클래스(no-unknown-classes 가 Tailwind 를 실제로 읽는지)
export const Typo: FC = () => <div class="rounded-huge btnn">typo</div>;
