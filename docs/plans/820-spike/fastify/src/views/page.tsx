// #820 spike — Fastify 서버 JSX 템플릿. 줄 번호로 보고를 대조한다.
// 깨끗해야 하는 줄 (daisyUI 컴포넌트 클래스)
export const OkClass = () => <div class="card bg-base-100"><button class="btn btn-primary">ok</button></div>;
export const OkClassName = () => <div className="card bg-base-100"><button className="btn btn-primary">ok</button></div>;
// 위반 줄 — class 속성
export const BadClass = () => <button class="btn bg-pink-500 p-[13px]">bad</button>;
// 위반 줄 — className 속성
export const BadClassName = () => <button className="btn bg-pink-500 p-[13px]">bad</button>;
// 양성 대조 — 오타 클래스(no-unknown-classes 가 Tailwind 를 실제로 읽는지)
export const Typo = () => <div className="rounded-huge btnn">typo</div>;
