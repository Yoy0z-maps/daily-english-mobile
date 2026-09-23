#!/bin/bash
# 더블클릭하면 로컬 서버를 띄우고 데일리 템플릿 편집기를 엽니다.
# (그냥 파일을 더블클릭해 여는 것보다 폰트/이미지가 확실하게 로드됩니다.)
cd "$(dirname "$0")" || exit 1
PORT=8787
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "▸ http://localhost:$PORT/daily-template.html 에서 편집기를 엽니다."
echo "  (끝낼 때는 이 창에서 Control+C)"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
sleep 1
open "http://localhost:$PORT/daily-template.html"
trap 'kill $SRV 2>/dev/null' EXIT
wait $SRV
