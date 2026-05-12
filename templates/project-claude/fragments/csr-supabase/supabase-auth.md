setup-harness가 Supabase CLI를 자동 설치한다. 다음 두 path를 각각 1회 설정:

### CLI 자동화 (link / db push / functions deploy)

```bash
supabase login          # OAuth 브라우저 인증 → ~/.config/supabase/access-token 저장
supabase link --project-ref <YOUR_REF>   # 프로젝트 연결
```

### MCP server (프로젝트 자동 생성/관리)

`@supabase/mcp-server`는 별도 환경변수 필요. PAT 발급 후 export:

```bash
# https://supabase.com/dashboard/account/tokens 에서 PAT 발급
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(영구 적용은 `~/.zshrc`/`~/.bashrc`에 export 추가, 또는 프로젝트 `.env`에 기록 — `.env`는 `.gitignore`됨.)

이후 `/uzys:spec`에서 "Supabase 프로젝트 X 사용" 명시 → `/uzys:auto`가 MCP로 프로젝트 생성/스키마 적용/Edge Functions 배포 자동.
