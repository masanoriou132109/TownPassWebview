#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIST="${ROOT_DIR}/dist"
TARGET_ROOT="/var/www/tp_hobby"
TARGET_DIST="${TARGET_ROOT}/dist"
BACKUP_ROOT="/var/www/tp_hobby_backup"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIST="${BACKUP_ROOT}/dist_${TIMESTAMP}"

if [[ ! -d "${SOURCE_DIST}" ]]; then
  echo "[deploy-to-tp] 找不到 dist 目錄：${SOURCE_DIST}"
  echo "請先在 frontend 專案執行 build 後再嘗試。"
  exit 1
fi

echo "[deploy-to-tp] 確認備份目錄存在：${BACKUP_ROOT}"
mkdir -p "${BACKUP_ROOT}"

if [[ -d "${TARGET_DIST}" ]]; then
  echo "[deploy-to-tp] 備份既有 dist → ${BACKUP_DIST}"
  cp -a "${TARGET_DIST}" "${BACKUP_DIST}"
else
  echo "[deploy-to-tp] 目標 dist 不存在，略過備份。"
fi

echo "[deploy-to-tp] 建立目標目錄：${TARGET_ROOT}"
mkdir -p "${TARGET_ROOT}"

echo "[deploy-to-tp] 複製新 dist 到 ${TARGET_DIST}"
rm -rf "${TARGET_DIST}"
cp -a "${SOURCE_DIST}" "${TARGET_DIST}"

echo "[deploy-to-tp] 完成。"

