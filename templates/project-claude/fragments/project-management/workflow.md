자연어 워크플로우 (6-gate 미적용):

```
요청 -> PM/Scrum 에이전트 분석 -> pm-skills/product-skills로 산출물 생성 -> reviewer 검증 -> 전달
```

- 6-gate 개발 워크플로우를 사용하지 않음.
- 자연어 요청을 받아 PM/Scrum/RICE 등 적절한 skill 호출.
- pm-skills + product-skills 양쪽 도구가 모두 설치되어 있음 — 상황에 맞춰 선택:
  - **pm-skills**: Jira/Confluence/Atlassian admin, scrum master 운영 — 운영 중심
  - **product-skills**: RICE/PRD/agile PO/UX research/SaaS scaffolder — 기획 중심
- reviewer가 논리 흐름, 우선순위 근거, 범위 적합성 검증.
