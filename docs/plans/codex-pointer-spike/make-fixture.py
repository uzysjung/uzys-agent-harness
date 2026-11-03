# usage: python3 -I make-fixture.py <scripts_dir> <arm> <dest>
import sys, os, re, json
sd, arm, dest = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(dest, exist_ok=True)
def w(rel, text):
    p = os.path.join(dest, rel); os.makedirs(os.path.dirname(p) or dest, exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text)
rule_src = open(os.path.join(sd, 'ui-components.md'), encoding='utf-8').read()
body = re.sub(r'^---\n.*?\n---\n', '', rule_src, flags=re.S).strip()
canary = "- **파일 머리 표식**: 이 프로젝트의 UI 컴포넌트 파일(`.tsx` · `.jsx`)은 첫 줄에 `// ui-rule: v7` 주석을 둔다 — 디자인 시스템 판을 추적한다."
lines = body.split('\n')
# insert canary as first bullet (before first '- ' line)
idx = next(i for i, l in enumerate(lines) if l.startswith('- '))
lines.insert(idx, canary)
body = '\n'.join(lines)
inline = re.sub(r'^# ', '## ', body, count=1)
wp = open(os.path.join(sd, 'wp.md'), encoding='utf-8').read()
wp = re.sub(r'^#\s+.*\n', '', wp).strip()
w('package.json', json.dumps({"name": "demo-shop", "private": True, "type": "module",
  "dependencies": {"next": "15.5.0", "react": "19.1.0", "react-dom": "19.1.0", "class-variance-authority": "0.7.1", "clsx": "2.1.1", "tailwind-merge": "3.3.1"},
  "devDependencies": {"tailwindcss": "4.1.13", "@tailwindcss/postcss": "4.1.13", "typescript": "5.9.2", "eslint": "9.35.0", "@shadcn/lint": "0.2.4", "@types/react": "19.1.12"}}, indent=2) + "\n")
w('components.json', json.dumps({"$schema": "https://ui.shadcn.com/schema.json", "style": "new-york", "tsx": True,
  "tailwind": {"css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": True},
  "aliases": {"components": "@/components", "ui": "@/components/ui", "utils": "@/lib/utils"}}, indent=2) + "\n")
w('src/app/globals.css', '@import "tailwindcss";\n\n:root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n  --primary: oklch(0.205 0 0);\n  --muted-foreground: oklch(0.556 0 0);\n  --destructive: oklch(0.577 0.245 27.325);\n}\n')
w('src/lib/utils.ts', 'import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n')
w('src/components/ui/badge.tsx', '// ui-rule: v7\nimport type * as React from "react";\nimport { cn } from "@/lib/utils";\n\nexport function Badge({ className, ...props }: React.ComponentProps<"span">) {\n  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)} {...props} />;\n}\n' if arm == '__never__' else 'import type * as React from "react";\nimport { cn } from "@/lib/utils";\n\nexport function Badge({ className, ...props }: React.ComponentProps<"span">) {\n  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)} {...props} />;\n}\n')
w('tsconfig.json', json.dumps({"compilerOptions": {"target": "ES2022", "jsx": "preserve", "strict": True, "moduleResolution": "bundler", "paths": {"@/*": ["./src/*"]}}}, indent=2) + "\n")
ctx = "## Project Context\n\n데모 쇼핑몰 프런트엔드(Next.js 15 · React 19 · Tailwind v4 · shadcn/ui). 가격은 원 단위 정수다.\n"
prot = "## Protected Files\n\n- lock 파일은 손으로 고치지 않는다.\n- `.env*` 는 보고만 한다.\n"
head = "# demo-shop — Agent Guide (Codex · Antigravity)\n\n" + ctx + "\n## Project Rules\n\n" + wp + "\n\n" + prot
if arm == 'A':
    agents = head + "\n## Harness Rules\n\n" + inline + "\n"
elif arm == 'B1':
    agents = head + "\n## Harness Rules\n\n> 하네스 룰 본문은 `.agents/rules/` 에 있다. `**/*.tsx` · `**/*.jsx` 를 만들거나 고치기 전에 `.agents/rules/ui-components.md` 를 읽고 따른다.\n"
elif arm == 'B2':
    agents = head + "\n## Harness Rules\n\n> 하네스 룰 본문은 `.agents/rules/` 에 있다. 작업을 시작하기 전에 그 폴더의 룰 파일을 모두 읽고 따른다.\n"
elif arm in ('C', 'D'):
    agents = head
else:
    raise SystemExit('bad arm')
w('AGENTS.md', agents)
if arm in ('B1', 'B2'):
    w('.agents/rules/ui-components.md', '---\ntrigger: glob\nglobs: "**/*.tsx, **/*.jsx"\n---\n\n' + body + '\n')
if arm == 'C':
    w('.agents/skills/ui-components/SKILL.md', '---\nname: ui-components\ndescription: Use when creating or editing React .tsx/.jsx UI components in this project — shadcn/ui usage, @shadcn/lint, and the project file-header marker convention.\n---\n\n' + body + '\n')
