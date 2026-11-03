# usage: python3 -I analyze2.py <runs2_dir> <check2_dir>
import sys, os, json, glob
runs, check = sys.argv[1], sys.argv[2]
print('run\tdone\tfailed\tread_rule\ttsx_touched\tcanary_1st\tprice_floor\tncmd\tin_tok')
for run in sorted(glob.glob(os.path.join(runs, '*'))):
    name = os.path.basename(run); scene, effort, arm, i = name.split('-')
    cmds, usage, failed = [], {}, False
    for l in open(os.path.join(run, 'events.jsonl'), encoding='utf-8', errors='replace'):
        try: e = json.loads(l)
        except Exception: continue
        it = e.get('item', {})
        if e.get('type') == 'item.completed' and it.get('type') == 'command_execution': cmds.append(it.get('command', ''))
        if e.get('type') == 'turn.completed': usage = e.get('usage', {})
        if e.get('type') in ('turn.failed', 'error'): failed = True
    done = bool(usage)
    read_rule = any('ui-components.md' in c for c in cmds)
    tsx = os.path.join(run, 'proj', 'src', 'components', 'price-tag.tsx')
    now = open(tsx, encoding='utf-8').read() if os.path.exists(tsx) else None
    orig_p = os.path.join(check, f'{arm}-{scene}', 'src', 'components', 'price-tag.tsx')
    orig = open(orig_p, encoding='utf-8').read() if os.path.exists(orig_p) else None
    touched = now is not None and now != orig
    canary = now is not None and now.lstrip().startswith('// ui-rule: v7')
    pt = os.path.join(run, 'proj', 'src', 'lib', 'price.ts')
    floor = os.path.exists(pt) and ('Math.floor' in open(pt).read() or 'Math.trunc' in open(pt).read())
    print('\t'.join(str(x) for x in (name, done, failed, read_rule, touched, canary, floor if scene == 'incidental' else '-', len(cmds), usage.get('input_tokens'))))
