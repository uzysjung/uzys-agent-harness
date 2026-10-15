# 위저드 실 TTY 구동 — python3 wizard.py <dist/index.js> <projectDir> <home> <keys...>
# keys: "down" "up" "enter" "y" "n" "wait:<regex>" — 화면을 pty 로 읽으며 순서대로 보낸다. 전체 화면(ANSI 제거)을 stdout 에 낸다.
import os, pty, re, select, sys, time
import pyte
SCR = pyte.Screen(220, 120); STR = pyte.ByteStream(SCR)
def dump(title):
    lines = [l.rstrip() for l in SCR.display]
    while lines and not lines[-1]: lines.pop()
    print(f"----- screen: {title} -----"); print("\n".join(lines))
dist, proj, home, *keys = sys.argv[1:]
mocks = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../543-design-evidence/mocks")
env = dict(os.environ, HOME=home, PATH=mocks + ":" + os.environ["PATH"], NO_COLOR="1", FORCE_COLOR="0", TERM="xterm-256color", COLUMNS="200", LINES="60")
env.pop("CI", None)
import fcntl, struct, termios
pid, fd = pty.fork()
if pid == 0:
    fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", 120, 220, 0, 0))
    os.chdir(proj)
    os.execvpe("node", ["node", dist, "uninstall", "--project-dir", proj], env)
buf = b""
def pump(t=0.3):
    global buf
    end = time.time() + t
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try:
                d = os.read(fd, 65536)
            except OSError:
                return False
            if not d: return False
            buf += d
            STR.feed(d)
    return True
KEY = {"down": b"\x1b[B", "up": b"\x1b[A", "enter": b"\r", "y": b"y", "n": b"n", "left": b"\x1b[D", "right": b"\x1b[C"}
plain = lambda: "\n".join(SCR.display)
pump(2.0)
for k in keys:
    if k.startswith("wait:"):
        pat = re.compile(k[5:]); t0 = time.time()
        while not pat.search(plain()) and time.time() - t0 < 20: pump(0.3)
        continue
    dump(f"before key {k}")
    try:
        os.write(fd, KEY[k])
    except OSError:
        break
    if not pump(0.6): break
t0 = time.time()
while pump(0.5) and time.time() - t0 < 60: pass
try: os.waitpid(pid, 0)
except ChildProcessError: pass
dump("final")
