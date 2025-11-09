#!/bin/bash

API_BASE="https://ws10.csie.ntu.edu.tw:54443"

# 从图片中获取的数据
ID="7f3562f4-bb3f-4ec7-89b9-da3b4b5ff250"
ID_NO="A123456789"

echo "🔐 测试 JWT Token 获取"
echo "=================================="
echo "ID: $ID"
echo "ID No: $ID_NO"
echo ""

echo "📤 发送登录请求..."
HTTP_CODE=$(curl -k -s -w "\n%{http_code}" -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"uuid\": \"${ID}\",
    \"idNo\": \"${ID_NO}\"
  }")

# 分离响应体和状态码
RESPONSE_BODY=$(echo "$HTTP_CODE" | head -n -1)
HTTP_STATUS=$(echo "$HTTP_CODE" | tail -n 1)

echo ""
echo "📊 HTTP 状态码: $HTTP_STATUS"
echo "📥 后端响应:"
echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

# 提取 token
TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.data.token // empty' 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
  echo "✅ 成功获取 JWT Token!"
  echo "Token (前50字符): ${TOKEN:0:50}..."
  echo ""
  echo "💾 Token 已保存到 localStorage (在浏览器中)"
else
  echo "❌ 未能获取 JWT Token"
  if [ "$HTTP_STATUS" != "200" ]; then
    echo "HTTP 状态码: $HTTP_STATUS"
  fi
fi

