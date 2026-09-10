#!/usr/bin/env bash
# 启动开发服务器（端口 8023）；已在运行时直接退出
set -euo pipefail
cd "$(dirname "$0")/.."

PID_FILE=.dev-server.pid
PORT=8023

if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "开发服务器已在运行（pid ${OLD_PID}，http://localhost:${PORT}/）"
    exit 0
  fi
fi

nohup npm run dev -- --port "$PORT" --strictPort > .dev-server.log 2>&1 &
echo $! > "$PID_FILE"
NEW_PID=$(cat "$PID_FILE")

# 等待端口就绪（最多 10 秒）
for _ in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:${PORT}/"; then
    echo "开发服务器已启动：http://localhost:${PORT}/（pid ${NEW_PID}，日志 .dev-server.log）"
    exit 0
  fi
  sleep 0.5
done

echo "启动超时，请查看 .dev-server.log" >&2
exit 1
