"""report.py · eval_common.py 단위 시험 — 옛 실측 결과(~/eval-513/jobs, GLM-5.3 DeepSWE 10과제 A/B · 2026-10-18)를 형식 고정용으로 읽는다.

   PYTHONDONTWRITEBYTECODE=1 python3 -m unittest docs/plans/513-eval-evidence/test_report.py -v

옛 시행은 형식만 쓴다 — 측정에 섞지 않는다(설계 §9). 그 폴더가 없는 머신에서는 옛 결과 시험을 건너뛴다.
"""
import pathlib
import sys
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

    def test_background_wait_kill_is_no_submission(self):
        # full-partial/README.md 의 관측: bandit · obsidian B 는 백그라운드 리뷰어를 기다리다 끝났고 패치 0바이트
        for task in ("B-full-bandit-structured-nosec-directives", "B-full-obsidian-linter-link-format-conversion"):
            t = self.one(task)
            self.assertEqual(t["term"], "백그라운드 대기 중 종료")
            self.assertFalse(t["submitted"])

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
