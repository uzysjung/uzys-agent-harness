# 리허설 세션 (c′) — commit-test-session.sh 와 같은 커밋을 한 뒤 시간 상한을 넘겨 머문다.
# 시간 상한(asyncio.wait_for 가 run() 을 취소)에서도 finally 의 정규화(git reset --soft head-before)가 도는지 본다. 세션 스크립트는 파일 하나만 올라가므로 내용을 그대로 담는다.
set -e
f=sympy/physics/vector/tests/test_eval513_rehearsal.py
cat > "$f" <<'PY'
from sympy.physics.vector import ReferenceFrame


def test_vector_add_zero():
    N = ReferenceFrame('N')
    assert sum([N.x, (0 * N.x)]) == N.x
PY
git -c safe.directory='*' add "$f"
git -c safe.directory='*' -c user.name=rehearsal -c user.email=rehearsal@invalid commit -q -m "rehearsal: reproduce issue"
git -c safe.directory='*' log --oneline -1
sleep 600
