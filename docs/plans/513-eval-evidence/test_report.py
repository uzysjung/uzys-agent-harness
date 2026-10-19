"""report.py · eval_common.py 단위 시험 — 옛 실측 결과(~/eval-513/jobs, GLM-5.3 DeepSWE 10과제 A/B · 2026-10-18)를 형식 고정용으로 읽는다.

   PYTHONDONTWRITEBYTECODE=1 python3 -m unittest docs/plans/513-eval-evidence/test_report.py -v

옛 시행은 형식만 쓴다 — 측정에 섞지 않는다(설계 §9). 음성 대조가 걸린 시험은 저장소의 fixtures/(make-fixtures.py)로 돌아 건너뛰지 않는다.
~/eval-513/jobs 전체를 읽는 나머지 시험만 그 폴더가 없는 머신에서 건너뛴다.
"""
import json
import pathlib
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import eval_common as ec  # noqa: E402
import report  # noqa: E402

OLD = pathlib.Path.home() / "eval-513" / "jobs"


@unittest.skipUnless(OLD.is_dir(), "옛 실측 jobs 없음")
class OldJobs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.all = report.load_trials(OLD)
        cls.glm = [t for t in cls.all if "-glm-5.3-A-full-" in t["job"] or "-glm-5.3-B-full-" in t["job"]]

    def one(self, needle):
        (t,) = [t for t in self.glm if needle in t["job"]]
        return t

    def test_self_finished_with_submission(self):
        t = self.one("A-full-awilix-async-container-initialization")
        self.assertEqual((t["term"], t["submitted"], t["reward"]), ("스스로 끝냄+제출", True, 0.0))
        self.assertEqual(self.one("A-full-ytt-jsonpath-query-api")["reward"], 1.0)

    def test_budget_and_turn_caps(self):
        self.assertEqual(self.one("B-full-scriggo-method-declarations")["term"], "예산 상한")
        turn = [t for t in self.all if t["job"].startswith("513-deepswe-glm-B-20261018T041247Z")]
        self.assertTrue(turn and all(t["term"] == "턴 상한" for t in turn))

    def test_arm_detection_old_format(self):
        self.assertEqual({t["arm"] for t in self.glm if "-A-full-" in t["job"]}, {"A"})
        self.assertEqual({t["arm"] for t in self.glm if "-B-full-" in t["job"]}, {"B"})

    def test_old_format_has_no_section6_evidence(self):
        ok, why = report.evidence_check(self.one("B-full-awilix-async-container-initialization"))
        self.assertFalse(ok)
        self.assertIn("증거 없음", why)

    def test_alarm_table(self):
        rows = {r[0]: r for r in report.alarms(self.glm, [], "light")}
        self.assertTrue(rows["C1"][2].startswith("WARN"))  # 옛 형식 = 증거 없음
        self.assertTrue(rows["C2"][2].startswith("WARN"))
        self.assertIn("B 2건", rows["C2"][3])
        self.assertEqual(rows["C5"][2], "PASS")
        self.assertEqual(rows["C6"][2], "PASS")

    def test_render(self):
        text, summary = report.render(OLD, "light", "26.174.0", False, self.glm, [])
        for needle in ("| C1 |", "| C6 |", "갈린 과제", "종료 사유 분포", "B 증거 점검"):
            self.assertIn(needle, text)
        self.assertIn("C2", summary)


FIX = pathlib.Path(__file__).resolve().parent / "fixtures"  # make-fixtures.py 가 실측 시행에서 뽑은 최소 고정 데이터


def fixture_root(name: str, tmp: pathlib.Path) -> pathlib.Path:
    """fixtures/jobs/<name> 을 임시 폴더로 복사하고 config.json 의 `@FIX@` 를 그 폴더로 채운다."""
    shutil.copytree(FIX / "tasks", tmp / "tasks", dirs_exist_ok=True)
    shutil.copytree(FIX / "jobs" / name, tmp / name)
    for c in (tmp / name).rglob("config.json"):
        c.write_text(c.read_text().replace("@FIX@", str(tmp)))
    return tmp / name


class Fixtures(unittest.TestCase):
    """저장소 안 고정 데이터 — ~/eval-513 없이도 돈다(건너뛰지 않는다)."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = pathlib.Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def load(self, name):
        return report.load_trials(fixture_root(name, self.tmp))

    def test_background_wait_kill_is_no_submission(self):
        # full-partial/README.md 의 관측: bandit B 는 백그라운드 리뷰어를 기다리다 끝났고 패치 0바이트
        (t,) = self.load("old-bandit")
        self.assertEqual(t["term"], "백그라운드 대기 중 종료")
        self.assertFalse(t["submitted"])

    def test_empty_patch_timeout_is_no_submission_zero(self):
        # SWT nop 확인(2026-10-19): 빈 패치 → 검증기 1200초 초과 ×2. 정의상 0점 — 인프라 무효로 재실행하지 않는다
        (t,) = self.load("probe-nop")
        self.assertEqual(t["exc"], None)
        self.assertTrue(t["verifier_timeout_empty"])
        self.assertEqual((t["reward"], t["submitted"]), (0.0, False))
        self.assertTrue(report.valid(t))

    def test_verifier_retry_without_exception_is_detected(self):
        # 리허설 (c): 검증기 1차 시간 초과 → 같은 환경 재채점이 끝나 exception_info 가 비었다(검증기 1212초 > 상한 1200초)
        (t,) = self.load("c-off")
        self.assertIsNone((t["result"].get("exception_info") or {}).get("exception_type"))
        self.assertTrue(t["verifier_retried"])
        self.assertEqual((t["submitted"], t["reward"]), (False, 0.0))  # 실행기 패치는 빈 패치 → 제출 없음 0점(유효)
        self.assertTrue(report.valid(t))

    def test_verifier_retry_with_patch_is_invalid_and_rerun(self):
        root = fixture_root("c-off", self.tmp)
        (td,) = [p for p in root.glob("*/*") if (p / "config.json").is_file()]
        self.assertEqual(report.rerun_check(td.parent), 1)  # 빈 패치는 다시 돌지 않는다
        b = next((FIX / "jobs" / "rehearsal-b").glob("swtbench-B-*/*/agent/eval/patch-normalized.diff"))
        shutil.copy(b, td / "agent" / "eval" / "patch-normalized.diff")  # 같은 시행에 패치가 있었다면
        (t,) = report.load_trials(root)
        self.assertEqual(t["term"], "검증기 재시도")
        self.assertFalse(report.valid(t))
        c6 = {r[0]: r for r in report.alarms([t], [], "superlight")}["C6"]
        self.assertIn("무효 1/1", c6[3])
        self.assertEqual(report.rerun_check(td.parent), 0)

    def test_b_claude_md_sha_mismatch_warns_c1(self):
        root = fixture_root("rehearsal-b", self.tmp)
        ts = report.load_trials(root)
        self.assertEqual({r[0]: r for r in report.alarms(ts, [], "superlight")}["C1"][2], "PASS")
        a = next(t for t in ts if t["arm"] == "A")
        evp = next(root.glob("swtbench-B-*/*/agent/eval/evidence.json"))
        ev = json.loads(evp.read_text())
        ev["claude_md_before_session_sha256"] = a["ev"]["claude_md_before_session_sha256"]  # B 가 조용히 A 가 된 상태
        evp.write_text(json.dumps(ev))
        ts = report.load_trials(root)
        self.assertTrue({r[0]: r for r in report.alarms(ts, [], "superlight")}["C1"][2].startswith("WARN"))
        ok, why = report.evidence_check(next(t for t in ts if t["arm"] == "B"))
        self.assertEqual((ok, why), (False, "B CLAUDE.md sha 불일치(고정 블록 기준)"))


class Effect(unittest.TestCase):
    def test_bootstrap_bounds(self):
        mean, lo, hi, p = report.bootstrap([1.0] * 10)
        self.assertEqual((mean, lo, hi), (1.0, 1.0, 1.0))
        self.assertLess(p, 0.05)
        mean, lo, hi, p = report.bootstrap([0.0] * 10)
        self.assertEqual((lo, hi, p), (0.0, 0.0, 1.0))

    def test_verdicts(self):
        def trial(bench, task, arm, rep, reward):
            return {"bench": bench, "task": task, "arm": arm, "rep": rep, "reward": reward, "term": "스스로 끝냄+제출"}

        ts = [trial("deepswe", f"t{i}", "B", r, 1.0) for i in range(20) for r in (1, 2, 3)]
        ts += [trial("deepswe", f"t{i}", "A", r, 0.0) for i in range(20) for r in (1, 2, 3)]
        ts += [trial("swtbench", f"s{i}", arm, r, 1.0) for i in range(30) for arm in "AB" for r in (1, 2, 3)]
        eff = report.effect(ts, "medium")
        self.assertEqual(eff["deepswe"]["verdict"], "더 잘 푼다")
        self.assertTrue(eff["swtbench"]["verdict"].startswith("판별 불가"))
        self.assertEqual(eff["deepswe"]["pass3"], {"A": 0, "B": 20})


class PatchAndClaudeMd(unittest.TestCase):
    def test_test_only(self):
        patch = "diff --git a/sympy/physics/vector/tests/test_x.py b/sympy/physics/vector/tests/test_x.py\n+x\ndiff --git a/sympy/core/add.py b/sympy/core/add.py\n"
        files = report.patch_files(patch)
        self.assertEqual(files, ["sympy/physics/vector/tests/test_x.py", "sympy/core/add.py"])
        self.assertEqual([report.is_test_path(f) for f in files], [True, False])

    def test_claude_md_b_keeps_a_body(self):
        a = b"## Goal\n\ng\n\n## Stack\n\ns\n"
        blk = f"{ec.IMPORT_MARKER_START}\n{ec.HARNESS_ANCHOR_IMPORT}\n{ec.IMPORT_MARKER_END}".encode()
        b = ec.claude_md_b(a, blk)
        self.assertTrue(b.startswith(a))
        self.assertEqual(ec.extract_import_block(b), blk)
        self.assertIsNone(ec.extract_import_block(a))

    def test_swt_repo(self):
        self.assertEqual(ec.swt_repo("scikit-learn__scikit-learn-10297"), "scikit-learn/scikit-learn")
        self.assertEqual(ec.swt_repo("sympy__sympy-14711"), "sympy/sympy")


if __name__ == "__main__":
    unittest.main()
