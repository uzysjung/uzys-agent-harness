mkdir -p "$(dirname "$1")"
if [ "$3" = a ]; then printf '\n%s\n' "$2" >> "$1"; else printf '%s\n' "$2" > "$1"; fi
echo "$2" >> "$D/tokens.txt"
