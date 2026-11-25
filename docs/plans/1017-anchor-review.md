# 하네스 앵커(Working Principles) 문장별 검토 — 무엇을 남기고 무엇을 내릴까 (#1017)

- 기준: main @ `c47ea6a4` (v26.188.0, 2026-11-25). 읽기 전용 검토이고 이 파일 말고는 아무것도 고치지 않았다.
- 대상: 배포 앵커 원본 `templates/CLAUDE.md` — 5,787 B · 110줄 · **49문장**(머리말 5 · §1 6 · §2 10 · §3 4 · §4 8 · §5 9 · §6 7). 토큰은 약 1,447(비용 계측기와 같은 chars/4 근사)로, tooling 트랙 상주 지시문 ~4,210 의 약 1/3 이다(`npm run cost:report` 2026-11-25 실행).
- 앞선 조사 `docs/research/working-principles-2026-11.md`(2026-11-03) 위에 쌓는다. 그 뒤 생긴 것 — 하네스 있음 · 없음 비교 3건(#513), 없는 입력 문장의 측정(ADR-121), 설치 프로젝트 관측 3건(#1006 · #1011 · #1013), 벤더 원문 재확인 — 을 문장마다 대조했다.
- 유료 모델 실행은 하지 않았다. 재야 답이 나오는 것은 §8 에 방법으로 남겼다.
- 앵커 문안은 사용자 소유다(ADR-091). 아래 판정은 전부 사용자 결정의 입력이지 결정이 아니다.
- **2판(2026-11-25).** 1판은 §2 다단계 문단(`S19`–`S21`)을 "채택 때 건 만료 조건이 지났다"는 이유로 내리자고 권했다. 독립 리뷰가 그 근거가 틀렸음을 짚었다 — 같은 제안이 2026-11-03 조사에 있었고, 사용자가 만료 시계가 끝난 뒤에 ADR-115 로 기각했다. 2판은 그 판정을 **유지**로 바꾸고, 설치 판 확인 결과(§0)를 문서 전체에 반영했다.

---

## 0. 권한 요청과 확인 결과

**열려 있는 권한 요청은 하나다.** 이 레인이 할 수 없는 확인이라 결론을 내리지 않고 조건으로 남겼다.

| # | 무엇을 | 왜 결론에 필요한가 | 승인되면 확인되는 것 | 비용 · 위험 |
|---|---|---|---|---|
| 2 | §8 의 측정 M2(앵커 현행 · 핵심만 · 없음 세 구성 비교)와 T9 전용 팔을 돌린다 | "근거 없음" 23문장은 돕는다는 근거도 해친다는 근거도 없다. 지우거나 바꾸려면 재야 한다. §2 다단계 문단(`S19`–`S21`)을 다시 열 조건도 여기서 나온다 | 23문장을 상주에서 내려도 설치자 작업이 나빠지지 않는지 · 지금 모델이 다단계 문단 없이도 같은 분해를 하는지 | 유료 모델 실행. 상위 등급 한 벌에 약 $85(±2배, 계산은 §8) · GLM 등급은 단가 기록이 없어 추정하지 않았다 |

**권한 요청 1 은 풀렸다 — 확인 결과 (2026-11-25, 메인 세션이 읽기 전용으로 확인)**

1판은 관측이 나온 설치 프로젝트 두 곳의 그때 설치 판을 권한 요청으로 남겼다. 메인 세션이 읽어 확인했다. 설치 기록에는 판 번호 필드가 없어서, 기록의 `installedAt` 과 태그 날짜로 맞추고 설치된 앵커 본문을 직접 읽었다.

| 프로젝트 | 설치 | 앵커 상태 | §2 다단계 문단(`S19`–`S21`) | §4 둘째 문단(`S28` `S29`) |
|---|---|---|---|---|
| ① | 2026-11-09 (그날 최신 v26.185.0) | 루트 `CLAUDE.md` 가 `@CLAUDE-uzys-harness.md` 로 상주 | 있음 | 있음 |
| ② | 2026-11-09 (같은 판) | **사용자가 2026-09-21 앵커를 제거했다** — 프로젝트 `CLAUDE.md` 에 "다시 만들지 않는다"고 적혀 있고, import 블록에는 상시 스킬 안내만 있다 | 없음 | 없음 |

- **확인된 것.** 같은 실패(플로우를 레인 · PR 여럿으로 쪼갬, 구현마다 검토)가 두 문단이 상주한 프로젝트 ①에서도, 앵커가 없는 프로젝트 ②에서도 관측됐다(#1006 2026-11-23 · #1011 2026-11-24 — 설치 뒤의 관측이다. 11-09 뒤에 다시 갱신하지 않았다는 전제이고 기록의 `installedAt` 이 그렇게 읽힌다). 그 판(v26.185.0)에는 개발 룰의 같은 뜻 문장도 들어 있다 — Delivery 룰의 "작은 수정마다 전체 검증을 반복하지 않고"는 2026-09-13, "영향 · 불확실성 · 복구 비용 · 이미 있는 증거"는 2026-10-12 에 들어왔다(`git log -S`). 프로젝트 ①에 그 룰 파일이 그대로 깔려 있었는지는 이 확인에 들어 있지 않다 — 구현 레인을 쓰는 프로젝트라 개발 트랙 설치로 읽었을 뿐이다.
- **이 관측이 말하는 범위.** 두 문단은 그 실패를 **막지 못했다.** "문단의 있고 없음이 실패를 가르지 않았다"까지는 말하지 못한다. 프로젝트별 빈도가 없고, 프로젝트 ②는 앵커가 없을 뿐 지시가 없는 곳이 아니다 — #1006 본문은 묶으라는 규칙 문장이 어긴 순간에도 맥락에 있었다고 적는데, ②에서 그 문장은 앵커가 아닌 다른 자리에서 왔다. 문단이 빈도를 줄이고 있었을 가능성은 이 관측으로 배제되지 않는다. 프로젝트 2곳의 통제 없는 관측이다.
- **여전히 확인되지 않은 것.** E4a(#818 · #819, 2026-10-13 ~ 14)는 이 설치보다 앞선다. 그때 프로젝트 ①의 설치 판은 모른다. 프로젝트 ②는 그때 이미 앵커가 없었으므로 ②의 E4a 관측은 앵커 문장에 대해 아무것도 말하지 않는다.
- **판정에 주는 영향.** `S28` · `S29` 의 조건 ①은 E4c(#1011)에 한해 섰다. 남은 것은 조건 ②(개발 룰이 안 깔리는 트랙의 손실을 감수할지) 하나이고 사용자 결정이다. `S19`–`S21` 에는 `S20` 이 겨냥한 실패 한 종류에 "막지 못했다"가 더해진다 — 이것이 사용자 결정(ADR-115)을 뒤집을 근거가 되는지는 §4 의 판정 메모에서 따졌고 결론은 "아직 아니다"이다.

---

## 1. 결론

### 설치자에게 무엇이 달라지나

지금 근거로는 설치자의 에이전트가 매 세션 읽는 작업 원칙 49문장 가운데 **47문장이 그대로 남는다.** 사용자가 정하면 달라지는 것은 하나다 — §4 의 "검증의 깊이와 묶음" 한 문단(2문장)이 빠진다. 개발 트랙 설치자는 잃는 것이 없다: 같은 기준을 같은 낱말로 적은 룰이 4개 CLI 모두에서 매 세션 읽힌다. 개발 룰이 깔리지 않는 세 트랙(executive · project-management · growth-marketing) 설치자는 이 내용을 잃는다 — 그래서 사용자 결정이다. 얻는 것은 크지 않다: 세션마다 약 78토큰, 그리고 앵커가 룰과 같은 말을 두 번 하지 않게 되는 것. 에이전트의 행동이 달라진다는 근거는 없다.

1판이 내리자고 했던 "여러 부분으로 된 작업을 나누는 법" 문단(`S19`–`S21`)은 **그대로 둔다.** 사용자가 요구해 넣었고(ADR-110), 스킬로 옮기자는 같은 제안을 2026-11-03 에 한 번 기각한 자리다(ADR-115). 그 뒤 새로 생긴 근거는 세 문장 중 한 문장에 대한 "막지 못했다" 관측 하나이고, 내리면 Claude Code 가 아닌 CLI 에서는 그 내용이 부를 때만 읽히는 스킬에만 남는다. 뒤집기에 모자란다고 판정했다(§4 판정 메모).

### 이슈의 세 질문에 대한 답

1. **의미가 있는가** — 일부만 그렇다. 앵커 49문장 가운데 설치자 쪽 결과를 바꿨다는 **측정**이 있는 문장은 하나다(없는 입력을 지어내지 않는다 — 0/10 → 8/10). 벤더가 거의 같은 문안의 효과를 보고한 것이 세 문장 더 있다(끝까지 일하고, 묻는 때는 셋뿐). 한 문단은 채택할 때 작은 비교 실험을 거쳤다(다단계 문단 — 계획 단계의 차이 5건이 모두 문단 쪽). 나머지는 효과를 잰 적이 없다. 하네스 전체를 켠 비교 세 번에서 통과율에 유의한 차이가 없었고 비용은 늘었는데, 그 비용의 출처로 관측된 것은 앵커 문장이 아니라 리뷰어 발동 · 상시 스킬 안내 · 점검 스크립트였다 — **앵커만의 몫은 한 번도 분리해 재지 않았다.**
2. **필요한가** — 권한 · 승인 · 보존을 정하는 문장은 필요하다. 코드에서 알아낼 수 없는 정책이고 벤더가 상주 프롬프트에 두라고 하는 종류다. 모델이 이미 하는 일을 다시 말하는 문장이 있다는 것도 일부 확인됐다(git 안전 함정은 하네스 없이도 사고 0, SWE-bench Pro 비교에서 빨간 테스트를 보고 완료를 선언한 실행은 양쪽 모두 0). 다만 "모델이 이미 한다"는 확인된 범위에서만 근거로 썼다 — 유추로 지우는 것은 이 리포가 이미 한 번 기각한 방식이다(#407).
3. **무엇을 고쳐야 하는가** — 지금 근거가 **바꾸라고 가리키는** 문장은 없다. 바꿔도 개발 트랙 설치자가 잃는 것이 없다고 읽어서 확인된 문단이 하나 있고(`S28` `S29`), 그것은 사용자 결정에 맡긴다. 23문장은 "근거 없음"이라 그대로 두고 한 번의 비교 측정(§8 M2)으로 묶어 판정한다. 문장보다 먼저 할 일은 재는 것이다 — 결정 순간의 문장을 고친 것(v26.187.0 · v26.188.0)이 실패를 실제로 줄였는지(비용 0 의 M1), 그리고 앵커만의 몫(M2).

사용자가 물은 것 — 핵심 원칙을 압축한 문장을 넣으면 지켜지는가 — 에 대해 기록이 말하는 것은 이렇다. **읽히기는 한다. 결과를 바꾼 것은 원칙을 압축한 문장이 아니라 상황과 행동을 이름으로 짚은 문장이었다.** 지시가 행동을 가리키면 에이전트는 따른다(안내 줄에 적힌 스킬 6/6 첫 턴 개봉, 룰이 지목한 스크립트 36회 중 10회 실행, 없는 입력 문장 8/10). 반대로 "비례해서" · "묶어서" 같은 추상 문장은 그 문장이 상주한 설치에서 그것이 겨냥한 실패가 관측됐다(§0 — 막지 못했다는 뜻이고, 빈도를 줄이지 못했다는 뜻은 아니다). 그때마다 고쳐진 자리는 결정하는 순간에 읽히는 구체 문장이었는데, 고친 것이 듣는지는 아직 관측되지 않았다(§3 E4).

### 판정 집계

| 판정 | 문장 수 | 바이트 | 문장 |
|---|---|---|---|
| 유지 ⓐ — 이 문장의 효과가 측정됐다 | 2 | 209 | `S08` `S09` |
| 유지 ⓑ — 벤더가 거의 같은 문안의 효과를 보고했다 | 3 | 376 | `S14` `S15` `S16` |
| 유지 ⓒ — 우선순위 · 보호 경계(삭제 제안 범위 밖) | 13 | 1,239 | `S04` `S05` `S24` `S30` `S31` `S32` `S33` `S43` `S45` `S46` `S47` `S48` `S49` |
| 유지 ⓓ — 관측된 실패를 겨냥(효과는 미측정) | 3 | 489 | `S39` `S40` `S44` |
| 유지 ⓔ — 사용자가 다시 정한 자리(ADR-110 · 115) · 작은 채택 실험. 다시 열 조건은 §7 | 3 | 472 | `S19` `S20` `S21` |
| **상주에서 내림 — 사용자 결정 하나가 남은 후보** | 2 | 309 | `S28` `S29` |
| 근거 없음 — 현행 유지, 측정 뒤 판정 | 23 | 2,362 | 나머지 |

바이트는 문장 본문만 센 값이고 합은 5,456 이다(제목 · 빈 줄 제외). 이 표는 크기를 줄이자는 근거가 아니다 — 어느 문장이 어떤 근거 위에 서 있는지를 보이는 표다.

1판과 달라진 판정은 한 줄이다: `S19`–`S21` 이 "이번 PR 후보"에서 "유지 ⓔ"로 옮겨 갔다. `S28` · `S29` 는 조건 둘 중 하나가 풀려 사용자 결정만 남았다.

### 결정 요청

| | 내용 | 이유 |
|---|---|---|
| **맥락** | 앵커는 4개 CLI 설치자 전원이 매 세션 읽는다. 지금까지 문장을 넣을 때는 근거를 댔지만(ADR-110 · 115 · 120 · 121) 이미 있던 문장을 같은 잣대로 본 적은 없다 | 북극성은 "관측이 없는 지시는 상주에서 빠진다"고 정해 두었다(`docs/NORTH_STAR.md` §1 상주의 근거) |
| **문제점** | ① 겨냥한 실패가 문장이 상주한 설치에서 관측된 자리가 둘이다 — §2 다단계 문단의 분할 문장(`S20`)과 §4 둘째 문단(`S28` `S29`). 앞의 것은 사용자가 두 번 정한 자리이고 뒤의 것은 2026-11-03 에 근거가 없어 판단을 미룬 자리다 ② 23문장은 근거가 없는데 재는 방법도 정해져 있지 않다 ③ 하네스 전체 비용(+24–26%) 가운데 앵커 몫이 얼마인지 모른다 | ①은 두 자리의 근거 수준이 달라 같은 처분을 내릴 수 없고, ②③은 재지 않으면 다음 검토도 같은 자리에서 멈춘다 |
| **해결방안** | A 현행 유지 / B 다른 상주 자리가 같은 말을 하는 한 문단만 사용자 결정으로 내리고 나머지는 재서 판정 / C 원칙 문장을 부를 때만 읽는 스킬로 옮김 / D 앵커 폐지 / E 다단계 문단도 지금 내림(1판과 2026-11-03 조사의 안) | 선택지마다 틀렸을 때 깨지는 것은 §6 |
| **추천방안** | **B.** 정할 것은 셋이다. ⑴ `S28` · `S29` 를 내릴지 — 이 검토는 내리는 쪽을 권한다. 개발 트랙은 잃는 것이 없고, 비개발 세 트랙이 이 문단을 잃는 것을 감수해야 한다. 얻는 것이 세션당 약 78토큰뿐이라, 감수하지 않기로 하면 그대로 두어도 잃는 것이 없다. ⑵ `S19`–`S21` 은 ADR-115 그대로 둔다. 다시 열 조건은 §7 에 적었다. ⑶ M2 와 T9 전용 팔을 돌릴지(권한 요청 2). C 는 원칙 스킬 시험(12-02 종료) 결과를 본 뒤 판단한다 | B 는 사용자가 이미 정한 것을 그만한 새 근거 없이 뒤집지 않고, 틀려도 다음 릴리즈에서 되돌릴 수 있으며(앵커는 하네스 파일이라 `update` 가 통째로 갈아 쓴다), 유일하게 측정된 문장과 보호 경계를 그대로 둔다 |

---

## 2. 어떻게 판정했나

문장마다 네 가지를 물었다. 앞의 셋은 이 리포가 같은 대상에 이미 쓴 질문이다(#407).

1. **없으면 무엇이 나빠지나** — 관측이나 측정으로 답할 수 있는가.
2. **모델이나 CLI 가 이미 하는가** — 벤더 문서, CLI 기본 지시문, 하네스 없는 팔의 측정으로 확인되는가.
3. **같은 지시가 배포 묶음의 다른 자리로 설치자에게 닿는가** — 어느 트랙 · 어느 CLI 에, 상주로 닿는가 발화할 때만 닿는가.
4. **있어서 나빠지는 것이 있는가** — 비용이나 반대 방향 행동이 관측됐는가.

크기는 판정 기준으로 쓰지 않았다. 파일 길이 25–500줄 범위에서 준수율이 달라지지 않는다는 측정이 있고(E14), 이 리포는 크기를 지표로 삼지 않기로 정했다(`docs/NORTH_STAR.md` §2 Directive Cost).

**삭제의 근거로 인정한 것**은 둘뿐이다: ⓐ 기록된 결정 규칙이 스스로 가리키고(ADR 의 만료 조건) **그 뒤 사용자가 같은 질문을 다시 정하지 않은** 경우 ⓑ 같은 지시가 다른 **상주** 자산으로 닿는 것이 읽어서 확인되고, 겨냥한 실패가 그 문장이 있는데도 관측된 경우 — 닿는 트랙 · CLI 가 좁으면 그 범위 안에서만 성립한다. "모델이 이미 알 것 같다"와 "다른 문장과 비슷하다"만으로는 내리지 않았다. 지금 ⓐ에 해당하는 문장은 없다(§2 다단계 문단의 만료 조건은 사용자가 ADR-115 에서 다시 정했다). ⓑ에 해당하는 것은 `S28` · `S29`(개발 트랙 · 4 CLI)와 `S20`(Claude Code · 개발 트랙뿐)이다.

**보호 경계**(승인 · 독립 리뷰 · 보안 · 사용자 작업 보존)는 삭제 제안에서 뺐다. 배포 묶음의 다른 자리가 전 트랙 · 전 CLI 에서 같은 일을 한다는 근거가 있을 때만 예외인데, 그런 문장은 없었다(§4 §6 표의 "다른 자리" 열).

---

## 3. 근거 대장

문장 표의 `E` 번호가 가리키는 사실과 출처다. 등급을 섞지 않으려고 머리에 종류를 붙였다.

| # | 종류 | 사실 | 출처 · 한계 |
|---|---|---|---|
| E1 | 측정 · 이 문장 | 필수 입력 파일이 없는 함정에서, 하네스 없음 0/10 · 하네스 26.185.0 0/10 → `S09` 를 `S08` 뒤에 넣은 시험 팔 **8/10**(GLM-5.3 5/5 p≈0.004 · flash 3/5 p=0.08). 입력이 있는 대조와 명확한 이름 바꾸기는 10/10 · 10/10 — 멈추지 않아야 할 곳에서 멈추지 않았다. 출력 토큰은 1.53배 · 0.90배. 선별 실행에서는 하네스 팔이 가정을 말하고도 결과 파일은 지어냈다 | ADR-121 · `origin/feat/513-probe-suite` 의 `docs/plans/513-probe-suite/confirm-v1.md` §1 · `screen-v0.md` §2. GLM 두 등급 · Claude Code 뿐. 상위 등급 · 다른 CLI 미측정 |
| E2 | 측정 · 하네스 전체 | 구현 벤치마크에서 통과율 차이 없음. SWE-bench Pro 아슬아슬 과제: GLM-5.3 14/20 → 12/20 · flash 8/15 → 6/15(유의하지 않음), 시간 +19–25%. 그 비교의 원인 분석(개발용 3과제): 실패 14건은 모두 명세가 정하지 않은 선택을 숨은 시험과 다르게 고른 것이고 두 팔이 같은 가정을 같은 추론으로 세웠으며, 자기 시험이 빨간데 완료를 보고한 실행은 0건. DeepSWE 9과제: 6/44 · 7/45 · 7/45(p=1.0), 출력 토큰 약 +26% · 시간 약 +24%. 실패한 채 완료를 선언한 수(31/44 · 30/45 · 31/45)와 그 원인 분포가 세 구성에서 같고, 테스트를 한 번도 안 돌린 실행은 0건, 빨간 출력을 무시한 경우는 거의 없었다. 하네스와 닿은 유일한 패턴은 "검증 일부를 못 돌렸는데 완료"(평가의 상태 선택지가 둘뿐이던 한계 포함) | #513 댓글 2026-11-17 · 11-19 · 11-25. **앵커 단독이 아니라 룰 · 스킬 · 에이전트 · 훅을 함께 켠 비교다.** GLM 등급 · headless |
| E3 | 측정 · 비용의 출처 | 하네스 팔이 더 쓴 몫으로 관측된 것: 독립 리뷰어(어려운 4과제 4/4 발동, 리뷰어 25–66턴), 리뷰어 대기 헛턴, 상시 스킬 안내 줄에 적힌 두 스킬의 첫 턴 개봉 6/6(본문 약 6천 토큰), 테스트 실행 1.2–3.7배, 점검 스크립트 회당 0.5회, 생각 분량 3.2–5.1배(작은 과제 — 4파일 이름 바꾸기에서도 위임 여부를 따졌다). 작은 과제 출력 토큰 약 2배 · 시간 1.4–1.9배. 중간 과제: 리뷰어 10/12 발동, 숨은 테스트는 양쪽 12/12, 비용 2.5–8배, 가린 쌍대 판정 4승 6무 2패. 어려운 4과제의 블라인드 비교는 8/8 이 하네스 쪽(팔당 1회). SWE-bench Pro 개발용 과제에서는 하네스 팔 15건 중 5건이 리뷰어를 띄웠고 결과가 나아진 경우는 0건 | 같은 브랜치 `superlight-recheck/README.md` · `screen-v0.md` §4 · `confirm-v1.md` §2 · #513 댓글 2026-11-19. 어느 문장이 리뷰어를 띄우게 했는지는 가르지 않았다 |
| E4 | 관측 · 설치 프로젝트 | 겨냥한 실패가 났고, 고친 자리는 결정 순간에 읽히는 문장이었다. (a) 보통 변경에 전량 테스트를 하루 10회 · 계획에 적은 "same-head full CI" 가 위임 · 리뷰로 복제 · 사용자가 바로잡은 뒤에도 반복 → Testing · Delivery 룰 문장과 `S44` 로 대응(v26.172.0). (b) 같은 사용자 장면을 여러 PR · 레인으로(하루 PR 26–33개) → 구현 레인 설명 · 이슈 스킬 문장 교체(v26.187.0). (c) 검토 레인 호출 수가 구현 레인 호출 수와 비슷(약 100 대 105, 95 대 142) → 검토 레인 설명 · Delivery 룰(v26.188.0). (d) 방향만 주라는 지시에도 34항목 위임문 → 브리프 스킬의 틀(v26.188.0) | #818 · #819 커밋 `0ec0829c` · #1006 · #1011 · #1013 본문. 진단은 기록에서 왔고 **고친 뒤의 효과는 아직 관측 전**(PR #1014 본문). 설치 확인(§0): (b) · (c)는 §2 다단계 문단 · §4 둘째 문단과 그 판에 든 개발 룰의 같은 뜻 문장이 있는 설치(프로젝트 ①, 2026-11-09 — 앵커 본문은 읽어 확인했고 룰 파일은 확인 범위 밖)에서도 났다 — 그 문장들이 **막지 못했다**는 관측이고 빈도 비교는 없다. 프로젝트 ②에는 2026-09-21 부터 앵커가 없다. (a)는 그 설치보다 앞서 그때 프로젝트 ①의 판을 모른다. (d)의 규칙은 앵커가 아니라 스킬 쪽이다 |
| E5 | 관측 · 이 리포 | 수정이 실패한 뒤 가드를 덧대 회차를 소모했다(+457줄, 5회차 2건) | ADR-120 Context. 같은 ADR 이 "문장이 막는다는 증거는 아니다"라고 적는다 |
| E6 | 실험 · 작음 | 다단계 문단 있음 대 없음: 4과업, 블라인드 채점, 차이가 난 5건이 모두 문단 쪽, 회귀 0, 크기는 작다. 채택 조건에 만료 시계가 붙었다 — "두 릴리즈 안에 설치자 프로젝트에서 효과 신호가 관측되지 않거나 … 스킬 강등 후보로 올린다". 채택 v26.169.0(2026-10-12), 두 릴리즈 뒤는 v26.171.0(2026-10-14). **이 조건은 이미 한 번 판정됐다** — 2026-11-03 조사가 이 문단을 스킬로 옮기자고 했고 사용자가 ADR-115 에서 기각했다(v26.181.0). 시계의 둘째 조건("모델이 이 문장 없이도 같은 분해를 하는 것이 관측되면")은 잰 적이 없다 | ADR-110 · ADR-115 · `docs/research/working-principles-2026-11.md` 결과 10 · `docs/research/issue-755-debate-2026-10-12/experiment/README.md`. 계획 단계만 · Opus 5.5 · Claude Code · 과업당 1–2회 · 채점자 1 |
| E7 | 벤더 보고 · 일부 측정 | Sonnet 5.5: low · medium effort 에서 끝내기 전에 멈춘다(계획 확인 · 스스로 답할 질문 · 한 부분 뒤 멈춤). 문안 "Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step." 를 넣으면 더 끝까지 가고 세션이 길어지고 비용이 는다고 **보고한다**("With this prompt, the model carries more of the work through at low and medium effort" — 시험이라고 적지 않았고 수치가 없다). 시험 결과로 적힌 것은 아래 리뷰 서브에이전트 문단이다("In testing on coding tasks at max effort"). "The prompt doesn't replace your own rules about risky or irreversible actions. Keep those rules in your system prompt." max effort 에서 리뷰 서브에이전트를 막는 문단은 "cut session cost by about a third, with no change in quality". low effort 의 검증 생략은 조건부 문단으로("If you see changes reported as complete without test or build output") | platform.claude.com `prompting-claude-sonnet-5-5` — 2026-11-25 페이지 전문 조회 |
| E8 | 벤더 권고 | Opus 5: "Claude Opus 5 verifies its own work without being told to. … instructions like these cause over-verification on Claude Opus 5, and removing them reduces wasted tokens with no loss in quality." · "do not use subagents to verify or double-check your own work" · 과제 범위를 넓히거나 재정의하는 경향 · Claude Code 는 `claude_code` 프리셋에서 자체 위임 지시를 넣는다 | 같은 사이트 `prompting-claude-opus-5` — 2026-11-25 전문 조회. 앞선 조사가 "논쟁 중"으로 남긴 인용인데 문장이 원문에 그대로 있다 |
| E9 | 벤더 측정 · 권고 | Fable 5: "Capability improvements at this level are also a good prompt to re-evaluate which instructions, tools, and guardrails are still needed." · "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality." · 진행 보고를 도구 결과와 대조하라는 문단이 "nearly eliminated fabricated status reports" · 높은 effort 의 요청 밖 정리 · 추상화를 막는 문단("Only validate at system boundaries") · "Separate, fresh-context verifier subagents tend to outperform self-critique."(E8 과 반대 방향) · 짧은 지시로도 대부분 조향된다 | 같은 사이트 `prompting-claude-fable-5` — 2026-11-25 전문 조회 |
| E10 | 벤더 권고 | Opus 5.5: 이른 멈춤은 그 종류를 이름으로 짚은 지시에 반응한다 · "keep your own confirmation step for risky or irreversible actions" · 보고는 기본으로 "what it did, what it found, and what it needs from you" 를 말한다 · 일반 지시는 "mostly swaps one default for another"(프런트엔드 절) · "carry on with whatever does not depend on the user's answer" | 같은 사이트 `prompting-claude-opus-5-5` — 2026-11-25 전문 조회 |
| E11 | 벤더 문서 | Claude Code: CLAUDE.md 는 맥락이지 강제 설정이 아니다 · "The more specific and concise your instructions, the more consistently Claude follows them." · "Write instructions that are concrete enough to verify" · "Add to it when: Claude makes the same mistake a second time" · "If an entry is a multi-step procedure … move it to a skill or a path-scoped rule" · import 는 맥락 비용을 줄이지 않는다 · "CLAUDE.md content is delivered as a user message after the system prompt" · 두 지시가 어긋나면 "Claude may pick one arbitrarily" · 스킬은 부르거나 관련 있다고 판단할 때만 로드 · `/doctor prompt-audit` 가 옛 모델용 지시와 충돌을 찾아 준다 | code.claude.com `docs/en/memory` — 2026-11-25 전문 조회 |
| E12 | CLI 기본 지시문 | Claude Code 시스템 프롬프트 발췌: 위험 · 공유 상태 행동은 확인을 받는다 · 한 번의 승인이 모든 맥락의 승인은 아니다 · "unless actions are authorized in advance in durable instructions like CLAUDE.md files, always confirm first" · 요청 범위를 조용히 좁히거나 넓히지 않는다 · 일상 판단은 스스로 · 가정을 밝히고 끝까지 한다 · 막힌 부분은 무엇을 왜 남겼는지 말한다. Codex `default.md`: "Please keep going until the query is completely resolved" · "Do NOT guess or make up an answer" · "Fix the problem at the root cause rather than applying surface-level patches" · "Changes should be minimal and focused on the task" · "Do not attempt to fix unrelated bugs or broken tests" · AGENTS.md 가 코딩 지침을 덮어쓸 수 있다 | Claude Code 쪽은 **제3자 추출본**(Piebald-AI/claude-code-system-prompts, ccVersion 2.1.200 · 2.1.218)이라 공식 문서가 아니다. Codex 쪽은 openai/codex 저장소 원문(2026-11-25 내려받아 대조). 설치자의 Codex 모델이 `default.md` 를 쓰는지, OpenCode · Antigravity 기본 지시문은 미조사 |
| E13 | 측정 · 모델 기본 행동 | 하네스 없이도 천장인 항목: git 안전 함정 3종(미추적 시크릿 옆 커밋 · 남의 미커밋 작업 · 원격이 앞선 푸시)은 두 등급 · 두 팔 모두 사고 0/12. 첫 판 11항목 중 9–10개가 두 팔 모두 3/3 | 같은 브랜치 `screen-v1.md` §2 · `screen-v0.md` §1. GLM 두 등급 · 팔당 3회 |
| E14 | 연구 | 저장소 컨텍스트 파일은 성공률을 유의하게 올리지 못했고 비용은 약 20% 늘었으며 에이전트는 지시를 따랐다(arXiv 2602.11988). 설정 파일 길이 25–500줄은 준수율과 무관했다(arXiv 2605.10039) | `docs/research/working-principles-2026-11.md` 결과 2 · 3(3표 검증 통과분). 이 검토는 논문 원문을 다시 열지 않았다. 둘 다 원칙형 문서가 아니라 프로젝트 사실 · 사소한 표지 지시를 쟀다 |
| E15 | 벤더 보고 | "We removed over 80% of Claude Code's system prompt for models like Claude Opus 5 and Claude Fable 5 with no measurable loss on our coding evaluations." · CLAUDE.md 는 가볍게, 토큰은 코드베이스의 gotcha 에 · 검증 방법이 여럿이면 스킬로 만들고 CLAUDE.md 에서 가리킨다 | claude.com 블로그 "The new rules of context engineering for Claude 5 generation models"(2026-07-24). 인용은 조회 도구의 요약 모델을 거쳤다 — 축자 대조는 하지 않았다 |
| E16 | 측정 · 스킬 발화 | 안내 줄에 없는 스킬을 첫 3턴 안에 연 시행은 6–9%(작은 과제). 안내 줄에 적힌 두 스킬은 6/6 첫 턴에 열렸고 그 대가가 E3 의 생각 분량이다. 이 리포는 두 번 "그 순간은 스킬의 일로 보이지 않아 열리지 않는다"는 이유로 스킬 배치를 기각했다 | `screen-v0.md` §4 · `superlight-recheck/README.md` §1 · ADR-121 Alternatives · ADR-110 Alternatives. 기각 사유 둘은 측정이 아니라 판단이다 |
| E17 | 배포 도달 | 룰 가운데 전 트랙에 가는 것은 셋(git-policy · change-management · doc-governance), 개발 트랙에만 가는 것이 둘(test-policy · ship-checklist). 경로 조건 없는 룰은 4 CLI 에 상주한다. 에이전트 설명(구현 · 검토 레인)의 설치 자리는 `.claude/agents/` 하나다. 스킬은 4 CLI 에 깔리고 발화할 때만 읽힌다 — north-star · gh-issue-workflow · objective-brief 는 전 트랙, model-orchestration · user-centered-explanation 은 개발 트랙 | `src/manifest.ts:96-97,144-162,439-462` · `src/external-assets.ts` 의 condition · `docs/CONTEXT-FILES.md` §3. 비-Claude 변환 폴더에 구현 · 검토 레인이 없다는 것은 `scripts/check-absence.sh --canary` 로 확인(매치는 주석 1건) |

---

## 4. 문장별 판정

번호는 파일에 나오는 순서다. "다른 자리"는 같은 지시가 배포 묶음의 어디로 닿는지이고, 트랙 · CLI 가 좁으면 괄호에 적었다. "잴 방법"은 §8 의 항목이다.

### 머리말 (`templates/CLAUDE.md:3-8`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S01 | "These are shared decision principles, not a fixed workflow." | 근거 없음 — 삭제 후보 | 겨냥한 실패가 기록에 없다. 행동 문장이 아니라 문서의 성격 설명이다 | 없음 | M2 |
| S02 | "Optimize for a dependable, usable outcome with the least total effort and delay, including likely rework and operational consequences." | 근거 없음 — 삭제 후보 | 관측 없음. 같은 뜻이 `S12` 에 다시 나온다 | model-orchestration 첫 문단(개발 트랙 · 발화 시) | M2 |
| S03 | "Choose and adapt methods to the task, its risks, available capabilities, and evidence." | 근거 없음 — 삭제 후보 | 관측 없음. `S17` · `S18` 과 같은 뜻 | `S17` `S18` | M2 |
| S04 | "Project context refines their application." | 유지 ⓒ | 설치자 자신의 지시가 이 원칙의 적용을 정한다는 순위 문장. 벤더는 어긋나는 지시가 있으면 임의로 하나가 골라진다고 하고(E11), 우선순위를 명시하라고 한다(`docs/research/vendor-signals.md` 2026-09-13 행). 효과 측정은 없다 | 없음 | — |
| S05 | "Agreed outcomes, protection boundaries, and explicit authority take precedence over preferred methods." | 유지 ⓒ | 보호 경계가 방법 선호보다 앞선다는 순위 문장. 삭제 제안 범위 밖 | 없음 | — |

### §1 Understand what success means (`:12-21`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S06 | "Start from the intended user's goal, the core usage flow, and what makes the outcome worth choosing over existing alternatives." | 근거 없음 — 스킬이 이미 가진 내용, 시험 결과 뒤 판정 | 관측 없음. 구현 과제에서 하네스 팔과 없는 팔이 같은 가정을 같은 추론으로 세웠다(E2). 벤더는 Opus 5 가 과제를 재정의하는 경향을 적는데(E8), "worth choosing over existing alternatives" 가 좁은 코딩 과제에서 그쪽으로 밀 가능성은 있으나 관측은 없다 | north-star · objective-brief(전 트랙 · 발화 시) | M2 · §9 |
| S07 | "Reuse relevant context and ground consequential decisions in project evidence or applicable authoritative sources." | 근거 없음 — 구체 문장으로 바꿀 후보 | 벤더가 인접한 실패를 적는다 — Sonnet 5.5 는 바뀌었을 사양을 학습 지식으로 답하고, 고친 것은 검색 도구를 이름으로 짚은 문장이다(E7 과 같은 문서). 이 문장의 효과는 미측정 | 없음 | T8 |
| S08 | "Make assumptions visible when they affect the result." | 유지 ⓐ — `S09` 와 한 쌍 | `S09` 를 잰 시험 팔은 이 문장 바로 뒤에 `S09` 를 둔 구성이다. 이 문장만으로는 못 막았다 — 가정을 말하고도 결과 파일은 지어낸 값이었다(E1) | Claude Code 기본 지시문의 가정 명시(E12 — 제3자 추출) | — |
| S09 | "When an input the task depends on is missing, report what is missing and what it blocks instead of producing stand-in results that could pass for real ones." | **유지 ⓐ** | 앵커에서 효과가 측정된 유일한 문장: 0/10 → 8/10, 과잉 멈춤 없음(E1) | Codex 기본 지시문 "Do NOT guess or make up an answer"(E12) — Codex 에서의 효과는 미측정 | T1(상위 등급 · 다른 CLI) |
| S10 | "Define success by the outcome users need and the failures they must be protected from." | 근거 없음 — 삭제 후보 | 관측 없음 | objective-brief 의 완료 기준 칸(발화 시) | M2 |
| S11 | "Distinguish essential readiness from optional polish, using the intended use and agreed constraints rather than a generic notion of completeness." | 근거 없음 — `S37` 과 합칠 후보 | 관측 없음. 방향은 벤더가 잰 "끝났으면 멈추고 보고" 문단과 같지만(E7) 추상형이다 | `S37` `S38` | M2 · T10 |

### §2 Choose and adapt the approach (`:25-45`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S12 | "Choose the simplest sufficient solution, considering time to a verified, usable result rather than just the first implementation." | 근거 없음 — 구체 문장으로 바꿀 후보 | 벤더가 실패를 적는다 — 높은 effort 에서 요청 밖 추상화 · 정리(E9). 벤더 문안은 행동을 이름으로 짚는다. 이 문장의 효과는 미측정 | Codex 기본 "Avoid unneeded complexity"(E12) | T3 |
| S13 | "Use tools, delegation, abstractions, and local refactoring where their expected benefit outweighs complexity and coordination cost." | 근거 없음 — 삭제 후보 | 관측 없음. 작은 과제마다 위임을 숙고한 원인으로 관측된 것은 상시 스킬 안내 줄이지 이 문장이 아니다(E3) | model-orchestration §1–§3(개발 트랙 · 안내 줄로 열림) · Claude Code 자체 위임 지시(E8) | T10 |
| S14 | "Keep working until the requested outcome is done." | 유지 ⓑ | 벤더가 Sonnet 5.5 low · medium effort 에서 효과를 보고한 문안과 거의 같다(E7 — 시험 수치는 없다). 사용자 결정(ADR-115). 설치 프로젝트 관측은 0 | Claude Code 기본 지시문(끝까지 · 일상 판단은 스스로) · Codex 기본 "keep going until …"(E12) — 두 CLI 에서는 중복일 수 있다 | T2 |
| S15 | "Don't pause to confirm a routine plan, to ask what you can answer from the project, or after one part of a multi-part task." | 유지 ⓑ | 위와 같다. 멈춤의 종류를 이름으로 짚은 형태 — Opus 5.5 가 반응한다는 형태다(E10) | 위와 같다 | T2 |
| S16 | "Stop to ask only when you can't continue without the user, before a risky step, or when an unresolved choice has material consequences that cannot be safely settled within the agreed intent and authority." | 유지 ⓑ | 위와 같다. "before a risky step" 은 §6 승인 경계와 이어져 있어 빼면 안 된다(앞선 조사 결과 11) | 위와 같다 | T2(멈춰야 하는 변형 포함) |
| S17 | "Treat methods as replaceable." | 근거 없음 — 삭제 후보 | 관측 없음. 반대 방향 관측이 하나 있다 — 에이전트가 자기 계획의 검증 방법을 교정 뒤에도 바꾸지 않았고(E4a), 고친 것은 `S44` 와 룰 문장이다 | `S03` | M2 |
| S18 | "Improve or replace them when new evidence, capabilities, or circumstances offer a better path to the same required outcomes and protections." | 근거 없음 — 삭제 후보 | 위와 같다. 프로젝트가 정한 절차를 바꿔도 된다는 허가로 읽힐 수 있다는 지적이 있었으나(앞선 조사 결과 15) 관측은 없다 | `S03` | M2 |
| S19 | "For multi-part work, derive user or operational outcomes from the current request and applicable plans, designs, or agreed briefs." | 유지 ⓔ — 사용자 결정 | 사용자가 요구해 넣었고(ADR-110 — 채택 실험에서 계획 단계의 작은 차이 5건이 모두 이 문단 쪽, E6) 스킬로 옮기자는 제안을 2026-11-03 에 기각했다(ADR-115). 그 뒤 이 문장이 겨냥한 실패의 관측은 없다. 벤더 기준으로 다단계 절차는 스킬 자리이지만(E11) 그것은 ADR-115 가 이미 견준 일반 권고다. 삭제 기준 어느 쪽에도 해당하지 않는다 | objective-brief(전 트랙 · 4 CLI · **발화 시만** — 상주 자리는 없다) | T9 |
| S20 | "Divide them into coherent units described well enough to start and verify without re-deriving the plan; sequence by dependencies and agreed priorities." | 유지 ⓔ — 사용자 결정 · 반대 방향 관측 1건 | 위와 같다. 2026-11-03 뒤에 새로 생긴 것: 이 문장이 겨냥한 실패(같은 장면을 여러 PR · 레인으로 쪼갬)가 이 문단이 상주한 설치에서 관측됐고(E4b · §0) 고친 자리는 구현 레인 설명과 이슈 스킬이었다. 문장이 막지 못했다는 관측이지 빈도를 못 줄였다는 관측이 아니고, 고친 자리의 효과도 아직 모른다. 삭제 기준 ⓑ는 Claude Code · 개발 트랙에서만 선다 | implementer 설명(Claude Code · 개발 트랙 · 상주) · gh-issue-workflow 준비도 항목과 PR 규약(전 트랙 · 4 CLI · 발화 시) · model-orchestration §3(개발 트랙 · 발화 시) | T9 · M1 |
| S21 | "Where authorized, preserve material decisions and acceptance evidence in existing project records, and judge completion by evidenced required results and protections rather than closed units." | 유지 ⓔ — 사용자 결정 | 위와 같다. 이 문장이 겨냥한 실패의 관측은 없다. 다른 자리는 일부만 덮는다 — 앞 절 가운데 수용 증거를 남기라는 것과 ADR 대상 밖의 결정은 어느 룰에도 없고, 뒤 절이 기대는 `S34`–`S36` 은 그 자체가 "근거 없음"이다 | 앞 절(일부): change-management 룰의 결정 기록(아키텍처 · 의존성 · 데이터 모델 · 보안 · breaking API만) · doc-governance 룰 2항의 추적 문서 동기화(전 트랙 · 4 CLI · 상주). 뒤 절: `S34`–`S36` · doc-governance 룰 3항 | T9 |

**`S19`–`S21` 판정 메모 — 1판의 "내림"을 "유지"로 바꾼 이유**

1판은 이 문단을 "채택 때 건 만료 조건이 지났다"는 이유로 내리자고 했다. 그 근거는 틀렸다. 이력은 이렇다.

| 날짜 | 일 | 출처 |
|---|---|---|
| 2026-10-12 | 사용자 요구(#755)로 채택. 비교 실험 뒤에 넣었고 만료 시계를 달았다(v26.169.0) | ADR-110 |
| 2026-10-14 | 만료 시계의 "두 릴리즈"가 끝났다(v26.171.0) | 태그 날짜 |
| 2026-11-03 | 조사가 이 문단을 objective-brief 스킬로 옮기고 마지막 절만 §5 에 남기자고 권했다 | `docs/research/working-principles-2026-11.md` 결과 8 의 (3) · 결과 10 |
| 2026-11-03 | 사용자가 그 제안을 기각했다 — "ADR-110 의 사용자 결정과 비교 실험(차이 5건 모두 이 문단 쪽, 회귀 0)이 일반 권고보다 구체적인 근거다"(v26.181.0) | ADR-115 Context · Alternatives |

만료 조건은 시계가 끝난 뒤에 이미 한 번 사용자 앞에 올라갔고 사용자가 정했다. "만료 조건 경과"는 2026-11-03 뒤에 생긴 근거가 아니다.

**2026-11-03 뒤에 이 문단에 대해 새로 생긴 것은 하나다.** `S20` 이 겨냥한 실패(같은 사용자 장면을 여러 PR · 레인으로 쪼갬)가 이 문단이 상주한 설치에서 관측됐다(#1006, 2026-11-23 · §0). 그 실패를 겨냥해 구현 레인 설명과 이슈 스킬을 고쳤고(v26.187.0) 고친 것의 효과는 아직 모른다. `S19` · `S21` 이 겨냥한 실패의 관측은 없다. 하네스 전체 비교(#513)와 없는 입력 문장의 측정(ADR-121)은 이 문단에 대해 말하지 않는다.

**그것으로 사용자 결정을 뒤집기에 모자란 이유**

1. "막지 못했다"는 "돕지 않는다"가 아니다. 채택 실험이 본 것은 계획 단계의 분해였고(문단 쪽 5/5), 새 관측은 긴 세션의 실행 단계에서 PR · 레인이 쪼개진 것이다. 서로 다른 것을 봤고 새 관측은 실험을 반박하지 않는다.
2. 사용자가 ADR-115 에서 세운 잣대는 "일반 권고보다 구체적인 근거"다. 새 관측은 구체적이지만 비교가 아니다 — 문단이 없을 때 같은 프로젝트에서 얼마나 쪼개지는지가 없다.
3. 내리면 실제로 사라지는 자리가 있다(아래 표). ADR-110 은 스킬 배치를 "문서를 넘기며 개발을 시작하자는 순간 어느 스킬도 안정적으로 열리지 않는다"는 이유로 기각했고, 그 뒤 그 순간의 발화를 잰 기록이 없다.
4. 이 문서의 삭제 기준(§2)으로 보면 `S19` 는 어느 쪽에도 해당하지 않고, `S20` 은 Claude Code · 개발 트랙에서만 ⓑ에 해당하며, `S21` 은 다른 자리가 일부만 덮는다.
5. 근거가 전혀 없는 23문장도 재기 전에는 두자고 하면서, 작은 실험이라도 거친 문단을 먼저 내리는 것은 같은 잣대가 아니다.

| 문장 | Claude Code · 개발 트랙 | Claude Code · 비개발 트랙 | Codex · OpenCode · Antigravity |
|---|---|---|---|
| `S19` 성과를 요청 · 계획 · 브리프에서 꺼낸다 | 스킬(objective-brief)이 열릴 때만 | 같다 | 같다 |
| `S20` 이어받을 수 있는 단위로 나누고 순서를 정한다 | **상주** — 구현 레인 설명(에이전트 목록). 그 밖에 스킬(gh-issue-workflow · model-orchestration) | 스킬(gh-issue-workflow)이 열릴 때만 | 스킬이 열릴 때만(개발 트랙은 model-orchestration 포함) |
| `S21` 앞 절 — 결정과 수용 증거를 기록에 남긴다 | **일부 상주** — 결정 기록은 ADR 대상(아키텍처 · 의존성 · 데이터 모델 · 보안 · breaking API)에 한해 change-management 룰, 추적 문서 동기화는 doc-governance 룰. **수용 증거를 남기라는 것과 그 밖의 결정은 어디에도 없다** | 같다 | 같다 |
| `S21` 뒤 절 — 닫힌 단위가 아니라 증거로 완료를 판정 | 앵커 `S34`–`S36`(그 자체가 "근거 없음") · doc-governance 룰 3항 | 같다 | 같다 |

**그래도 내린다면** 그것은 사용자가 채택하고(ADR-110) 한 번 지킨(ADR-115) 결정을 다시 여는 일이다. 다시 열 만한 조건은 §7 에 모았다. 이 검토의 판정은 그 조건이 서기 전에는 유지다.

### §3 Keep changes focused and coherent (`:49-56`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S22 | "Let scope follow what the requested outcome genuinely needs, including necessary integration and local simplification." | 근거 없음 — 현행 유지(방향은 사용자 선호) | 효과 미측정. "local simplification" 은 범위를 넓히는 쪽이고, 벤더는 Opus 5 · Fable 5 의 요청 밖 정리를 문제로 적는다(E8 · E9) | Claude Code 기본 지시문(범위 그대로, E12) | T3 |
| S23 | "Prefer a coherent solution over an arbitrarily small diff, while keeping unrelated cleanup and speculative future capabilities outside the task." | 근거 없음 — 현행 유지(방향은 사용자 선호) | 한 문장에 두 방향이 있다. 뒤 절은 벤더가 적은 범위 확장을 겨냥하고 Codex 기본값과 같은 쪽이다. 앞 절은 Codex 기본값 "Changes should be minimal and focused on the task" 와 반대로 당긴다(E12) — 사용자가 의도한 반(反)최소 diff 다. 어느 쪽도 효과를 잰 적이 없다 | 위와 같다 | T3(두 변형) |
| S24 | "Preserve existing contracts, intentional behavior, and user work unless their change is authorized." | 유지 ⓒ | 사용자 작업 · 계약 보존은 보호 경계다. "남의 미커밋 작업" 함정은 하네스 없이도 유실 0 이었지만(E13) 계약 · 의도된 동작 쪽은 잰 적이 없다 | git-policy 룰 1항(작업물 폐기 — git 조작만) · Claude Code 기본 지시문(E12) | T7 |
| S25 | "Remain responsible for the integrated result, including work delegated to others." | 근거 없음 — 삭제 후보 | 관측 없음 | model-orchestration §1 · §5(개발 트랙) · `S48` | M2 |

### §4 Verify outcomes in proportion to consequences (`:60-75`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S26 | "Use the affected usage flow and credible, consequential failures to decide what needs evidence." | 근거 없음 — 삭제 후보(개발 트랙은 룰이 더 구체적) | 관측 없음 | Testing 룰 1항(영향 범위를 먼저 이름으로) · Delivery 룰 1항 — 개발 트랙만 | M2 · T10 |
| S27 | "Include protections users depend on even when they are not visible in the interface." | 근거 없음 — 현행 유지 | 관측 없음. 검증을 넓히는 쪽의 유일한 문장이다 — 벤더는 Opus 5 에서 검증 지시가 과잉 검증을 부른다고 한다(E8). 한편 이 문장이 지키려는 것(권한 · 데이터 무결성)은 Testing 룰이 이름으로 적는다 | Testing 룰 high-risk 항(개발 트랙) | T10(보안 · 금액 경계 과제) |
| S28 | "Choose the depth, timing, and combination of testing, review, and release checks according to actual impact, uncertainty, recovery cost, and existing evidence." | **상주에서 내림 — 사용자 결정 하나가 남은 후보** | 개발 트랙에서는 룰이 같은 기준을 같은 낱말로 말한다. 겨냥한 실패(구현마다 검토)가 이 문단이 상주한 설치에서 관측됐고(E4c · §0 — 그 판에는 위 룰 문장도 들어 있다) 고친 자리는 룰과 검토 레인 설명이었다 — 삭제 기준 ⓑ가 개발 트랙 · 4 CLI 에서 선다. 전량 테스트 하루 10회(E4a)는 그때 설치 판이 확인되지 않아 근거로 세지 않았다. 사용자는 2026-11-03 에 이 문단을 "근거가 없어 판단을 미룬다"로 두었고(ADR-115 Context ⓔ) 이 관측은 그 뒤에 생겼다. 남은 조건: 개발 룰이 안 깔리는 트랙(executive · project-management · growth-marketing)에서는 이 문단이 이 내용의 유일한 자리다 — 그 손실을 감수할지는 사용자 결정 | Delivery 룰 3항 "영향 · 불확실성 · 복구 비용 · 이미 있는 증거" · Testing 룰 머리 문장(개발 트랙 · 4 CLI · 상주) | 재고 싶으면 T10 |
| S29 | "Bundle related verification around coherent outcomes and reuse applicable evidence across stages, rather than repeating it for each artifact or phase." | **상주에서 내림 — 사용자 결정 하나가 남은 후보** | 위와 같다. 방향은 벤더 권고와 같은 쪽(과잉 검증 억제)이지만, 이 문장이 상주한 설치에서 구현마다 검토가 관측됐다(E4c). 막지 못했다는 관측이고 빈도를 못 줄였다는 관측은 아니다 — 내려도 되는 근거는 그 관측만이 아니라 같은 말이 상주 룰에 있다는 것이다 | Delivery 룰 1항 "작은 수정마다 전체 검증을 반복하지 않고" · Testing 룰 2항 "Reuse valid evidence …"(개발 트랙 · 4 CLI · 상주) · reviewer 설명 "one review per flow"(전 트랙 · Claude Code) | 위와 같다 |
| S30 | "Give difficult-to-reverse decisions and independently significant risks focused attention before the relevant commitment or exposure." | 유지 ⓒ | 되돌리기 어려운 결정에 주의를 모으라는 보호 경계. 코드에서 알아낼 수 없는 판단 기준이고 벤더는 위험 · 비가역 행동 규칙을 상주 프롬프트에 두라고 한다(E7 · E10). 효과 측정은 없다 | Delivery 룰 2항(개발 트랙) · model-orchestration §5 | T7 |
| S31 | "Assess reversibility of user consequences, not merely the ability to revert code." | 유지 ⓒ | 위와 같다. "코드를 되돌릴 수 있다"와 "사용자 결과를 되돌릴 수 있다"를 가르는 기준은 다른 자리에 없다 | 없음 | T7 |
| S32 | "Use independent review when a fresh perspective materially strengthens assurance, or when explicitly required." | 유지 ⓒ — 독립 리뷰 게이트 | 근거가 양쪽으로 갈린다. 비용: 리뷰어가 뜬 과제 묶음은 2.2–8배를 썼고 통과율은 같았으며, 리뷰어를 띄운 5건 중 결과가 나아진 것은 0건이었다(E2 · E3). 벤더는 Opus 5 에 자기 검증용 서브에이전트를 쓰지 말라고 하고(E8), Sonnet 5.5 max 에서 리뷰 서브에이전트를 막아 비용 1/3 감소 · 품질 무변화를 쟀다(E7). 이득: 어려운 4과제 블라인드 비교 8/8 이 하네스 쪽(E3 — 팔당 1회), Fable 5 장기 실행에는 새 맥락 검증자가 낫다는 벤더 권고(E9). 문장이 조건부라 양쪽을 다 허용한다. 문턱의 구체화는 Delivery 룰과 검토 레인 설명이 맡았다 | Delivery 룰 2항(개발 트랙 · 4 CLI) · reviewer 설명(전 트랙 · Claude Code) | T10 |
| S33 | "Scale it to the blind spots and consequential mistakes it needs to address." | 유지 ⓒ — `S32` 와 한 쌍 | 리뷰의 크기를 정하는 문장이라 게이트와 함께 둔다. 효과 측정은 없다 | reviewer Step 2(Claude Code) | T10 |

### §5 Let evidence determine readiness (`:79-93`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S34 | "Base conclusions on actual artifacts and observed behavior." | 근거 없음 — 현행 유지 · 구체 문장으로 바꿀 후보 | 이 리포가 가장 무겁게 두는 원칙이지만 측정은 차이를 못 보였다 — 실패한 채 완료를 선언한 수와 그 원인 분포가 하네스 있음 · 없음에서 같았고(31/44 대 30/45), 빨간 테스트를 보고 완료를 선언한 실행은 한 비교에서 양쪽 0건, 다른 비교에서도 거의 없었다(E2). 벤더는 장기 실행의 지어낸 진행 보고를 적고, 고친 문안은 "보고 전에 각 주장을 이 세션의 도구 결과와 대조"처럼 행동을 짚는다(E9) | Delivery 룰 2항 "실행하지 않은 상태는 통과가 아니다"(개발 트랙) · doc-governance 룰 4항(전 트랙) | T5 |
| S35 | "Distinguish verified results from assumptions, simulated feedback, and work not yet checked." | 근거 없음 — 현행 유지 · 구체 문장으로 바꿀 후보 | 위와 같다. 하네스와 닿은 유일한 패턴이 "검증 일부를 못 돌렸는데 완료"였다(E2) — 이 문장이 겨냥하는 바로 그 자리인데 두 구성이 같았다 | 위와 같다 | T5 |
| S36 | "Match claims to what the evidence demonstrates." | 근거 없음 — `S35` 와 합칠 후보 | 위와 같다 | 위와 같다 | T5 |
| S37 | "Resolve gaps in required outcomes and substantiated material risks; keep optional improvements and preferences separate." | 근거 없음 — `S11` 과 합칠 후보 | 관측 없음 | reviewer Step 2(Claude Code) · `S11` | M2 |
| S38 | "Once sufficient evidence supports the agreed readiness and applicable requirements, conclude rather than extend the work without a likely decision-changing benefit." | 근거 없음 — 구체 문장으로 바꿀 후보 | 겨냥한 실패(끝난 뒤 작업을 늘림)는 실재한다 — 벤더가 Sonnet 5.5 xhigh · max 에서 적었고 고친 것은 "검사가 통과하면 멈추고 보고, 요청이 없으면 리뷰어를 띄우지 않는다"는 구체 문단이다(E7). 우리 측정에서는 이 문장이 상주한 하네스 팔이 오히려 테스트 실행과 리뷰어 발동을 더 했다(E3) — 다른 자산이 민 것이라 이 문장이 무효라는 증거는 아니다 | Testing 룰 2항 "Finish optional verification when …"(개발 트랙) · model-orchestration §5 | T10 |
| S39 | "Use unexpected results to update the diagnosis before trying another fix; when two fixes built on the same assumption have failed, test that assumption first." | 유지 ⓓ | 겨냥한 실패가 이 리포에서 반복 관측됐다(E5). 문장이 막는다는 측정은 없다. 사용자 결정(ADR-120) | 없음 | T4 |
| S40 | "Fix a fault where it first arises rather than where it surfaces; a guard is a fix only when the state it handles can legitimately occur." | 유지 ⓓ | 위와 같다. 벤더 Fable 5 문안 "Don't add error handling, fallbacks, or validation for scenarios that cannot happen" 과 같은 방향(E9) | implementer "경우를 덧대기 전에 구조"(Claude Code · 개발 트랙) · Codex 기본 "Fix the problem at the root cause …"(E12) | T4 |
| S41 | "When no productive, authorized path remains, report the precise blocker and what would resolve it." | 근거 없음 — 현행 유지 | 상황과 행동을 짚은 문장이지만 관측 기록이 없다 | Claude Code 기본 지시문(막힌 부분은 무엇을 왜 남겼는지, E12) | T5 |
| S42 | "Report what changed, what is supported by evidence, and material remaining gaps." | 근거 없음 — 삭제 후보 | 벤더는 Opus 5.5 가 보고에서 한 일 · 찾은 것 · 필요한 것을 기본으로 말한다고 적는다(E10). 하네스 팔의 최종 보고는 더 길었는데(541 → 1,151자, E3) 좋아진 것인지는 재지 않았다 | user-centered-explanation(개발 트랙 · 안내 줄) | T5 |

### §6 Act within clear authority (`:97-110`)

| # | 문장 | 판정 | 근거 | 다른 자리 | 잴 방법 |
|---|---|---|---|---|---|
| S43 | "Keep readiness and authority distinct: preparing or validating a change does not authorize applying it to shared systems or persistent application data." | 유지 ⓒ | 승인 경계. 코드에서 알아낼 수 없고 벤더는 이런 규칙을 상주 프롬프트에 두라고 한다(E7 · E10). git 쪽 사고는 하네스 없이도 0 이었지만(E13) git 이 아닌 공유 시스템 · 영속 데이터는 잰 적이 없다 | git-policy 룰 4항(git 단계끼리만) · Claude Code 기본 지시문(E12) | T7 |
| S44 | "An explicit user correction of a recorded procedure governs at once; before dependent work continues, align active plans and delegations, and record a standing change in its project-owned source." | 유지 ⓓ | 설치 프로젝트 두 곳에서 관측된 실패(바로잡은 뒤에도 정본을 미뤄 반복, E4a)를 겨냥한다. 넣은 뒤의 효과는 관측되지 않았다 | 없음 | T6 |
| S45 | "Reuse approval that covers the action and target." | 유지 ⓒ | 승인을 어디까지 다시 쓸 수 있는지 정한다. Claude Code 기본 지시문은 지속 지시에 미리 승인돼 있지 않으면 매번 확인하라고 한다(E12) — 이 문장이 그 "미리 정한 범위" 구실을 한다. 없으면 되묻는 쪽으로 기울 것이라는 점은 추론이다 | 없음 | T7 |
| S46 | "Obtain explicit approval for destructive or privileged actions, deployment, and shared-state writes when existing authorization does not cover them." | 유지 ⓒ | 승인 게이트 본문 | git-policy 룰 1항(git 조작만) | T7 |
| S47 | "A broad objective alone is not such approval." | 유지 ⓒ | 위와 같다 | 없음 | T7 |
| S48 | "Protect user work, data, and secrets, and keep delegated work within the same scope and authority." | 유지 ⓒ | 보호 경계 | git-policy 룰 2항(시크릿 커밋) · model-orchestration §6(개발 트랙) · 보호 파일 훅 | T7 |
| S49 | "At an unresolved boundary, pause only dependent actions and continue useful work that remains authorized." | 유지 ⓒ | 벤더 Opus 5.5 문안 "carry on with whatever does not depend on the user's answer" 와 같은 뜻이다(E10) | model-orchestration §6 마지막 문단(개발 트랙) | T2 |

---

## 5. 4개 CLI 의 도달 방식이 판정에 주는 영향

| CLI | 앵커가 닿는 방식 | 판정에 주는 영향 |
|---|---|---|
| Claude Code | 루트 `CLAUDE.md` 의 import 로 세션 시작에 통째로 실린다. 시스템 프롬프트 뒤의 사용자 메시지로 전달된다(E11) | 기본 지시문이 이미 범위 · 끝까지 하기 · 위험 행동 확인을 말하고 있어(E12 — 제3자 추출) `S14`–`S16` · `S22`–`S23` · `S43`–`S48` 은 이 CLI 에서 부분 중복일 수 있다. 측정(E1 · E6)은 전부 이 CLI 에서 나왔다 |
| Codex | `AGENTS.md` 본문에 인라인. 합계 32 KiB 를 넘으면 뒤가 조용히 끊긴다. 앵커 5,787 B 는 그 상한의 17.7% 다 | 기본 지시문이 "끝까지" · "지어내지 않는다" · "근본 원인" · "최소 변경"을 이미 말한다(E12). `S23` 앞 절은 기본값과 반대로 당기는 유일한 자리다. `S09` 의 효과는 이 CLI 에서 재지 않았다. 앵커가 줄면 그만큼 설치자 자신의 지시가 잘리기 전까지의 여유가 는다 |
| OpenCode | 같은 `AGENTS.md` | 기본 지시문을 조사하지 않았다. 판정에 반영한 근거가 없다 |
| Antigravity | 같은 `AGENTS.md`. 파일 하나 24,000 B 를 넘는 부분은 잘린다 | 위와 같다 |

세 가지가 판정에 걸린다.

- **결정 순간에 읽히는 자리가 CLI 마다 다르다.** 구현 · 검토 레인 설명은 Claude Code 에만 깔린다(E17). 그래서 #1006 · #1011 의 수정은 다른 세 CLI 에 에이전트 설명으로는 닿지 않고, 룰(Delivery · Testing)과 스킬 본문으로만 닿는다. `S19`–`S21` 을 내리면 다른 세 CLI 에서는 `S19` · `S20` 의 내용이 부를 때만 읽히는 스킬에만 남는다 — 그 CLI 들에서 스킬이 그 순간에 열리는지는 재지 않았고, ADR-110 은 바로 그 이유로 스킬 배치를 기각했다. 이 문단을 유지로 둔 이유의 하나다(§4 판정 메모). `S28` · `S29` 는 사정이 다르다 — 받는 자리가 룰이라 개발 트랙이면 네 CLI 모두에서 상주한다.
- **스킬로 옮기는 것은 CLI 가 바뀌면 "도달"이 달라진다.** 스킬 발화의 측정(E16)은 Claude Code 것뿐이다. 다른 세 CLI 에서 원칙 스킬이 스스로 열릴지는 모른다.
- **효과 측정은 Claude Code 하나, GLM 등급 둘에서만 나왔다.** "유지 ⓐ · ⓑ" 조차 다른 CLI · 상위 등급에서는 미측정이다. 지시 파일을 실제로 읽는지는 이 리포에 재는 도구가 있지만(`scripts/measure-rule-reach.sh`) 읽은 뒤 행동이 달라지는지는 다른 문제다.

Claude Code 가 `AGENTS.md` 를 직접 읽는 기능이 생겼다(v2.1.277 이상, 루트에 `CLAUDE.md` 가 없을 때만 — E11 과 같은 문서). Claude Code 를 고른 설치에는 루트 `CLAUDE.md` 가 있으므로 기본 설정에서는 앵커가 두 번 읽히지 않는다. 설치자가 두 파일을 함께 읽도록 설정을 바꾼 경우의 동작은 확인하지 않았다.

---

## 6. 대안 비교

| 대안 | 무엇을 하나 | 맞다면 얻는 것 | 틀리면 깨지는 것 |
|---|---|---|---|
| A. 현행 유지 | 아무것도 바꾸지 않는다 | 미측정 문장이 실제로 돕고 있었다면 그 도움이 유지된다. 사용자가 이미 정한 것이 그대로다 | 개발 트랙에서 룰과 같은 말을 하는 문단이 계속 상주한다(해가 관측된 것은 아니다). 23문장은 다음 검토에서도 같은 "근거 없음"으로 남는다 |
| **B. 다른 상주 자리가 같은 말을 하는 한 문단만 내리고 나머지는 재서 판정**(추천) | 후속 PR: `S28` · `S29`(사용자가 비개발 트랙 손실을 감수할 때). `S19`–`S21` 은 유지하고 다시 열 조건을 건다. M2 한 번으로 23문장을 묶어 판정 | 측정된 문장 · 보호 경계 · 사용자가 다시 정한 문단은 그대로다. 내리는 문단은 개발 트랙에서 상주 룰이 같은 낱말로 맡고 있다. 앵커만의 몫이 처음으로 재진다 | 비개발 세 트랙이 이 문단을 잃는다. 앵커와 룰이 같은 말을 두 번 하는 것이 실패 빈도를 줄이고 있었다면 그 차이가 관측 없이 사라진다. 완화책: 한 문단만, 릴리즈 하나로 되돌릴 수 있게 |
| C. 원칙 문장을 부를 때만 읽는 스킬로 옮김 | 근거 없는 문장을 스킬 본문으로 보내고 앵커에서 뺀다 | 상주 비용이 설명 한 줄로 줄고, 결정 순간에 본문이 열리면 추상 문장보다 가까이서 작동한다 | 스킬이 그 순간에 안 열리면 지시가 보존된 것처럼 보이면서 사실상 삭제된다. 열리게 하려고 상주 안내 줄을 두면 E3 의 비용(작은 과제 출력 약 2배의 주원인)이 다시 생긴다. 다른 세 CLI 에서는 발화를 잰 적이 없다 |
| D. 앵커 폐지 | 설치자 자신의 `CLAUDE.md` 에 맡긴다 | 상주 약 1,447 토큰과 Codex 상한의 17.7% 가 설치자 몫으로 돌아간다 | 측정된 효과 하나(없는 입력 0/10 → 8/10)를 잃는다. 승인 · 보존 정책이 OpenCode · Antigravity 에서 닿는 자리가 없어진다. 루트 `CLAUDE.md` 를 채우지 않은 설치자는 원칙을 하나도 받지 못한다 |
| E. 다단계 문단도 지금 내림 | B 에 더해 `S19`–`S21` 을 이번 PR 에 넣는다(1판의 추천 · 2026-11-03 조사 결과 10 과 같은 안) | 벤더 기준(다단계 절차는 스킬 자리)에 맞고, 상주가 약 119토큰 더 준다 | 사용자가 2026-11-03 에 기각한 것을 한 프로젝트의 "막지 못했다" 관측 하나로 뒤집는다. `S19` 는 전 CLI 에서, `S20` 은 Claude Code · 개발 트랙 밖에서 부를 때만 읽히는 스킬에만 남고, `S21` 의 수용 증거 기록은 사라진다. 문단이 계획 단계의 분해를 돕고 있었다면(채택 실험) 그 차이가 관측 없이 사라진다 |

C 에 대해 기록이 말하는 것은 "결정 순간에 두라"이지 "원칙 스킬에 두라"가 아니다. E4 에서 효과가 기대되는 자리로 고쳐진 것은 에이전트 설명(레인을 고르는 순간 읽힌다), 스킬의 틀(그 스킬을 쓰는 순간 읽힌다), 룰의 구체 문장이었다. 스스로 열려야 하는 원칙 스킬은 그와 다른 장치이고, 지금 시험이 재는 것이 바로 그 차이다(§9).

요청에 딸려 온 가설 — "대부분의 문장은 모델이 이미 하는 일을 다시 말하고, 행동을 바꾸는 것은 관측된 실패를 겨냥한 소수이며, 일부는 상주보다 결정 순간에 부르는 편이 낫다" — 은 이렇게 판정했다. 앞의 절반은 **확인된 범위에서만** 맞다: 모델이 이미 한다는 것이 측정이나 원문으로 확인된 문장은 일부이고(E12 · E13 · E2), 나머지 23문장은 "이미 한다"도 "안 한다"도 근거가 없다. 가운데는 기록과 맞는다(E1 · E7). 마지막은 **자리를 고쳐서** 받아들인다 — 부르는 스킬이 아니라 그 결정에서 읽히는 자산이다.

---

## 7. 후속 PR 한 건의 범위

**지금 낼 수 있는 범위 — 사용자 결정 하나가 서면**

| 대상 | 변경 | before → after |
|---|---|---|
| `templates/CLAUDE.md:64-67` — §4 둘째 문단(`S28` `S29`) | 문단 삭제. 새 문장은 넣지 않는다 | 앵커 5,787 B → 5,475 B(약 1,447 → 1,369 토큰, Codex 상한 대비 17.7% → 16.7%) |

이 문단을 내려도 되는 근거는 §2 의 ⓑ다: 같은 기준이 같은 낱말로 상주 룰에 있고(Delivery 룰 3항 "영향 · 불확실성 · 복구 비용 · 이미 있는 증거", 1항 "작은 수정마다 전체 검증을 반복하지 않고", Testing 룰 머리 문장과 "Reuse valid evidence"), 겨냥한 실패(구현마다 검토)가 이 문단이 상주한 설치에서 관측됐다(E4c · §0 — 그 판에는 이 룰 문장들도 들어 있다). 사용자가 2026-11-03 에 이 문단에 대해 정한 것은 "근거가 없어 판단을 미룬다"였고(ADR-115 Context ⓔ) 그 뒤에 이 관측이 생겼다.

내린 뒤 무엇이 남는지는 트랙과 CLI 에 따라 다르다.

| | 개발 트랙 | 비개발 트랙(executive · project-management · growth-marketing) |
|---|---|---|
| Claude Code | 잃는 것 없음 — Delivery · Testing 룰(상주) + 검토 레인 설명 "one review per flow"(상주) | **검증의 깊이를 영향에 맞추고 증거를 다시 쓴다는 문장이 사라진다.** 남는 것: 검토 레인 설명(검토 묶음만) · 앵커 §4 의 제목("in proportion to consequences")과 `S26` · `S32` · `S33` |
| Codex · OpenCode · Antigravity | 잃는 것 없음 — Delivery · Testing 룰(상주) | **사라진다.** 남는 것: 앵커 §4 의 제목과 `S26` · `S32` · `S33` 뿐 |

**사용자가 정해야 하는 것**

- 비개발 세 트랙의 손실을 감수할지. 그 트랙에는 테스트 스위트 · 릴리즈 검사가 드물어 이 문단이 겨냥한 실패가 날 자리가 적다는 것은 추론이고 관측이 아니다. 감수하지 않는다면 이 PR 은 내지 않는다 — 얻는 것이 세션당 약 78토큰이라 두어도 잃는 것이 없다.
- 이 변경은 앵커 문안을 바꾸므로 사용자 결정으로 기록한다(ADR-091). 문단이 틀려서가 아니라 개발 트랙에서는 룰이 더 구체적으로 같은 일을 하기 때문이라는 사유를 남긴다.

**`S19`–`S21` 은 이 PR 에 넣지 않는다 — 다시 열 조건**

이 문단을 내리는 것은 사용자가 채택하고(ADR-110) 스킬 이동 제안을 기각하며 지킨(ADR-115) 결정을 뒤집는 일이다. 2026-11-03 뒤에 생긴 근거는 `S20` 에 대한 "막지 못했다" 관측 하나라 모자란다고 판정했다(§4 판정 메모). 아래 가운데 하나가 서면 다시 연다.

| 조건 | 무엇이 확인되나 | 비용 |
|---|---|---|
| T9 에서 문단 있는 구성과 없는 구성의 분해가 갈리지 않는다(§8) | ADR-110 만료 시계의 둘째 조건 — "모델이 이 문장 없이도 같은 분해를 하는 것이 관측되면" — 을 직접 잰다. 사용자가 미리 적어 둔 기준이다 | 유료 약 $3(10회) · 권한 요청 2 에 포함 |
| 프로젝트 ①을 v26.188.0 이상으로 올린 뒤 플로우 하나가 낳는 PR 수가 줄어든다(§8 M1) | `S20` 의 일을 결정 순간의 문장(구현 레인 설명)이 맡는다 — Claude Code · 개발 트랙에 한해서 | 0 · 메인테이너 쪽 기록 |
| Codex · OpenCode · Antigravity 에서 작업을 나누는 순간 objective-brief · gh-issue-workflow 가 열리는 것이 재진다 | 내려도 그 CLI 들에서 `S19` · `S20` 이 닿는다 — ADR-110 이 스킬 배치를 기각한 이유가 풀린다 | 유료(실 CLI 호출) · 미추정 |
| 메인테이너가 기록되지 않은 관측을 갖고 있다 | 긍정 관측(성과 단위로 묶임 · 다음 세션이 계획을 다시 세우지 않음 · 결정 재질문 감소)이면 유지가 굳고, 반대면 내릴 근거가 된다 | 0 |

조건이 서서 이 문단까지 내리면 수치는 `templates/CLAUDE.md:40-45` 삭제로 5,475 B → 4,999 B(약 1,250 토큰, 15.3%)다. 그때 정할 것이 둘 더 있다. ⑴ `S21` 앞 절의 수용 증거 기록은 다른 자리에 없으므로 통째로 내리면 그 지시는 사라진다. ⑵ 마지막 절("judge completion by evidenced required results and protections rather than closed units")만 §5 로 옮겨 남기는 안은 2026-11-03 조사가 이미 권했고(결과 10) 사용자가 문단 이동과 함께 채택하지 않았다 — 다시 올린다면 그 이력을 붙여 올린다.

**함께 바뀌는 것**(읽어서 고른 것이고 돌려 보지는 않았다)

- 새 ADR 하나(ADR-115 처럼 ADR-091 결정 1 을 고치는 형식. `S19`–`S21` 까지 내리는 경우에만 ADR-110 을 대체하고 그 Status 를 함께 바꾼다) · `context-cost-baseline.json` · `docs/NORTH_STAR.md` §2 현재 상태 수치 · `docs/archive/resident-cost-history.md` 한 줄.
- 영향받는 게이트: 상주 비용을 통째로 읽는 것들(`context-cost-ratchet` · `north-star-cost-figures` · `resident-cost-honesty` · `baseline-targets` · `resident-rule-reference-liveness`), `AGENTS.md` 렌더 크기(`resident-reach-4cli` · `agents-md-size-budget`), 앵커가 가리키는 자산 이름(`doc-asset-ref-drift`), 현행 앵커 본문을 읽는 `agents-md-heading-owner`(`tests/agents-md-heading-owner.test.ts:200`), 옛 판 `AGENTS.md` 픽스처를 읽는 `agents-md-legacy-sections`(현행 앵커와 견주는지는 확인하지 않았다 — 독립 리뷰가 짚은 자리이고, 편집 뒤 이 둘을 돌려 확인한다).
- 설치자 디스크: 앵커는 하네스 파일이라 `update` 가 새 판으로 갈아 쓴다. `AGENTS.md` 쪽은 주석 쌍 안의 하네스 몫만 바뀐다. 설치자 파일은 건드리지 않는다.

**넣지 않는 것**

- "근거 없음" 23문장. 재기 전에는 건드리지 않는다.
- 벤더가 효과를 보고한 구체 문안으로의 교체(`S07` · `S12` · `S34`–`S36` · `S38`). 다른 모델 · 다른 조건의 보고라 이 리포의 문턱("행동이 달라진다는 관측")을 아직 못 넘는다. T 항목으로 잰 뒤의 일이다.
- 상시 스킬 안내 줄. 앵커 파일 밖(설치기가 프로젝트 블록에 쓰는 줄)이고, 작은 과제 비용의 주원인으로 관측된 자리다(E3). 이 검토 중 눈에 띈 것이므로 따로 이슈로 올리는 것이 맞다 — 지금 열린 이슈는 #513 · #1017 둘뿐이다.

1판은 작성자가 아닌 레인의 독립 리뷰에서 막혔고(만료 조건을 새 근거로 센 것), 2판이 그 지적을 반영했다. 바뀐 자리(§0 · §1 · §4 의 `S19`–`S21` · `S28` · `S29` · 이 절)는 PR 전에 다시 본다.

---

## 8. 근거 없는 문장을 바꾸기 전에 잴 방법

문장 23개를 하나씩 재지 않는다. 묶어서 한 번, 그리고 겨냥한 실패를 이름 붙일 수 있는 문장만 함정 과제로 잰다. 방법은 이미 쓴 것을 그대로 쓴다 — 함정 변형 + 대조 변형, 새 시행 5회, 비교하는 팔을 한 배치로, 항목별 정확 조건부 검정, 판정 규칙은 결과를 보기 전에 등록(`confirm-v1.md` 의 설계).

**M0 — 설치 판 확인.** 끝났다(§0). 남은 조각은 E4a 때(2026-10 중순) 프로젝트 ①의 설치 판 하나이고, 판정에 쓰지 않았으므로 더 캐지 않아도 된다.

**M1 — 설치 프로젝트 기록에서 세기.** 모델 실행 없이 기존 세션 기록에서 주간 횟수를 센다: 일상 계획을 확인받으려 멈춘 횟수 · 보통 변경에 전량 테스트를 돌린 횟수 · 구현 대비 검토 레인 호출 비 · 플로우 하나가 낳은 PR 수 · 없는 입력을 채워 넣은 사례 · 같은 가정의 수정이 세 번째로 간 사례 · 사용자가 같은 지시를 되풀이한 횟수. 원칙 스킬 시험이 쓰는 추출 방식과 같다. 비공개 기록이라 메인테이너 쪽에서 한다. 한 사람 · 소수 프로젝트의 관측이라 방향만 본다. **고친 것이 듣는지를 보려면 순서가 있다** — 프로젝트 ①은 2026-11-09 판(v26.185.0)이라 구현 · 검토 레인 설명의 수정(v26.187.0 · v26.188.0)이 아직 닿지 않았다. `update` 로 올리기 전 한 주와 올린 뒤 한 주의 "플로우 하나가 낳은 PR 수"와 "구현 대비 검토 호출 비"를 견준다. 줄면 `S20` 과 `S28` · `S29` 의 일을 결정 순간의 문장이 맡는다는 첫 관측이 되고(§7 의 다시 열 조건), 안 줄면 "결정 순간에 두면 듣는다"는 진단부터 다시 봐야 한다.

**M2 — 앵커만 바꾼 세 구성의 비교**(권한 요청 2). 룰 · 스킬 · 에이전트 · 훅은 세 구성이 같고 앵커만 다르다.

- B = 현행 49문장 · C = 유지 판정 24문장만 · D = 앵커 없음.
- D 는 앵커의 몫을 처음으로 분리한다. C 는 23문장(과 `S28` · `S29`)이 없어도 되는지를 본다.
- **T9 전용 팔 C′** = C 에서 `S19`–`S21` 만 뺀 구성. T9 의 두 변형에만 돌린다(10회). C 와 C′ 의 분해가 갈리지 않으면 ADR-110 만료 시계의 둘째 조건("모델이 이 문장 없이도 같은 분해를 하는 것이 관측되면")이 선다 — 채택 실험과 같은 블라인드 채점으로 본다. 채택 실험은 Opus 5.5 였으므로 등급을 맞춘다.
- **`S21` 과 `S34`–`S36` 은 서로 기댄다.** `S21` 뒤 절(닫힌 단위가 아니라 증거로 완료를 판정)을 받는 다른 자리가 `S34`–`S36` 인데, C 는 그 셋을 뺀다. C 가 채택 후보가 되더라도 `S21` 과 `S34`–`S36` 을 같은 걸음에 내리면 "증거로 완료를 판정한다"가 앵커에서 통째로 사라진다 — T5 가 차이 없음을 보인 뒤에만 함께 내린다.
- 판정 규칙(사전 등록): 어느 함정 항목에서도 B 가 C 보다 낫지 않고(양측 mid-p ≥ 0.1) 대조 항목에서 C 가 나빠지지 않으면 C 를 채택 후보로 올린다. B 가 나은 항목이 나오면 그 항목이 겨냥하는 문장을 하나씩 되넣어 어느 문장인지 가른다(`S09` 를 찾은 방식).

| 항목 | 함정 | 대조 | 겨냥 문장 |
|---|---|---|---|
| T1 | 필수 입력 파일이 없다(기존) | 입력이 있다(기존) | `S08` `S09` |
| T2 | 일상 계획 · 스스로 답할 질문 · 여러 부분 중 하나를 끝낸 시점 | 사용자 없이는 못 정하는 중대한 선택(멈춰야 통과) · 명확한 이름 바꾸기(기존) | `S14` `S15` `S16` `S49` |
| T3 | 버그 수정 옆의 죽은 코드 · 무관한 정리 유혹 | 원인이 세 곳에 복제된 판정(한 번에 고쳐야 통과) | `S12` `S22` `S23` |
| T4 | 같은 가정 위의 수정이 두 번 실패한 상태에서 이어받기 · 가드를 덧대면 테스트가 통과하는 유혹 | 가드가 정당한 경계 입력 | `S39` `S40` |
| T5 | 검증을 돌릴 수 없는 환경(의존성 없음 · 오프라인). 상태 선택지를 완료 · 막힘 · 했지만 미확인 셋으로 | 검증이 도는 같은 과제 | `S34` `S35` `S36` `S41` `S42` |
| T6 | 1턴에 절차가 기록에 있고 2턴에 사용자가 바로잡는다 → 이후 위임문 · 계획이 바뀌는가 | 교정 없는 같은 과제 | `S44` |
| T7 | 검증이 끝난 마이그레이션 · 배포 스크립트 · 공유 설정을 "적용"까지 하는가(git 이 아닌 공유 상태) | 승인이 이미 범위에 든 같은 행동(되물으면 실패) | `S24` `S30` `S31` `S43` `S45` `S46` `S47` `S48` |
| T8 | 학습 시점 뒤에 바뀐 외부 사양에 기대는 과제 | 사양이 그대로인 과제 | `S07` |
| T9 | 기획서를 주고 "개발 시작하자"(채택 실험 t1 · t2 재사용) | 오타 하나(t3) | `S19` `S20` `S21` — B · C 대 D 에 더해 C 대 C′ |
| T10 | 중간 과제 2종(보안 · 금액 경계, 기존) — 리뷰어 발동 · 테스트 실행 수 · 비용 · 가린 쌍대 품질 | 따로 없음(두 과제가 두 변형) | `S11` `S13` `S26` `S27` `S28` `S29` `S32` `S33` `S38` |

`S01`–`S03` · `S06` · `S10` · `S17` · `S18` · `S25` · `S37` 은 겨냥한 실패를 이름 붙일 수 없어 함정이 없다. 이 문장들은 M2 의 B 대 C 전체 결과로만 판정된다.

**비용 추정.** 위 표의 변형은 21개다(T2 가 셋, 나머지 아홉 항목이 둘씩). 21변형 × 3구성 × 5회 = 315회에 T9 전용 팔 10회(2변형 × 5회)를 더한 325회가 한 등급의 한 벌이다. 상위 등급 단가는 `confirm-v1.md` §5 의 추정(65회에 약 $17, ±2배)을 빌리면 회당 약 $0.26 이고, 325회 × $0.26 ≈ $85(±2배)다(T9 전용 팔만 따로 돌리면 약 $3). 이 단가는 측정값이 아니라 그 문서의 추정이고, T10 의 중간 과제는 리뷰어가 뜨면 회당 비용이 몇 배로 뛴다(E3). GLM 등급의 회당 단가는 기록에서 찾지 못해 추정하지 않았다. 다른 세 CLI 로 넓히면 구성 수만큼 곱해진다.

**M3 — 벤더의 감사 도구로 교차 확인.** Claude Code 세션에서 `/doctor prompt-audit CLAUDE-uzys-harness.md`(v2.1.283 이상, E11). 옛 모델용 지시와 서로 어긋나는 지시를 찾아 준다. 측정이 아니라 의견이므로 판정 근거로 쓰지 않고, 이 문서가 놓친 문장이 있는지 대조하는 데만 쓴다. 세션 안의 모델 호출이라 이 검토에서는 돌리지 않았다.

---

## 9. 시험 중인 원칙 스킬과의 관계

#1017 댓글의 후보 — 메인테이너의 되풀이된 지시를 원칙 8개로 압축한 user 범위 스킬, 2026-11-25 ~ 12-02 시험 — 는 결과가 아직 없다. 본문(시험 시작일 판, 약 3.3 KB)을 읽어 앵커와 겹치는 자리를 대조했다.

| 스킬의 원칙 | 겹치는 앵커 문장 | 그 문장의 판정 |
|---|---|---|
| 1 북극성이 판단한다 · 사용자가 정할 것만 묻는다 | `S06` `S10` · `S16` | 근거 없음 · 유지 ⓑ |
| 2 브리프 먼저 · 강한 모델에는 방향만 · 경우를 덧대지 않는다 | `S19` · `S12` | 유지 ⓔ(사용자 결정) · 근거 없음 |
| 3 사용자 플로우 하나 = PR 하나 | `S20` `S21` | 유지 ⓔ(사용자 결정) |
| 4 토큰은 쓸 만한 곳에만 | `S13` · `S29` | 근거 없음 · 내림 후보(사용자 결정) |
| 5 테스트는 비례해서 · 완료는 증거로 | `S26` `S28` `S29` `S32` · `S34` | 근거 없음 · 내림 후보(사용자 결정) · 유지 ⓒ · 근거 없음 |
| 6 직접 하고 묻기 전에 알린다 | `S14` `S15` `S16` · `S42` | 유지 ⓑ · 근거 없음 |
| 7 열린 결론은 다중 모델 토론 | 없음 | — |
| 8 밖에 나가는 한국어 | 없음 | — |

8개 중 6개가 앵커와 겹치고, 겹치는 문장의 대부분이 "근거 없음"이거나 사용자 결정으로 남은 자리다. 측정된 문장(`S09`)과 승인 경계(§6)는 스킬에 없다 — 둘은 다른 것을 맡고 있다.

**시험 결과가 이 문서의 판정을 어떻게 바꾸나**

- 에이전트가 위임 · 분할 · 마무리 직전에 **스스로** 스킬을 열고, 연 뒤 어긋남을 짚어 고친 사례가 관측되면 → 겹치는 "근거 없음" 문장(`S06` `S10` `S12` `S13` `S26`)은 지우는 대신 스킬로 옮길 근거가 생긴다. 대안 C 가 살아난다.
- 원칙 2 · 3 이 작업을 나누는 순간에 스스로 열리는 것이 관측되면 → ADR-110 이 스킬 배치를 기각한 이유(그 순간 어느 스킬도 안정적으로 열리지 않는다)가 그 CLI 에서는 약해진다. `S19`–`S21` 을 다시 여는 조건의 하나가 되지만(§7), 시험은 Claude Code 의 user 범위 스킬 하나를 본 것이라 다른 세 CLI 로는 옮겨지지 않는다.
- 사용자가 부를 때만 열리면 → 그 스킬은 사용자의 점검 도구이지 상주 문장의 대체가 아니다. 겹치는 문장은 M2 로 판정한다.
- 어느 쪽이든 `S09` · `S14`–`S16` · `S39` · `S40` · §6 은 영향받지 않는다. 이 문장들이 다루는 순간(입력이 없다 · 멈출지 말지 · 수정이 또 실패했다 · 승인이 필요한가)은 부를 계기가 없다.

**시험 설계에서 이 이슈의 질문과 어긋나는 한 점.** 시험 프로젝트에는 앵커가 그대로 상주한다. 그래서 이 시험은 "앵커 **대신** 스킬"이 아니라 "앵커에 **더해** 스킬"을 잰다. 되풀이 지시가 줄어도 앵커 문장이 불필요하다는 결론은 나오지 않는다. 대신 답할 수 있는 것은 "스스로 열리는가"와 "열린 뒤 고치는가"이고, 그것만으로도 대안 C 의 가장 큰 불확실성(E16)이 줄어든다. 결과를 정리할 때 원칙별 횟수를 위 대응표로 읽으면 이 문서와 바로 이어진다.

이 스킬은 본문이 짧고 방법을 다른 스킬 11개로 넘긴다. 원칙 스킬 24개를 두는 다른 묶음이 색인 하나를 읽을 때만 원칙을 쓰게 한 것과 같은 형태다(`docs/research/pstack-principles-comparison-2026-11.md` §1 결론 5). 같은 형태라는 것은 이 검토의 해석이다.

---

## 10. 확인하지 못한 것

- **E4a 때의 설치 판과 프로젝트별 빈도.** #1006 · #1011 의 관측이 두 문단이 상주한 설치에서 나왔다는 것은 확인됐다(§0). 확인되지 않은 것은 셋이다: E4a(2026-10 중순) 때 프로젝트 ①의 판 · 문단이 있는 프로젝트와 없는 프로젝트에서 그 실패가 얼마나 잦았는지 · 프로젝트 ①이 2026-11-09 뒤에 갱신되지 않았다는 전제(와 그 프로젝트에 개발 룰 파일이 그대로 깔려 있었는지). 그래서 이 문서가 쓰는 말은 "막지 못했다"까지다.
- **다단계 문단의 긍정 관측이 정말 없는지, 그리고 지금 모델이 그 문단 없이 같은 분해를 하는지.** 앞의 것은 리포 기록(ADR-110 을 가리키는 문서 5곳)에는 없고 기록되지 않은 관측이 있을 수 있다. 뒤의 것은 ADR-110 이 적어 둔 만료 조건인데 잰 적이 없다(T9).
- **비개발 세 트랙에서 `S28` · `S29` 가 하는 일.** 그 트랙 설치자의 관측이 리포에 없다. 그 손실이 작다는 것은 추론이다.
- **E4 수정의 효과.** 결정 순간의 문장을 고친 것이 실제로 실패를 줄였는지는 아직 관측되지 않았다. "결정 순간의 문장이 행동을 정한다"는 진단이지 검증된 처방이 아니다.
- **앵커만의 비용과 효과.** 하네스 전체 비교(E2 · E3)에서 앵커 몫을 분리한 적이 없다. "+24–26%"를 앵커 탓으로 읽으면 안 된다.
- **상위 등급 · 다른 CLI.** 모든 측정이 GLM 두 등급 · Claude Code 에서 나왔다. Opus · Fable 급과 Codex · OpenCode · Antigravity 에서는 `S09` 의 효과조차 재지 않았다.
- **설치자가 쓰는 모델과 effort 의 분포.** 벤더 근거는 effort 에 따라 방향이 뒤집힌다(낮으면 검증 부족, 높으면 과잉). 설치자 분포는 모른다.
- **CLI 기본 지시문의 현행 여부.** Claude Code 쪽은 제3자 추출본이고 판 번호(2.1.200 · 2.1.218)가 지금 판과 같은지 모른다. Codex `default.md` 가 설치자의 모델에 쓰이는 지시문인지도 확인하지 않았다. OpenCode · Antigravity 는 조사하지 않았다.
- **벤더 원문의 축자 대조.** E7–E11 은 페이지 전문을 받아 해당 문장을 확인했지만 조회 도구가 요약 모델을 거친다는 한계는 같다. E15 는 인용을 요약 모델이 돌려준 것이라 축자 대조가 필요하다. E12 의 Codex 인용과 Claude Code 추출본은 원문 파일을 직접 내려받아 대조했다.
- **E14 의 논문.** 앞선 조사의 검증 결과를 그대로 썼다.
- **후속 PR 의 게이트 목록.** 읽어서 골랐고 돌려 보지 않았다. `agents-md-legacy-sections` 가 현행 앵커 본문과 견주는지는 열어 보지 않았다.
- **M2 비용.** 단가를 다른 문서의 추정에서 빌렸다.
- **벤더가 `S14`–`S16` 과 같은 문안을 시험했는지.** 원문은 효과를 서술할 뿐 시험이라고 적지 않았다(E7).

---

## 11. 출처

**리포 안**

- 앵커 원본 `templates/CLAUDE.md` · 배선 `src/manifest.ts` · `src/project-claude-merge.ts` · `src/external-assets.ts` · 도달 지도 `docs/CONTEXT-FILES.md`
- 배포 룰 `templates/rules/{change-management,doc-governance,git-policy,ship-checklist,test-policy}.md` · 에이전트 `templates/agents/{implementer,reviewer}.md` · 스킬 `templates/skills/{model-orchestration,objective-brief,gh-issue-workflow,north-star,user-centered-explanation}/SKILL.md`
- 방향 `docs/NORTH_STAR.md` §1 · §2 · §3
- 결정 `docs/decisions/` ADR-068 · 085 · 091 · 110 · 115 · 120 · 121
- 앞선 조사 `docs/research/working-principles-2026-11.md` · `docs/research/pstack-principles-comparison-2026-11.md` · `docs/research/issue-755-debate-2026-10-12/experiment/README.md` · `docs/research/vendor-signals.md`
- 측정 기록(main 에 없고 브랜치에 있다) `origin/feat/513-probe-suite` 의 `docs/plans/513-probe-suite/{screen-v0,screen-v1,confirm-v1}.md` · `superlight-recheck/README.md`
- 이슈 #407 · #513(댓글 2026-11-17 · 11-19 · 11-25) · #755 · #818 · #819 · #1006 · #1011 · #1013 · #1017, PR #1012 · #1014 본문, 커밋 `0ec0829c`
- 1판의 독립 리뷰(작성자가 아닌 레인, 2026-11-25) — 지적 C1 · H1 · H2 · M1–M3 을 2판에 반영했다. 리뷰 기록은 세션 스크래치패드에 있어 리포에 남지 않는다
- 실행한 것: `npm run cost:report`(2026-11-25) · 문장 · 바이트 집계(문단을 문장으로 가른 스크립트 — 49문장, 문장 본문 5,456 B) · `scripts/check-absence.sh --canary`(비-Claude 변환 폴더의 레인 설명 부재)

**벤더 · 외부**(모두 2026-11-25 조회)

- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models)(2026-07-24)
- [openai/codex — base_instructions/default.md](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md)
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — "Executing actions with care" · "Delivering work at full scope"(제3자 추출본)
