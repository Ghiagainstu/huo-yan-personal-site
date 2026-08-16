#!/bin/bash
set -u
DIR="D:/Fire/火哥的个人站/english-wonderland/audio"
NEED="$DIR/_need_words.json"
MAP="$DIR/_wiktionary_map.json"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
PROXY="http://127.0.0.1:10808"
node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('$NEED','utf8'));fs.writeFileSync('$DIR/_need.txt',a.join('\n')+'\n');"
[ -f "$MAP" ] || echo '{}' > "$MAP"
: > "$DIR/_wt_fail.txt"

pick() {
  local html="$1" w="$2" kind="$3"
  local exact pat
  if [ "$kind" = "us" ]; then exact="En-us-${w}\.ogg"; pat="En-us-[^\"') ]+?\.ogg";
  else exact="En-(uk|gb|rp)-${w}\.ogg"; pat="En-(uk|gb|rp)-[^\"') ]+?\.ogg"; fi
  local f
  f=$(echo "$html" | grep -oE "upload\.wikimedia\.org/wikipedia/commons/transcoded/[^\"') ]+?/${exact}/[^\"') ]+?\.mp3" | head -1)
  [ -z "$f" ] && f=$(echo "$html" | grep -oE "upload\.wikimedia\.org/wikipedia/commons/[^\"') ]+?/${exact}" | head -1)
  [ -z "$f" ] && f=$(echo "$html" | grep -oE "upload\.wikimedia\.org/wikipedia/commons/transcoded/[^\"') ]+?/${pat}/[^\"') ]+?\.mp3" | head -1)
  [ -z "$f" ] && f=$(echo "$html" | grep -oE "upload\.wikimedia\.org/wikipedia/commons/[^\"') ]+?/${pat}" | head -1)
  echo "$f"
}

fetch_one() {
  local w="$1"
  local html
  html=$(curl -s -f --retry 2 --retry-delay 1 --connect-timeout 15 --max-time 30 -A "$UA" --proxy "$PROXY" "https://en.wiktionary.org/wiki/$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$w")" 2>/dev/null)
  [ -z "$html" ] && return 1
  local us uk usf="" ukf=""
  us=$(pick "$html" "$w" us); uk=$(pick "$html" "$w" uk)
  [ -z "$us" ] && [ -z "$uk" ] && return 1
  if [ -n "$us" ]; then usf="wt-us-$(echo "$us"|md5sum|cut -c1-8).mp3"; curl -s -f --retry 2 --retry-delay 1 --connect-timeout 15 --max-time 45 -A "$UA" --proxy "$PROXY" "https://$us" -o "$DIR/$usf" 2>/dev/null || usf=""; fi
  if [ -n "$uk" ]; then ukf="wt-uk-$(echo "$uk"|md5sum|cut -c1-8).mp3"; curl -s -f --retry 2 --retry-delay 1 --connect-timeout 15 --max-time 45 -A "$UA" --proxy "$PROXY" "https://$uk" -o "$DIR/$ukf" 2>/dev/null || ukf=""; fi
  node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('$MAP','utf8'));m['$w']={us:'$usf',uk:'$ukf'};fs.writeFileSync('$MAP',JSON.stringify(m));"
  return 0
}

MAXP=4; jobs=0; cnt=0
while IFS= read -r w; do
  [ -z "$w" ] && continue
  { fetch_one "$w" || echo "$w" >> "$DIR/_wt_fail.txt"; } &
  jobs=$((jobs+1)); cnt=$((cnt+1))
  if [ "$jobs" -ge "$MAXP" ]; then wait; jobs=0; fi
  if [ $((cnt % 100)) -eq 0 ]; then echo "progress $cnt" >> "$DIR/_wt_log.txt"; fi
done < "$DIR/_need.txt"
wait
echo "WT_DONE us=$(ls "$DIR"|grep -c '^wt-us-') uk=$(ls "$DIR"|grep -c '^wt-uk-')" > "$DIR/_wt_done.log"
