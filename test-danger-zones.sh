#!/bin/bash

# API 基礎 URL
API_BASE="https://ws10.csie.ntu.edu.tw:54443"

echo "🔍 POST /api/danger-zones - 查詢危險區域（DBSCAN）"
echo "=========================================="
echo ""

# 測試參數
LAT=25.0450
LNG=121.5170
RADIUS=2000
EPS=500
MINPOINTS=3

echo "請求參數:"
echo "  lat: ${LAT}"
echo "  lng: ${LNG}"
echo "  radius: ${RADIUS} (公尺)"
echo "  eps: ${EPS} (公尺)"
echo "  minpoints: ${MINPOINTS}"
echo ""

RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/danger-zones" \
  -H "Content-Type: application/json" \
  -d "{
    \"lat\": ${LAT},
    \"lng\": ${LNG},
    \"radius\": ${RADIUS},
    \"eps\": ${EPS},
    \"minpoints\": ${MINPOINTS}
  }")

HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/api/danger-zones" \
  -H "Content-Type: application/json" \
  -d "{
    \"lat\": ${LAT},
    \"lng\": ${LNG},
    \"radius\": ${RADIUS},
    \"eps\": ${EPS},
    \"minpoints\": ${MINPOINTS}
  }")

echo "狀態碼: ${HTTP_CODE}"
echo ""
echo "回應內容:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo ""

# 解析並顯示統計資訊
if command -v jq &> /dev/null; then
  echo "📊 統計資訊:"
  echo "$RESPONSE" | jq -r '.data.statistics | "  總點數: \(.total_points_in_range)\n  群集數量: \(.clusters_found)\n  噪音點數: \(.noise_points)\n  總 Alpha: \(.total_alpha_sum)\n  群集 Alpha: \(.clusters_alpha_sum)\n  噪音 Alpha: \(.noise_alpha_sum)"' 2>/dev/null
  
  echo ""
  echo "📍 群集列表:"
  echo "$RESPONSE" | jq -r '.data.clusters[]? | "  群集 #\(.cluster_id): \(.point_count) 個點, Alpha=\(.alpha), 風險=\(.risk_level), 位置=(\(.lat), \(.lng))"' 2>/dev/null
  
  echo ""
  echo "🔸 噪音點列表:"
  echo "$RESPONSE" | jq -r '.data.noise_points[]? | "  點位 #\(.id): Alpha=\(.alpha), 位置=(\(.lat), \(.lng))"' 2>/dev/null
fi

echo ""
echo "✅ 測試完成！"

