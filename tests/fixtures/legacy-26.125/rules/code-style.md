# Code Style

포매터/린터 설정(ruff, prettier, eslint, tsconfig strict, naming)은 각 프로젝트 config 파일이 SSOT. 여기는 Rule로 강제할 비구조적 원칙만.

## 불변성

기존 객체 mutation 금지. 새 객체 생성(spread/immer). 외부 상태 공유 시 side effect 숨은 버그의 주 원인.

## 크기/복잡도 상한

- 파일: 800줄 상한. 초과 시 분리.
- 함수: 50줄 상한.
- 중첩: 4레벨 상한. early return으로 평탄화.

상한 초과는 곧 리팩터링 시그널. 예외가 있으면 주석으로 사유 명시.

## 하드코딩/매직 넘버 금지

상수 또는 환경 변수. 의미 있는 이름 필수.

## 타입 강도

`any`/`type: ignore` 최소화. 불가피 시 한 줄 사유 주석. 이외 명명/포매팅은 linter가 판정.
