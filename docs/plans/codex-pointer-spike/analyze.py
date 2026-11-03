# usage: python3 -I analyze.py <runs_dir>
import sys, os, json, glob
rows = []
for run in sorted(glob.glob(os.path.join(sys.argv[1], '*-*'))):
    name = os.path.basename(run); arm = name.rsplit('-', 1)[0]
    ev = os.path.join(run, 'events.jsonl')
    cmds, usage, files = [], {}, []
    if os.path.exists(ev):
        for l in open(ev, encoding='utf-8', errors='replace'):
            try: e = json.loads(l)
            except Exception: continue
            it = e.get('item', {})
            if e.get('type') == 'item.completed' and it.get('type') == 'command_execution':
                cmds.append(it.get('command', ''))
            if e.get('type') == 'item.completed' and it.get('type') == 'file_change':
                files += [c.get('path', '') for c in it.get('changes', [])]
            if e.get('type') == 'turn.completed': usage = e.get('usage', {})
    read_rule = any('ui-components.md' in c for c in cmds)
    read_rules_dir = any('.agents/rules' in c for c in cmds)
    read_skill = any('SKILL.md' in c and 'ui-components' in c for c in cmds)
    tsx = None
    for p in glob.glob(os.path.join(run, 'proj', 'src', '**', '*.tsx'), recursive=True):
        if p.endswith('price-tag.tsx') or 'price' in os.path.basename(p).lower():
            tsx = p
    first = open(tsx, encoding='utf-8').readline().strip() if tsx else '(파일 없음)'
    canary = first.startswith('// ui-rule: v7')
    # canary anywhere in new tsx files
    anywhere = False
    if tsx: anywhere = 'ui-rule: v7' in open(tsx, encoding='utf-8').read()
    first_read_idx = next((i for i, c in enumerate(cmds) if 'ui-components' in c or '.agents/rules' in c), None)
    rows.append((name, arm, read_rule, read_rules_dir, read_skill, canary, anywhere, first_read_idx, len(cmds), usage.get('input_tokens'), first[:40]))
print('run\tarm\tread_rule\tread_dir\tread_skill\tcanary_1st\tcanary_any\tread_at\tncmd\tin_tok\tfirst_line')
for r in rows: print('\t'.join(str(x) for x in r))
