#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_cmd lsof
require_cmd ps
require_cmd pgrep

ensure_dirs
cleanup_stale_tracking
stop_process

if [[ -n "$(service_listener_pid)" ]]; then
  warn "${SERVICE_NAME} 端口 ${SERVICE_PORT} 仍被占用 (pid=$(service_listener_pid))"
  exit 1
fi

info "${SERVICE_NAME} 已完全停止"
info "日志保留在 $(log_file)"
