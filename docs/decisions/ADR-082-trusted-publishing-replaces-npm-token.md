# ADR-082: npm 게시 인증을 장수 토큰에서 Trusted Publishing(OIDC)으로 옮긴다

- Status: Accepted
- Date: 2026-08-30
- PR: #393
- Context:
  v26.149.0 게시가 **두 번 연속 막혔다.** 검증(`ci` · `docker-e2e` · `install-matrix` ·
  `docker-scenarios`)은 전부 초록이었고 마지막 한 칸만 터졌다.

  | 시도 | 오류 | 뜻 |
  |---|---|---|
  | 1 | `E404` on `PUT` | 토큰이 이 패키지에 게시할 권한 없음 (npm 은 존재를 숨기려 403 대신 404 를 낸다) |
  | 2 (토큰 갱신 후) | `EOTP` | 인증은 됐는데 **2FA 일회용 코드 요구** — CI 에는 넣을 사람이 없다 |

  조사(공식 문서 · context7)에서 **토큰 경로 자체가 막다른 길**임이 드러났다:

  - Classic **Automation 토큰은 2025-11 에 폐기**됐다. 지금은 Granular 하나뿐이다.
  - Granular 의 **`Bypass 2FA` 는 생성 시 기본이 꺼짐**이고, 켜도 **패키지가 "2FA 필수 +
    토큰 불허" 면 설정과 무관하게 금지**된다.
  - 그 Bypass 자체가 **2027년 1월경 직접 게시 능력을 잃는다**(GAT bypass2fa deprecation).
    즉 토큰을 고쳐 넘겨도 **5개월 뒤 같은 자리에서 다시 막힌다.**

  덧붙여 이 저장소에는 **토큰 부재 시 graceful skip**(warning + `exit 0`)이 있었다.
  "게시가 조용히 안 일어나는데 초록으로 끝난다"는 형태이고, v26.128.0~131.0 이 정확히
  그 계열의 사고였다(ADR-077 G5 가 그래서 생겼다).

- Decision:
  **npm 게시에서 장수 자격증명을 없앤다.** GitHub Actions 가 npm 에 OIDC 로 직접 신원을
  증명하고, npm 쪽에는 Trusted Publisher 를 등록한다
  (`uzysjung` / `uzys-agent-harness` / **`test.yml`** / `npm publish`).

  워크플로에 붙은 것:
  - `permissions: { id-token: write, contents: read }` — 이 줄이 없으면 npm 이 익명으로 본다
  - 러너 Node 20 → 24 · 게시 직전 npm CLI 최신화 (OIDC 는 **npm ≥ 11.5.1 · Node ≥ 22.14.0**).
    이 Node 는 **러너의 것**이고 패키지 `engines: >=20` 과 무관하다 — 그쪽은 `ci` 매트릭스가
    계속 검증한다
  - `NODE_AUTH_TOKEN` 과 **graceful skip 제거**. 신원이 없으면 게시는 **소리 내며 실패한다**

  **게시 job 은 `test.yml` 안에 그대로 둔다.** npm 의 Trusted Publisher 는 워크플로 **파일명**에
  묶이므로 `publish.yml` 로 빼는 편이 이름은 자연스럽지만, `needs:` 는 **같은 워크플로 파일
  안에서만** 성립한다 — 쪼개면 ADR-077 이 세운 "검증이 게시를 가른다"가 무너진다(v26.128.0~131.0
  의 사고 형태). **이름의 자연스러움보다 배선이 우선**이고, 그래서 등록값이 `test.yml` 이다.

- Alternatives:
  - **Granular 토큰에 `Bypass 2FA` 를 켠다** — 기각. ⓐ 패키지가 "토큰 불허" 설정이면 애초에
    불가능하고(외부에서 판별 불가) ⓑ 되더라도 2027년 1월에 같은 자리에서 다시 막힌다.
    토큰 갱신 왕복도 계속 남는다.
  - **Staged publishing (사람이 승인)** — 기각. 게시마다 사람 개입이 필요해 릴리즈가 느려지고,
    이 저장소의 게시는 이미 `needs:` 로 검증에 묶여 있어 추가 관문의 이득이 작다.
  - **게시 job 을 `publish.yml` 로 분리** — 기각. 위 Decision 의 배선 사유.

- Consequences:
  - **토큰 관리가 사라진다.** 만료·회전·권한 왕복이 없다. 저장소 시크릿에서 `NPM_TOKEN` 이
    더는 쓰이지 않는다(값 삭제는 별건 — 다른 워크플로가 쓰지 않는지 확인 후 사용자가 정한다).
  - **조용한 미게시 경로가 하나 없어졌다.** 종전에는 토큰이 없으면 warning + `exit 0` 이었고,
    ADR-077 G5 의 registry 재확인 스텝이 그것을 뒤에서 막고 있었다. 이제 게시 자체가 실패한다 —
    **재확인 스텝은 여전히 필요하다**(게시 명령 성공 ≠ registry 반영).
  - **워크플로 파일명이 계약이 됐다.** `test.yml` 을 rename 하거나 게시 job 을 다른 파일로
    옮기면 **npm 쪽 등록과 어긋나 게시가 막힌다.** 옮길 일이 생기면 npm Trusted Publisher
    등록을 같이 바꾼다.
  - **첫 성공은 v26.149.0** 이다(2026-08-30). 그전 판본은 전부 토큰으로 나갔다.
  - 검증 배선(`needs: [ci, docker-e2e]` · 태그 `if:` 가드)은 **손대지 않았다** —
    `tests/publish-needs-verification-gate.test.ts` 통과로 확인했다.
