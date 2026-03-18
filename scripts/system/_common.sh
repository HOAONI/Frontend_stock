#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PID_DIR="/tmp/stocksim/pids"
LOG_DIR="/tmp/stocksim/logs"
SERVICE_NAME="frontend"
SERVICE_PORT="5173"
SERVICE_URL="http://127.0.0.1:${SERVICE_PORT}"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

info() {
  printf "[%s] [INFO] %s\n" "$(timestamp)" "$*"
}

warn() {
  printf "[%s] [WARN] %s\n" "$(timestamp)" "$*" >&2
}

error() {
  printf "[%s] [ERROR] %s\n" "$(timestamp)" "$*" >&2
}

ensure_dirs() {
  mkdir -p "${PID_DIR}" "${LOG_DIR}"
}

pid_file() {
  printf "%s/%s.pid" "${PID_DIR}" "${SERVICE_NAME}"
}

state_file() {
  printf "%s/%s.state" "${PID_DIR}" "${SERVICE_NAME}"
}

log_file() {
  printf "%s/%s.log" "${LOG_DIR}" "${SERVICE_NAME}"
}

read_state_value() {
  local key="$1"
  local file
  file="$(state_file)"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi

  awk -v k="${key}" '
    {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      if (line ~ ("^" k "[[:space:]]*=")) {
        sub(/^[^=]*=/, "", line)
        sub(/^[[:space:]]+/, "", line)
        sub(/[[:space:]]+$/, "", line)
        value = line
      }
    }
    END {
      if (value != "") print value
    }
  ' "${file}"
}

service_state_mode() {
  read_state_value "mode"
}

service_state_root_pid() {
  read_state_value "root_pid"
}

service_state_listener_pid() {
  read_state_value "listener_pid"
}

write_service_state() {
  local mode="$1"
  local root_pid="${2:-}"
  local listener_pid="${3:-}"
  local tmp
  local primary_pid=""

  tmp="$(mktemp)"
  printf "mode=%s\nroot_pid=%s\nlistener_pid=%s\n" "${mode}" "${root_pid}" "${listener_pid}" >"${tmp}"
  mv "${tmp}" "$(state_file)"

  case "${mode}" in
    managed)
      primary_pid="${root_pid}"
      ;;
    adopted)
      primary_pid="${listener_pid}"
      ;;
  esac

  if [[ -n "${primary_pid}" ]]; then
    printf "%s\n" "${primary_pid}" >"$(pid_file)"
  else
    rm -f "$(pid_file)"
  fi
}

clear_service_tracking() {
  rm -f "$(pid_file)" "$(state_file)"
}

read_pid() {
  if [[ -f "$(pid_file)" ]]; then
    cat "$(pid_file)"
  fi
}

is_pid_running() {
  local pid="${1:-}"
  local kill_err
  [[ -n "${pid}" ]] || return 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  kill_err="$(kill -0 "${pid}" 2>&1 || true)"
  if [[ "${kill_err}" == *"operation not permitted"* || "${kill_err}" == *"Operation not permitted"* ]]; then
    return 0
  fi

  ps -p "${pid}" >/dev/null 2>&1
}

any_pid_running() {
  local pid
  for pid in "$@"; do
    if is_pid_running "${pid}"; then
      return 0
    fi
  done
  return 1
}

collect_descendant_pids() {
  local parent_pid="$1"
  local child
  local children

  children="$(pgrep -P "${parent_pid}" 2>/dev/null || true)"
  for child in ${children}; do
    [[ -n "${child}" ]] || continue
    collect_descendant_pids "${child}"
    echo "${child}"
  done
}

port_listener_pid() {
  lsof -nP -iTCP:"${SERVICE_PORT}" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true
}

service_listener_pid() {
  port_listener_pid
}

pid_command() {
  local pid="$1"
  ps -p "${pid}" -o command= 2>/dev/null || true
}

pid_owner() {
  local pid="$1"
  ps -p "${pid}" -o user= 2>/dev/null | awk '{print $1}' || true
}

should_force_cleanup_pid() {
  local pid="$1"
  local owner
  owner="$(pid_owner "${pid}")"
  if [[ -z "${owner}" || "${owner}" == "${USER}" ]]; then
    return 0
  fi
  return 1
}

is_service_process() {
  local pid="$1"
  local cmd
  cmd="$(pid_command "${pid}")"
  if [[ -z "${cmd}" ]]; then
    return 1
  fi

  if [[ "${cmd}" == *"exec env CI=true pnpm dev"* ]]; then
    return 0
  fi

  if [[ "${cmd}" == *"/node_modules/vite/"* ]]; then
    return 0
  fi

  if [[ "${cmd}" == *"vite --mode dev --port ${SERVICE_PORT}"* ]]; then
    return 0
  fi

  if [[ "${cmd}" == *"pnpm dev"* && "${cmd}" != *"pnpm dev:"* ]]; then
    return 0
  fi

  return 1
}

service_process_pids() {
  ps -ax -o pid=,command= 2>/dev/null | while IFS= read -r line; do
    local pid
    pid="$(awk '{print $1}' <<<"${line}")"
    [[ -n "${pid}" ]] || continue
    if is_service_process "${pid}"; then
      printf "%s\n" "${pid}"
    fi
  done
}

tracked_service_pid() {
  local mode
  local pid
  local listener_pid

  mode="$(service_state_mode)"
  case "${mode}" in
    managed)
      pid="$(service_state_root_pid)"
      if [[ -n "${pid}" ]] && is_pid_running "${pid}"; then
        printf "%s\n" "${pid}"
        return 0
      fi
      listener_pid="$(service_state_listener_pid)"
      if [[ -n "${listener_pid}" ]]; then
        pid="${listener_pid}"
      fi
      ;;
    adopted)
      pid="$(service_state_listener_pid)"
      ;;
    *)
      pid="$(read_pid || true)"
      ;;
  esac

  if [[ -n "${pid}" ]]; then
    printf "%s\n" "${pid}"
  fi
}

refresh_service_state() {
  local mode
  local root_pid
  local listener_pid

  mode="$(service_state_mode)"
  root_pid="$(service_state_root_pid)"
  listener_pid="$(service_listener_pid)"

  case "${mode}" in
    managed)
      if [[ -n "${root_pid}" || -n "${listener_pid}" ]]; then
        write_service_state "managed" "${root_pid}" "${listener_pid}"
      fi
      ;;
    adopted)
      if [[ -n "${listener_pid}" ]]; then
        write_service_state "adopted" "" "${listener_pid}"
      fi
      ;;
  esac
}

http_ok() {
  curl -fsS --max-time 2 "${SERVICE_URL}" >/dev/null 2>&1
}

wait_http_ok() {
  local timeout_sec="${1:-40}"
  local start
  start="$(date +%s)"
  while true; do
    if http_ok; then
      return 0
    fi
    if (( $(date +%s) - start >= timeout_sec )); then
      return 1
    fi
    sleep 1
  done
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    error "缺少命令：${cmd}"
    return 1
  fi
}

cleanup_stale_tracking() {
  local tracked_pid
  tracked_pid="$(tracked_service_pid || true)"
  if [[ -z "${tracked_pid}" && -f "$(state_file)" ]]; then
    clear_service_tracking
  fi
}

adopt_or_fail_on_port_conflict() {
  local tracked_pid
  local listener_pid
  local mode
  local root_pid
  local cmd

  tracked_pid="$(tracked_service_pid || true)"
  listener_pid="$(service_listener_pid)"
  mode="$(service_state_mode)"
  root_pid="$(service_state_root_pid)"

  if [[ -n "${tracked_pid}" ]] && ! is_pid_running "${tracked_pid}"; then
    clear_service_tracking
    tracked_pid=""
    mode=""
    root_pid=""
  fi

  if [[ -n "${listener_pid}" ]]; then
    if is_service_process "${listener_pid}"; then
      if [[ "${mode}" == "managed" ]]; then
        write_service_state "managed" "${root_pid}" "${listener_pid}"
        return 0
      fi

      if [[ "${mode}" == "adopted" && "${tracked_pid}" == "${listener_pid}" ]]; then
        return 0
      fi

      write_service_state "adopted" "" "${listener_pid}"
      info "检测到 ${SERVICE_NAME} 在端口 ${SERVICE_PORT} 已运行 (pid=${listener_pid})，已自动接管"
      return 0
    fi

    cmd="$(pid_command "${listener_pid}")"
    error "${SERVICE_NAME} 端口 ${SERVICE_PORT} 被其他进程占用 (pid=${listener_pid})"
    error "占用进程命令：${cmd:-<unknown>}"
    error "请先释放端口后再启动。"
    return 1
  fi

  if [[ -n "${tracked_pid}" ]]; then
    clear_service_tracking
  fi

  return 0
}

start_process() {
  local command="$1"
  local logf
  local old_pid
  local mode
  local new_pid
  local listener_pid
  local spawned_pid

  START_PROCESS_STATUS=""
  START_PROCESS_PID=""
  logf="$(log_file)"

  if ! adopt_or_fail_on_port_conflict; then
    return 1
  fi

  old_pid="$(tracked_service_pid || true)"
  if is_pid_running "${old_pid}"; then
    mode="$(service_state_mode)"
    START_PROCESS_STATUS="${mode:-already_running}"
    START_PROCESS_PID="${old_pid}"
    return 0
  fi

  clear_service_tracking
  info "正在启动 ${SERVICE_NAME}"
  (
    cd "${PROJECT_ROOT}"
    # 用新 session 托管 dev server，避免当前 shell 结束后把后台进程一并回收。
    spawned_pid="$(
      START_COMMAND="${command}" START_LOG="${logf}" python3 - <<'PY'
import os
import subprocess

command = os.environ["START_COMMAND"]
log_path = os.environ["START_LOG"]

with open(log_path, "ab", buffering=0) as log_file:
    proc = subprocess.Popen(
        ["/bin/zsh", "-lc", f"exec {command}"],
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        cwd=os.getcwd(),
        env=os.environ.copy(),
        start_new_session=True,
    )

print(proc.pid)
PY
    )"
    printf "%s\n" "${spawned_pid}" >"$(pid_file)"
  )

  sleep 1
  new_pid="$(read_pid || true)"
  if ! is_pid_running "${new_pid}"; then
    error "${SERVICE_NAME} 启动失败，最近日志如下："
    tail -n 60 "${logf}" || true
    return 1
  fi

  listener_pid="$(service_listener_pid)"
  write_service_state "managed" "${new_pid}" "${listener_pid}"
  START_PROCESS_STATUS="started"
  START_PROCESS_PID="${new_pid}"
  info "${SERVICE_NAME} 启动成功 (pid=${new_pid})"
}

stop_pid_tree_gracefully() {
  local label="$1"
  local root_pid="$2"
  local timeout_steps="${3:-20}"
  local pid
  local descendants_count=0
  local signal_failed=0
  local descendants=()
  local all_pids=()

  if ! is_pid_running "${root_pid}"; then
    info "${label} 已停止"
    return 0
  fi

  while IFS= read -r pid; do
    if [[ -n "${pid}" ]]; then
      descendants+=("${pid}")
      descendants_count=$((descendants_count + 1))
    fi
  done < <(collect_descendant_pids "${root_pid}")

  if (( descendants_count > 0 )); then
    all_pids=("${descendants[@]}" "${root_pid}")
  else
    all_pids=("${root_pid}")
  fi

  info "正在停止 ${label} (pid=${root_pid}, 子进程=${descendants_count})"
  for pid in "${all_pids[@]}"; do
    if ! kill -TERM "${pid}" >/dev/null 2>&1; then
      signal_failed=1
    fi
  done

  for _ in $(seq 1 "${timeout_steps}"); do
    if ! any_pid_running "${all_pids[@]}"; then
      if (( signal_failed > 0 )); then
        warn "${label} 信号发送存在失败（可能权限不足），请复核是否已完全停止"
      else
        info "${label} 已停止"
      fi
      return 0
    fi
    sleep 0.5
  done

  warn "${label} 未在超时内退出，发送 SIGKILL"
  for pid in "${all_pids[@]}"; do
    if ! kill -KILL "${pid}" >/dev/null 2>&1; then
      signal_failed=1
    fi
  done

  if (( signal_failed > 0 )); then
    warn "${label} 存在无法发送信号的进程（可能权限不足）"
  fi
}

stop_process() {
  local mode
  local root_pid
  local saved_listener_pid
  local pid
  local cleaned_pids=""
  local listener_pid
  local extra_pid

  mode="$(service_state_mode)"
  root_pid="$(service_state_root_pid)"
  saved_listener_pid="$(service_state_listener_pid)"

  case "${mode}" in
    managed)
      pid="${root_pid}"
      if [[ -z "${pid}" ]] || ! is_pid_running "${pid}"; then
        pid="$(service_listener_pid)"
        if [[ -z "${pid}" ]]; then
          pid="${saved_listener_pid}"
        fi
      fi
      ;;
    adopted)
      pid="$(service_listener_pid)"
      if [[ -z "${pid}" ]]; then
        pid="${saved_listener_pid}"
      fi
      ;;
    *)
      pid="$(read_pid || true)"
      ;;
  esac

  if is_pid_running "${pid}"; then
    stop_pid_tree_gracefully "${SERVICE_NAME}" "${pid}" 20
    cleaned_pids=" ${pid} "
  else
    info "${SERVICE_NAME} 已停止"
  fi

  listener_pid="$(service_listener_pid)"
  if [[ -n "${listener_pid}" ]]; then
    if is_service_process "${listener_pid}"; then
      warn "检测到 ${SERVICE_NAME} 存在未托管残留进程 (pid=${listener_pid})，正在清理"
      stop_pid_tree_gracefully "${SERVICE_NAME}(残留)" "${listener_pid}" 20
      cleaned_pids="${cleaned_pids}${listener_pid} "
    elif should_force_cleanup_pid "${listener_pid}"; then
      warn "${SERVICE_NAME} 端口 ${SERVICE_PORT} 仍被进程占用 (pid=${listener_pid})，按端口强制清理"
      stop_pid_tree_gracefully "${SERVICE_NAME}(端口占用进程)" "${listener_pid}" 20
      cleaned_pids="${cleaned_pids}${listener_pid} "
    else
      warn "${SERVICE_NAME} 端口 ${SERVICE_PORT} 仍被其他用户进程占用 (pid=${listener_pid})，未自动结束"
    fi
  fi

  while IFS= read -r extra_pid; do
    [[ -n "${extra_pid}" ]] || continue
    if [[ "${cleaned_pids}" == *" ${extra_pid} "* ]]; then
      continue
    fi
    if is_pid_running "${extra_pid}"; then
      warn "检测到 ${SERVICE_NAME} 存在残留进程树 (pid=${extra_pid})，正在清理"
      stop_pid_tree_gracefully "${SERVICE_NAME}(残留进程树)" "${extra_pid}" 20
      cleaned_pids="${cleaned_pids}${extra_pid} "
    fi
  done < <(service_process_pids | sort -u)

  if [[ -z "$(service_listener_pid)" ]]; then
    info "${SERVICE_NAME} 端口清理完成"
  fi

  clear_service_tracking
}
