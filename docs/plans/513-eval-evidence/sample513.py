"""Pier 0.3.1 의 표본 추출을 그대로 재현: iterdir 순서 → random.Random(seed).shuffle → [:n]. (models/job/config.py:136·159)"""
import random, sys
from pathlib import Path
from pier.models.task.paths import TaskPaths

tasks = Path(sys.argv[1]); seed = int(sys.argv[2])
ids = [p for p in tasks.iterdir() if TaskPaths(p).is_valid(disable_verification=False)]
print("valid tasks:", len(ids))
random.Random(seed).shuffle(ids)
print("iterdir-order first 3:", [p.name for p in list(tasks.iterdir())[:3]])
print("seed", seed, "first 12:", [p.name for p in ids[:12]])
print("sorted-order shuffle first 12:", [p.name for p in (lambda l: (random.Random(seed).shuffle(l), l)[1])(sorted(p for p in tasks.iterdir() if TaskPaths(p).is_valid(disable_verification=False)))[:12]])
