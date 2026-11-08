import json,sys,glob,os,re
J=os.path.expanduser(sys.argv[1])
TESTPATH=re.compile(r'(^|/)(tests?|__tests__|spec)(/|$)|(_test\.|\.test\.|\.spec\.|test_[^/]*$)')
def last_model_usage(f):
    mu=None
    for line in open(f,errors='replace'):
        if '"type":"result"' not in line: continue
        try: e=json.loads(line)
        except: continue
        mu=e.get('modelUsage') or mu
    return mu or {}
def patch_stats(p):
    if not os.path.exists(p): return None
    files=[];add=dele=0;tadd=0;cur=None
    for l in open(p,errors='replace'):
        if l.startswith('diff --git'):
            cur=l.split(' b/')[-1].strip(); files.append(cur)
        elif l.startswith('+') and not l.startswith('+++'):
            add+=1; tadd+= bool(cur and TESTPATH.search(cur))
        elif l.startswith('-') and not l.startswith('---'): dele+=1
    tf=[f for f in files if TESTPATH.search(f)]
    return dict(files=len(files),test_files=len(tf),add=add,dele=dele,test_add=tadd)
def ctrf(p):
    if not os.path.exists(p): return None
    d=json.load(open(p)); s=(d.get('results') or {}).get('summary') or {}
    return f"{s.get('passed')}/{s.get('tests')}"
for t in sorted(glob.glob(J+'/*-r1-*/*/')):
    job=t.split('/')[-3]
    mu=last_model_usage(t+'agent/claude-code.txt')
    m=next(iter(mu.values()),{})
    rew=json.load(open(t+'verifier/reward.json')) if os.path.exists(t+'verifier/reward.json') else {}
    ps=patch_stats(t+'artifacts/model.patch')
    print(f"{job[:48]:48} reward {rew.get('reward',rew)} tests {ctrf(t+'verifier/ctrf.json')} | uncached_in {m.get('inputTokens',0)/1e3:7.0f}k cache_read {m.get('cacheReadInputTokens',0)/1e6:5.1f}M out {m.get('outputTokens',0)/1e3:5.0f}k est${m.get('costUSD',0):5.1f} | patch {ps}")
