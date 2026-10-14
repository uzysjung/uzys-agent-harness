T=$1
grep -rlwF -e "$T" . > /tmp/hits || true
live=$(grep -v backup /tmp/hits | paste -sd' ')
bk=$(grep backup /tmp/hits | paste -sd' ')
s=LOST; [ -n "$bk" ] && s=BACKUP; [ -n "$live" ] && s=LIVE
echo "TOK $T $s live=[$live] bk=[$bk]"
