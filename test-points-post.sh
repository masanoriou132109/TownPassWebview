#!/bin/bash

# API 基礎 URL
API_BASE="https://ws10.csie.ntu.edu.tw:54443"

# 固定 UUID
UUID="7f3562f4-bb3f-4ec7-89b9-da3b4b5ff250"

echo "1️⃣  POST /api/points - 新增點位（5 筆）"
echo "=========================================="
echo "使用 UUID: ${UUID}"
echo ""

# 定義基礎時間（2025-11-08T15:30:00:000000）
BASE_DATE="2025-11-08"
BASE_HOUR=15
BASE_MINUTE=30

# 台北市區的座標範圍（用於隨機生成）
# 基於之前成功的測試數據，使用更保守的範圍
# 緯度範圍：25.04 - 25.09（確保在台北市範圍內）
# 經度範圍：121.51 - 121.59（確保在台北市範圍內）
MIN_LAT=25.04
MAX_LAT=25.09
MIN_LON=121.51
MAX_LON=121.59

# 生成 5 筆隨機數據
for i in {1..5}; do
  # 隨機生成時間（每次增加 5-15 分鐘）
  MINUTE_OFFSET=$((RANDOM % 11 + 5))  # 5-15 分鐘
  MINUTE=$((BASE_MINUTE + (i - 1) * 10 + MINUTE_OFFSET))
  HOUR=$BASE_HOUR
  
  # 處理分鐘溢出
  while [ $MINUTE -ge 60 ]; do
    MINUTE=$((MINUTE - 60))
    HOUR=$((HOUR + 1))
  done
  
  TIME=$(printf "%sT%02d:%02d:00:000000" "$BASE_DATE" $HOUR $MINUTE)
  
  # 隨機生成座標（保留 4 位小數）
  LAT=$(awk "BEGIN {printf \"%.4f\", $MIN_LAT + ($MAX_LAT - $MIN_LAT) * rand()}")
  LON=$(awk "BEGIN {printf \"%.4f\", $MIN_LON + ($MAX_LON - $MIN_LON) * rand()}")
  
  echo "📍 點位 $i:"
  echo "   UUID: ${UUID}"
  echo "   時間: ${TIME}"
  echo "   位置: ${LAT}, ${LON}"
  echo ""
  
  RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/points" \
    -H "Content-Type: application/json" \
    -d "{
      \"uuid\": \"${UUID}\",
      \"time\": \"${TIME}\",
      \"lat\": ${LAT},
      \"lon\": ${LON}
    }")
  
  HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/api/points" \
    -H "Content-Type: application/json" \
    -d "{
      \"uuid\": \"${UUID}\",
      \"time\": \"${TIME}\",
      \"lat\": ${LAT},
      \"lon\": ${LON}
    }")
  
  echo "   狀態碼: ${HTTP_CODE}"
  echo "   回應:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  echo ""
  echo "----------------------------------------"
  echo ""
  
  # 稍微延遲，避免請求過快
  sleep 0.3
done

echo "✅ 完成！已發送 5 個點位到後端"
echo "UUID: ${UUID}"

