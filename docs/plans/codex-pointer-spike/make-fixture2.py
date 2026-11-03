# usage: python3 -I make-fixture2.py <scripts_dir> <rules_dir> <arm A|B|D> <scene create|incidental> <dest>
import sys, os, re, json, subprocess
sd, rd, arm, scene, dest = sys.argv[1:6]
# 1) 기본 프로젝트는 첫 측정의 D 픽스처를 재사용(Working Principles · Project Context · 파일들)
subprocess.run(['python3', '-I', os.path.join(sd, 'make-fixture.py'), sd, 'D', dest], check=True)
def w(rel, text):
    p = os.path.join(dest, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text)
def strip_fm(t): return re.sub(r'^---\n.*?\n---\n', '', t, flags=re.S).strip()
def h2(t): return re.sub(r'^# ', '## ', t, count=1)
ui_src = open(os.path.join(sd, 'ui-components.md'), encoding='utf-8').read()
ui = strip_fm(ui_src).split('\n')
idx = next(i for i, l in enumerate(ui) if l.startswith('- '))
ui.insert(idx, "- **파일 머리 표식**: 이 프로젝트의 UI 컴포넌트 파일(`.tsx` · `.jsx`)은 첫 줄에 `// ui-rule: v7` 주석을 둔다 — 디자인 시스템 판을 추적한다.")
ui = '\n'.join(ui)
always = ['git-policy', 'test-policy', 'doc-governance', 'change-management', 'ship-checklist']
always_txt = '\n\n'.join(h2(strip_fm(open(os.path.join(rd, f'{r}.md'), encoding='utf-8').read())) for r in always)
cli = strip_fm(open(os.path.join(rd, 'cli-development.md'), encoding='utf-8').read())
agents = open(os.path.join(dest, 'AGENTS.md'), encoding='utf-8').read().rstrip() + '\n\n## Harness Rules\n\n'
if arm == 'A':
    agents += always_txt + '\n\n' + h2(cli) + '\n\n' + h2(ui) + '\n'
elif arm == 'B':
    agents += always_txt + '\n\n' + ('> 아래 파일을 만들거나 고치기 전에 그 룰을 읽고 따른다 — 본문은 여기 없다.\n'
        '> - `**/*.tsx` · `**/*.jsx` → `.agents/rules/ui-components.md`\n'
        '> - `**/*.sh` → `.agents/rules/cli-development.md`\n')
    w('.agents/rules/ui-components.md', '---\ntrigger: glob\nglobs: "**/*.tsx, **/*.jsx"\n---\n\n' + ui + '\n')
    w('.agents/rules/cli-development.md', '---\ntrigger: glob\nglobs: "**/*.sh"\n---\n\n' + cli + '\n')
elif arm == 'D':
    agents += always_txt + '\n'
else:
    raise SystemExit('bad arm')
w('AGENTS.md', agents)
if scene == 'incidental':
    w('src/lib/price.ts', 'export function discountedPrice(price: number, ratePercent: number): number {\n  return Math.round(price * (1 - ratePercent / 100));\n}\n')
    w('src/components/price-tag.tsx', 'import { Badge } from "@/components/ui/badge";\nimport { discountedPrice } from "@/lib/price";\n\nexport function PriceTag({ price, rate }: { price: number; rate: number }) {\n  const sale = discountedPrice(price, rate);\n  return (\n    <div className="flex items-baseline gap-2">\n      <span className="text-muted-foreground line-through">{price.toLocaleString("ko-KR")}원</span>\n      <span className="font-semibold">{sale.toLocaleString("ko-KR")}원</span>\n      <Badge>할인가(반올림)</Badge>\n    </div>\n  );\n}\n')
