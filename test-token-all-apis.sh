#!/bin/bash

API_BASE="https://ws10.csie.ntu.edu.tw:54443"

# 从图片中获取的数据
ID="7f3562f4-bb3f-4ec7-89b9-da3b4b5ff250"
ID_NO="A123456789"

echo "🔐 步骤 1: 获取 JWT Token"
echo "=================================="
TOKEN_RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"uuid\": \"${ID}\",
    \"idNo\": \"${ID_NO}\"
  }")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ] || [ "$TOKEN" == "" ]; then
  echo "❌ 无法获取 JWT Token"
  exit 1
fi

echo "✅ Token 获取成功"
echo "Token (前50字符): ${TOKEN:0:50}..."
echo ""

echo "🧪 步骤 2: 测试所有 API 端点（使用 JWT Token）"
echo "=================================="
echo ""

# 测试 1: POST /api/points
echo "1️⃣ 测试 POST /api/points"
echo "--------------------------------"
POINTS_RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/points" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"uuid\": \"${ID}\",
    \"time\": \"2025-01-08T15:30:00:000000\",
    \"lat\": 25.0478,
    \"lon\": 121.5170,
    \"type\": \"light\"
  }")
HTTP_CODE=$(curl -k -s -w "%{http_code}" -o /dev/null -X POST "${API_BASE}/api/points" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"uuid\": \"${ID}\",
    \"time\": \"2025-01-08T15:30:00:000000\",
    \"lat\": 25.0478,
    \"lon\": 121.5170,
    \"type\": \"light\"
  }")
echo "HTTP 状态码: $HTTP_CODE"
echo "$POINTS_RESPONSE" | jq . 2>/dev/null || echo "$POINTS_RESPONSE"
echo ""

# 测试 2: GET /api/points/:uuid
echo "2️⃣ 测试 GET /api/points/${ID}"
echo "--------------------------------"
GET_POINTS_RESPONSE=$(curl -k -s -X GET "${API_BASE}/api/points/${ID}" \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(curl -k -s -w "%{http_code}" -o /dev/null -X GET "${API_BASE}/api/points/${ID}" \
  -H "Authorization: Bearer ${TOKEN}")
echo "HTTP 状态码: $HTTP_CODE"
echo "$GET_POINTS_RESPONSE" | jq . 2>/dev/null || echo "$GET_POINTS_RESPONSE"
echo ""

# 测试 3: POST /api/danger-zones
echo "3️⃣ 测试 POST /api/danger-zones"
echo "--------------------------------"
DANGER_ZONES_RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/danger-zones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"lat\": 25.0450,
    \"lng\": 121.5170,
    \"radius\": 2000,
    \"eps\": 500,
    \"minpoints\": 3
  }")
HTTP_CODE=$(curl -k -s -w "%{http_code}" -o /dev/null -X POST "${API_BASE}/api/danger-zones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"lat\": 25.0450,
    \"lng\": 121.5170,
    \"radius\": 2000,
    \"eps\": 500,
    \"minpoints\": 3
  }")
echo "HTTP 状态码: $HTTP_CODE"
echo "$DANGER_ZONES_RESPONSE" | jq . 2>/dev/null || echo "$DANGER_ZONES_RESPONSE"
echo ""

# 测试 4: POST /api/route/search
echo "4️⃣ 测试 POST /api/route/search"
echo "--------------------------------"
ROUTE_SEARCH_RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/route/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"points\": [
      {
        \"lat\": 25.0478,
        \"lon\": 121.5170,
        \"searchRadius\": 500,
        \"time\": \"2025-01-08T15:30:00:000000\"
      }
    ]
  }")
HTTP_CODE=$(curl -k -s -w "%{http_code}" -o /dev/null -X POST "${API_BASE}/api/route/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"points\": [
      {
        \"lat\": 25.0478,
        \"lon\": 121.5170,
        \"searchRadius\": 500,
        \"time\": \"2025-01-08T15:30:00:000000\"
      }
    ]
  }")
echo "HTTP 状态码: $HTTP_CODE"
echo "$ROUTE_SEARCH_RESPONSE" | jq . 2>/dev/null || echo "$ROUTE_SEARCH_RESPONSE"
echo ""

# 测试 5: POST /api/route/plan
echo "5️⃣ 测试 POST /api/route/plan"
echo "--------------------------------"
ROUTE_PLAN_RESPONSE=$(curl -k -s -X POST "${API_BASE}/api/route/plan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"points\": [
      {
        \"lat\": 25.0478,
        \"lon\": 121.5170,
        \"searchRadius\": 500,
        \"time\": \"2025-01-08T15:30:00:000000\"
      }
    ]
  }")
HTTP_CODE=$(curl -k -s -w "%{http_code}" -o /dev/null -X POST "${API_BASE}/api/route/plan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"points\": [
      {
        \"lat\": 25.0478,
        \"lon\": 121.5170,
        \"searchRadius\": 500,
        \"time\": \"2025-01-08T15:30:00:000000\"
      }
    ]
  }")
echo "HTTP 状态码: $HTTP_CODE"
echo "$ROUTE_PLAN_RESPONSE" | jq . 2>/dev/null || echo "$ROUTE_PLAN_RESPONSE"
echo ""

echo "✅ 所有 API 测试完成！"
echo ""
echo "📝 Token 信息:"
echo "   Token: ${TOKEN:0:50}..."
echo ""
echo "💡 要在浏览器中使用此 token，请在浏览器控制台执行:"
echo "   localStorage.setItem('token', '${TOKEN}')"

