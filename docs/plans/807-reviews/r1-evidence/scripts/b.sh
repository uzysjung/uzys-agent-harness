live=$(grep -v backup /tmp/hits | paste -sd' ')
grep -rlwF -e "$T" . > /tmp/hits || true
  s=LOST; [ -n "$bk" ] && s=BACKUP; [ -n "$live" ] && s=LIVE
  echo "TOK $T $s live=[$live] bk=[$bk]"
