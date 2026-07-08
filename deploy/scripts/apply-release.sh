#!/usr/bin/env bash

set -Eeuo pipefail

# Applies a release of the Lifeline monorepo on the VPS. The app is a single
# container that serves the API, the built web SPA, and the embedded MCP
# endpoint (POST /mcp); Postgres is the only other service. Images are built on
# the host; the `current` symlink is flipped before build and rolled back on any
# failure. The app runs the idempotent baseline migration on startup, adopting
# the existing database without data loss.

ROOT_DIR="/opt/lifeline"
RELEASES_DIR="${ROOT_DIR}/releases"
CURRENT_LINK="${ROOT_DIR}/current"
PROJECT_NAME="lifeline"
APP_CONTAINER="lifeline-app"
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
COMPOSE_FILE_PATH="${release_dir}/compose.production.yaml"

# Health endpoints of the rebuilt app (readiness includes a DB ping).
INTERNAL_READY_URL="http://127.0.0.1:${APP_PORT}/health/ready"
PUBLIC_LIVE_URL="${APP_ORIGIN%/}/health/live"
PUBLIC_INFO_URL="${APP_ORIGIN%/}/api/v1/info"

compose_cmd=(docker compose -p "${PROJECT_NAME}" --env-file "${shared_env_file}" -f "${COMPOSE_FILE_PATH}")

if [[ ! -f "${COMPOSE_FILE_PATH}" ]]; then
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

start_core_services() {
  # --remove-orphans retires the old standalone lifeline-mcp container from the
  # previous (3-service) design; the MCP server is now embedded in the app.
  pushd "${release_dir}" > /dev/null
  "${compose_cmd[@]}" up -d --build --remove-orphans "${DB_CONTAINER}" "${APP_CONTAINER}"
  popd > /dev/null
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

start_core_services

wait_for_container_healthy "${DB_CONTAINER}" 180
wait_for_container_healthy "${APP_CONTAINER}" 240
wait_for_url "${INTERNAL_READY_URL}" 120
wait_for_url "${PUBLIC_LIVE_URL}" 120
wait_for_url "${PUBLIC_INFO_URL}" 120

if ! docker port "${APP_CONTAINER}" 3000 | grep -qx "127.0.0.1:${APP_PORT}"; then
  echo "Container port binding is no longer limited to 127.0.0.1:${APP_PORT}" >&2
  exit 1
fi

echo "--- docker ps ---"
docker ps --filter "name=lifeline-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

prune_old_releases

echo "Release applied successfully: ${release_dir}"
