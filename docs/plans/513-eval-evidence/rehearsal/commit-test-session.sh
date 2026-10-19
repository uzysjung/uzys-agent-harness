# 리허설 세션 (b)(c) — SWT sympy__sympy-14711(순서 파일 첫 과제)에서 재현 테스트를 쓰고 **일부러 커밋**한다(설계 §8-3 음성 대조).
# 정규화(finally 의 git reset --soft head-before)가 켜져 있으면 채점 패치에 이 테스트가 들어가고, 꺼져 있으면 패치가 빈다.
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
