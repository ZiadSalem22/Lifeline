#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="/opt/lifeline"
RELEASES_DIR="${ROOT_DIR}/releases"
CURRENT_LINK="${ROOT_DIR}/current"
PROJECT_NAME="lifeline"
APP_CONTAINER="lifeline-app"
MCP_CONTAINER="lifeline-mcp"
DB_CONTAINER="lifeline-postgres"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

release_dir="${1:-}"
shared_env_file="${2:-${ROOT_DIR}/shared/.env.production}"

if [[ -z "${release_dir}" ]]; then
  echo "Usage: $0 <release-dir> [shared-env-file]" >&2
  exit 1
fi

if [[ ! -d "${release_dir}" ]]; then
  echo "Release directory not found: ${release_dir}" >&2
  exit 1
fi

if [[ ! -f "${shared_env_file}" ]]; then
  echo "Shared production env file not found: ${shared_env_file}" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${shared_env_file}"
set +a

APP_PORT="${APP_PORT:-3020}"
APP_ORIGIN="${APP_ORIGIN:-https://lifeline.a2z-us.com}"
MCP_PORT="${MCP_PORT:-3030}"
MCP_PUBLIC_BASE_URL="${MCP_PUBLIC_BASE_URL:-https://mcp.lifeline.a2z-us.com}"

PUBLIC_HEALTH_URL="${APP_ORIGIN%/}/api/health/db"
PUBLIC_INFO_URL="${APP_ORIGIN%/}/api/public/info"
INTERNAL_HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health/db"
MCP_INTERNAL_HEALTH_URL="http://127.0.0.1:${MCP_PORT}/health"

if [[ ! -f "${release_dir}/compose.production.yaml" ]]; then
  echo "compose.production.yaml is missing from ${release_dir}" >&2
  exit 1
fi

previous_release=""
if [[ -L "${CURRENT_LINK}" || -e "${CURRENT_LINK}" ]]; then
  previous_release="$(readlink -f "${CURRENT_LINK}" || true)"
fi

rollback() {
  local exit_code=$?

  set +e
  echo "Deployment failed for ${release_dir}; collecting diagnostics..." >&2

  if [[ -n "${previous_release}" && -d "${previous_release}" ]]; then
    ln -sfn "${previous_release}" "${CURRENT_LINK}"
    echo "Restored current symlink to ${previous_release}" >&2

    if [[ -f "${previous_release}/compose.production.yaml" ]]; then
      echo "Re-applying previous release containers from ${previous_release}" >&2
      docker compose -p "${PROJECT_NAME}" --env-file "${shared_env_file}" -f "${previous_release}/compose.production.yaml" up -d --build --remove-orphans >&2 || true
    fi
  fi

  echo "--- docker ps ---" >&2
  docker ps -a >&2 || true

  echo "--- ${APP_CONTAINER} logs ---" >&2
  docker logs --tail 200 "${APP_CONTAINER}" >&2 || true

  echo "--- ${DB_CONTAINER} logs ---" >&2
  docker logs --tail 200 "${DB_CONTAINER}" >&2 || true

  echo "--- ${MCP_CONTAINER} logs ---" >&2
  docker logs --tail 200 "${MCP_CONTAINER}" >&2 || true

  exit "${exit_code}"
}

wait_for_url() {
  local url="$1"
  local timeout_seconds="$2"
  local elapsed=0

  until curl --fail --silent --show-error --location "$url" > /dev/null; do
    if (( elapsed >= timeout_seconds )); then
      echo "Timed out waiting for URL: ${url}" >&2
      return 1
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done
}

wait_for_container_healthy() {
  local container_name="$1"
  local timeout_seconds="$2"
  local elapsed=0
  local status=""

  while (( elapsed < timeout_seconds )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}" 2>/dev/null || true)"

    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      return 0
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done

  echo "Container ${container_name} did not become healthy. Last status: ${status:-unknown}" >&2
  return 1
}

wait_for_mcp_backend_path() {
  local container_name="$1"
  local timeout_seconds="$2"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if docker exec "${container_name}" node -e "fetch(\`${process.env.LIFELINE_BACKEND_BASE_URL}/internal/mcp/health\`, { headers: { 'x-lifeline-internal-service-secret': process.env.MCP_INTERNAL_SHARED_SECRET } }).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      return 0
    fi

    sleep 5
    elapsed=$((elapsed + 5))
  done

  echo "MCP container ${container_name} could not reach the backend internal MCP adapter path." >&2
  return 1
}

prune_old_releases() {
  mapfile -t release_paths < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | awk '{print $2}')

  if (( ${#release_paths[@]} <= KEEP_RELEASES )); then
    return 0
  fi

  local index=0
  for old_release in "${release_paths[@]}"; do
    index=$((index + 1))

    if (( index <= KEEP_RELEASES )); then
      continue
    fi

    if [[ "${old_release}" == "${release_dir}" || "${old_release}" == "${previous_release}" ]]; then
      continue
    fi

    rm -rf "${old_release}"
  done
}

trap rollback ERR

ln -sfn "${release_dir}" "${CURRENT_LINK}"

pushd "${release_dir}" > /dev/null
docker compose -p "${PROJECT_NAME}" --env-file "${shared_env_file}" -f compose.production.yaml up -d --build --remove-orphans
popd > /dev/null

wait_for_container_healthy "${DB_CONTAINER}" 180
wait_for_container_healthy "${APP_CONTAINER}" 240
wait_for_container_healthy "${MCP_CONTAINER}" 180
wait_for_url "${INTERNAL_HEALTH_URL}" 120
wait_for_url "${PUBLIC_HEALTH_URL}" 120
wait_for_url "${PUBLIC_INFO_URL}" 120
wait_for_url "${MCP_INTERNAL_HEALTH_URL}" 120
wait_for_mcp_backend_path "${MCP_CONTAINER}" 120

if ! docker port "${APP_CONTAINER}" 3000 | grep -qx "127.0.0.1:${APP_PORT}"; then
  echo "Container port binding is no longer limited to 127.0.0.1:${APP_PORT}" >&2
  exit 1
fi

if ! docker port "${MCP_CONTAINER}" "${MCP_PORT}" | grep -qx "127.0.0.1:${MCP_PORT}"; then
  echo "MCP container port binding is no longer limited to 127.0.0.1:${MCP_PORT}" >&2
  exit 1
fi

echo "--- docker ps ---"
docker ps --filter "name=lifeline-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

prune_old_releases

echo "Release applied successfully: ${release_dir}"
