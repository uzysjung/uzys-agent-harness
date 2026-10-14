# cmp.sh SCENE STEP...  — 단계마다 화면(main/br) + 스냅샷 diff(main→br, 백업 시각 정규화 · 설치 기록 sha 줄 제외)
E=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769/ev
SC=$1; shift
for N in "$@"; do
  for X in main br; do
    echo "######## $SC $N screen [$X]"
    if [ -f "$E/$SC-$X/$N.out" ]; then sed -n '1p;8,200p' "$E/$SC-$X/$N.out"; fi
  done
  echo "######## $SC $N snapshot diff (< main  > br)"
  sed -E 's/[.]backup-[0-9TZ:-]+/.backup-TS/g' "$E/$SC-main/snap-$N.txt" | grep -v 'harness-install.json\|update-backups.json\|hook-blocks' > "$E/.m"
  sed -E 's/[.]backup-[0-9TZ:-]+/.backup-TS/g' "$E/$SC-br/snap-$N.txt" | grep -v 'harness-install.json\|update-backups.json\|hook-blocks' > "$E/.b"
  diff "$E/.m" "$E/.b" && echo IDENTICAL
done
