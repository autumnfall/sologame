#!/usr/bin/env bash
# 停止开发服务器
set -euo pipefail
cd "$(dirname "$0")/.."

PID_FILE=.dev-server.pid

if [ ! -f "$PID_FILE" ]; then
  echo "没有正在运行的开发服务器（无 $PID_FILE）"
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "已停止开发服务器（pid $PID）"
else
  echo "进程 $PID 已不存在，清理 pid 文件"
fi
rm -f "$PID_FILE"
