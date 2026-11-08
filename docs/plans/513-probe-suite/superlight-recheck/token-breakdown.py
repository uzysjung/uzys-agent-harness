import json,sys,glob,os,re,collections
J=os.path.expanduser(sys.argv[1])
TEST=re.compile(r'\b(pytest|py\.test|npm (run )?test|npx (vitest|jest)|go test|cargo test|mvn test|gradle test|tox|unittest|bin/test)\b')
HARN=re.compile(r'(\.claude/(rules|skills|agents)/|CLAUDE-uzys-harness\.md|docs/SPEC\.md|\.uzys-agent-harness)')
rows=[]
for f in sorted(glob.glob(J+'/*-r1-*/*/agent/claude-code.txt')):
    job=f.split('/')[len(J.split('/'))]
    seen=set(); u=collections.Counter(); main_turns=sub_turns=0
    tools=collections.Counter(); harness_reads=0; tests=0; skills=collections.Counter(); agents=collections.Counter(); init=None; result=None
    for line in open(f,errors='replace'):
        try: e=json.loads(line)
        except: continue
        t=e.get('type')
        if t=='system' and e.get('subtype')=='init' and init is None: init=e
        if t=='result': result=e
        if t!='assistant': continue
        m=e.get('message',{}); mid=m.get('id')
        sub=e.get('parent_tool_use_id') is not None
        if mid and mid not in seen:
            seen.add(mid)
            us=m.get('usage') or {}
            for k in ('input_tokens','cache_read_input_tokens','cache_creation_input_tokens','output_tokens'):
                u[('sub_' if sub else 'main_')+k]+=us.get(k,0) or 0
            if sub: sub_turns+=1
            else: main_turns+=1
        for c in m.get('content') or []:
            if c.get('type')!='tool_use': continue
            n=c.get('name'); inp=c.get('input') or {}
            tools[n]+=1
            s=json.dumps(inp,ensure_ascii=False)
            if HARN.search(s): harness_reads+=1
            if n=='Bash' and TEST.search(str(inp.get('command',''))): tests+=1
            if n=='Skill': skills[inp.get('skill') or inp.get('name') or '?']+=1
            if n in ('Task','Agent'): agents[inp.get('subagent_type') or '?']+=1
    tot_in=sum(v for k,v in u.items() if 'output' not in k)
    rows.append(dict(job=job,main_turns=main_turns,sub_turns=sub_turns,
        main_in=u['main_input_tokens']+u['main_cache_read_input_tokens']+u['main_cache_creation_input_tokens'],
        sub_in=u['sub_input_tokens']+u['sub_cache_read_input_tokens']+u['sub_cache_creation_input_tokens'],
        cache_read=u['main_cache_read_input_tokens']+u['sub_cache_read_input_tokens'],
        out=u['main_output_tokens']+u['sub_output_tokens'],
        tools=dict(tools.most_common(8)),harness_tool_refs=harness_reads,test_runs=tests,skills=dict(skills),agents=dict(agents),
        init_skills=len((init or {}).get('skills') or []),init_agents=len((init or {}).get('agents') or []),
        res_turns=(result or {}).get('num_turns')))
for r in rows:
    print(f"{r['job'][:52]:52} turns main/sub {r['main_turns']:>3}/{r['sub_turns']:<3} in main {r['main_in']/1e6:5.2f}M sub {r['sub_in']/1e6:5.2f}M cache_read {r['cache_read']/1e6:5.2f}M out {r['out']/1e3:6.1f}k | tests {r['test_runs']:>2} harnessrefs {r['harness_tool_refs']:>2} | init skills {r['init_skills']} agents {r['init_agents']}")
    print(f"    tools {r['tools']} skills {r['skills']} agents {r['agents']}")
