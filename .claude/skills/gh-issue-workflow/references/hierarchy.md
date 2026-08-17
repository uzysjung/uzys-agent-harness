# Hierarchy — 무엇이 실제로 되는가

`SKILL.md` §계층의 상세. **먼저 재고, 그 다음에 쓴다** — 이 문서의 절반은 "이 기능이 이 저장소에
있는가"를 판정하는 절차다.

## 1. 가용성 프로브 (읽기 전용, 착수 전 1회)

```bash
# ① gh 버전 — 하위 이슈 명령은 2.94+ 에만 있다
gh --version

# ② 조직 리포인가 — issue type 은 조직 전용
gh repo view --json nameWithOwner,isInOrganization

# ③ issue type 이 실재하는가 (404 면 그 축은 없다)
gh api repos/:owner/:repo/issues/types

# ④ Projects 스코프가 있는가 (없으면 error 로 알려준다)
gh project list --owner <owner>

# ⑤ 라벨·마일스톤 재고
gh label list --limit 100
gh api repos/:owner/:repo/milestones --jq '.[] | "\(.number) \(.title)"'
```

**빈 결과를 "없음"으로 읽지 마라.** ③④는 실패할 때 메시지를 낸다 — `2>/dev/null` 로 지우면
"기능 없음"과 "명령이 틀림"이 구분되지 않는다. stderr 를 남기고 메시지를 읽는다.

프로브 결과를 사용자에게 한 줄로 보고하고 그에 맞춰 축을 고른다. 예:

> issue type 은 개인 리포라 없습니다(404) → 라벨로 대신합니다. Projects 는 토큰 스코프가 없어
> 건너뜁니다 — 쓰시려면 `gh auth refresh -s project` 를 직접 실행해 주세요.

## 2. 4단 매핑과 명령

### Task (하위 이슈) 만들기

```bash
# 부모를 지정해 새로 만든다
gh issue create --title "<제목>" --body-file <초안.md> --parent <EPIC> --label "<label>"   # WRITE

# 이미 있는 이슈를 하위로 붙인다 (여러 개 한 번에)
gh issue edit <EPIC> --add-sub-issue 101,102,103   # WRITE

# 뗀다 — 이슈는 지워지지 않는다
gh issue edit <EPIC> --remove-sub-issue 102        # WRITE
```

### Epic (부모 이슈)

에픽은 **평범한 이슈**다. 다른 점은 본문이 `## 적용 대상 / AC` 대신 **하위 목록과 순서**를 담고,
직접 구현되지 않는다는 것뿐이다. 템플릿의 Epic 변형을 쓴다.

```bash
gh issue view <EPIC> --json subIssues,subIssuesSummary
gh issue edit <N> --parent <EPIC>          # WRITE — 자식 쪽에서 붙이기
gh issue edit <N> --remove-parent          # WRITE
```

### Milestone

```bash
gh api repos/:owner/:repo/milestones -f title="<이름>" -f description="<한 줄>" \
  -f due_on="YYYY-MM-DDT00:00:00Z"          # WRITE — 마일스톤 생성
gh issue edit <N> -m "<이름>"   # WRITE — 붙이기
gh issue edit <N> --remove-milestone   # WRITE — 떼기
gh issue list --milestone "<이름>" --state all
```

마일스톤은 **진척 막대**를 준다(열림/닫힘 비율). 사용자가 남은 양을 한눈에 보는 유일한 기본 화면이라,
"이번 묶음"이 생기면 라벨보다 마일스톤이 낫다.

### Project (Projects v2)

```bash
gh project list --owner <owner>
gh project item-add <번호> --owner <owner> --url <issue-url>   # WRITE — 보드 지정이 선행돼야 한다
gh project item-list <번호> --owner <owner> --format json
```

**어느 보드를 쓸지 사용자가 지정하기 전에는 보드를 건드리지 않는다** — `docs/SPEC.md` 의
`github_project: <URL>` 또는 그 세션의 명시 지정이 선행 조건이다. 스코프가 없으면 여기서 멈추고
사용자에게 넘긴다. **`gh auth refresh` 를 대신 실행하지 않는다** —
토큰 권한 확대는 사용자의 결정이다.

### Issue type (조직 리포만)

```bash
gh issue create --type "Bug" ...   # WRITE
gh issue edit <N> --type "Feature"   # WRITE
gh issue edit <N> --remove-type   # WRITE
```

개인 리포에서는 이 축이 존재하지 않는다. 라벨 `bug`/`enhancement` 로 대신하고, 나중에 조직으로
옮기면 그때 승격한다.

## 3. 의존 관계 — blocked-by / blocking

순서를 "라벨"이 아니라 **관계**로 표현하고 싶을 때 쓴다. 계층(부모-자식)과 다른 축이다:
부모-자식은 *구성*이고, blocked-by 는 *순서*다.

```bash
gh issue create --blocked-by 101 --blocking 105 ...   # WRITE
gh issue edit <N> --add-blocked-by 101      # WRITE
gh issue edit <N> --remove-blocked-by 101   # WRITE
gh issue edit <N> --add-blocking 105   # WRITE
```

착수 후보를 고를 때 `blockedBy.totalCount == 0` 인 것만 남기면 **순서** 축의 착수 후보가 걸러진다.
**본문 `## 전제` 체크박스는 이 필터에 안 잡힌다** — 그 축은 `SKILL.md` §5 가 따로 본다.

## 4. 읽기 — JSON 필드

`gh issue view` / `gh issue list` 가 계층을 JSON 으로 준다. 파싱으로 순서를 정할 때 쓴다.

```bash
gh issue list --state open --limit 100 \
  --json number,title,labels,milestone,parent,subIssues,blockedBy,state

gh issue view <N> --json number,title,body,comments,labels,milestone,\
parent,subIssues,subIssuesSummary,blockedBy,blocking,issueType,state
```

착수 후보 정렬 (막힌 것 제외 → `P0 > P1 > P2 > 무라벨`):

```bash
gh issue list --state open --json number,title,labels,blockedBy \
  --jq '[.[] | select((.blockedBy.totalCount // 0) == 0)]
        | sort_by([.labels[].name] as $l
                  | if   $l|index("P0") then 0
                    elif $l|index("P1") then 1
                    elif $l|index("P2") then 2
                    else 3 end)
        | .[] | "\(.number)\t\(.title)"'
```

**세 값을 다 다뤄야 한다.** `index("P0") // 9` 한 줄로 쓰면 P1·P2·무라벨이 전부 같은 키가 돼
입력 순서만 남는다 — 광고한 우선순위 정렬이 아니다. `index()` 는 **위치**를 반환하므로
`// 9` 형태는 라벨이 많을 때 P0 가 무라벨과 동률이 되는 문제도 있다.

`// 0` 을 붙인 이유: **GitHub Enterprise Server 3.19 미만에는 relationships 자체가 없다.**
필드가 null 로 오는지 질의가 실패하는지는 이 저장소에서 검증하지 못했다 — 어느 쪽이든
`// 0` 이 `select` 가 전건을 조용히 버려 "착수 가능한 이슈 0건"을 내는 것을 막는다.

## 5. GitHub 쪽 한계 (문서 값)

| 항목 | 한계 |
|---|---|
| 하위 이슈 중첩 깊이 | **8단계** |
| 부모 1개당 하위 이슈 | **100개** |
| Projects 계층 보기 | Hierarchy view (표 뷰에서 그룹·정렬·필터하며 계층 유지) |

100개 한계는 실무에선 거의 안 닿지만, 닿는다면 그건 에픽이 너무 크다는 신호다 — 중간 에픽으로
한 겹 나눈다.

## 6. 재조정 시퀀스 (누락 없이)

```bash
# ① 지금 묶음의 전량을 먼저 뽑는다 — 기억으로 하지 않는다
gh issue list --milestone "<이번 묶음>" --state all --json number,title,state

# ② 뺄 것: 마일스톤·부모만 떼고 이슈는 OPEN 으로 남긴다
gh issue edit <N> --remove-milestone   # WRITE
gh issue edit <EPIC> --remove-sub-issue <N>   # WRITE
gh issue comment <N> --body "이번 묶음에서 제외 — <사유>. 이슈는 열어 둔다."   # WRITE

# ③ 다시 셌는지 확인: 뺀 수 + 남은 수 = ① 의 수
```

③ 이 이 절의 요점이다. **"정리했다"는 보고는 개수가 맞을 때만 참이다.**

## 7. 라벨 부트스트랩 (없을 때만)

기본 라벨은 `bug` `documentation` `duplicate` `enhancement` `good first issue` `help wanted`
`invalid` `question` `wontfix` 9종뿐이다. 상태·우선순위 축은 만들어야 있다 — **만들 것인지
사용자에게 먼저 묻는다.**

```bash
gh label create "P0" --color B60205 --description "먼저 한다"   # WRITE
gh label create "P1" --color D93F0B --description "다음"   # WRITE
gh label create "P2" --color FBCA04 --description "여유 있을 때"   # WRITE
gh label create "decision-pending" --color 5319E7 --description "방향성 OPEN — 착수 차단"   # WRITE
gh label create "ready"            --color 0E8A16 --description "방향성 확정 — 착수 가능"   # WRITE
gh label create "blocked"          --color B60205 --description "전제 미충족"   # WRITE
gh label create "in-progress"      --color 1D76DB --description "PR 열림"   # WRITE
```

축은 셋으로 충분하다. 라벨을 늘리면 필터가 아니라 장식이 된다.
