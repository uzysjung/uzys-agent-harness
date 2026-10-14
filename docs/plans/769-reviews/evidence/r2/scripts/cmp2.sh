# cmp2.sh X Y SCENE [STEP...] — 빌드 X 와 Y 의 단계별 화면 + 스냅샷 diff (백업 시각 정규화 · 설치 기록/런타임 줄 제외). STEP 없으면 Y 의 스냅샷 전부
E=/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/bf8b3ed9-40bc-44fc-82fa-f0cb3875779d/scratchpad/r769/ev
X=$1; Y=$2; SC=$3; shift 3
STEPS="$*"
[ -z "$STEPS" ] && STEPS=$(ls $E/$SC-$Y/ | sed -n 's/^snap-\(.*\)\.txt$/\1/p' | sort)
for N in $STEPS; do
  for V in $X $Y; do
    echo "######## $SC $N screen [$V]"
    if [ -f "$E/$SC-$V/$N.out" ]; then sed -n '1p;8,400p' "$E/$SC-$V/$N.out" | grep -v '▸ CONTEXT\|^ *· workflow\|^ *· dev-tools'; fi
  done
  echo "######## $SC $N snapshot diff (< $X  > $Y)"
  sed -E 's/[.]backup-[0-9TZ:-]+/.backup-TS/g' "$E/$SC-$X/snap-$N.txt" | grep -v 'harness-install.json\|update-backups.json\|hook-blocks\|node_modules' > "$E/.m"
  sed -E 's/[.]backup-[0-9TZ:-]+/.backup-TS/g' "$E/$SC-$Y/snap-$N.txt" | grep -v 'harness-install.json\|update-backups.json\|hook-blocks\|node_modules' > "$E/.b"
  diff "$E/.m" "$E/.b" && echo IDENTICAL
done
