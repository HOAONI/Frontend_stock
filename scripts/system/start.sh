#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_cmd pnpm
require_cmd python3
require_cmd curl
require_cmd lsof
require_cmd ps
require_cmd pgrep

ensure_dirs
cleanup_stale_tracking

if [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
  error "未检测到 node_modules，请先在 ${PROJECT_ROOT} 执行 pnpm install"
  exit 1
fi

# Vite 在非 CI 模式下会跟随 stdin 结束而退出，后台运行时显式打开 CI 模式。
if ! start_process "env CI=true pnpm dev"; then
  exit 1
fi

if ! wait_http_ok 40; then
  error "${SERVICE_NAME} 健康检查失败，最近日志如下："
  tail -n 80 "$(log_file)" || true
  exit 1
fi

refresh_service_state

case "${START_PROCESS_STATUS:-}" in
  started)
    info "${SERVICE_NAME} 已启动"
    ;;
  managed|adopted|already_running)
    info "${SERVICE_NAME} 已在运行，无需重复启动"
    ;;
  *)
    info "${SERVICE_NAME} 状态已确认"
    ;;
esac

info "访问地址: ${SERVICE_URL}"
info "日志文件: $(log_file)"
info "PID 文件: $(pid_file)"
