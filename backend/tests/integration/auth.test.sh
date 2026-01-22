#!/bin/bash

# Conversion.ai MVP - Auth Integration Test
# Tests full auth flow: register → login → access protected route

set -e  # Exit on first error

BASE_URL="${BASE_URL:-http://localhost:3001}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_${TIMESTAMP}@example.com"
TEST_PASSWORD="password123"
TEST_NAME="Test User ${TIMESTAMP}"

echo "========================================"
echo "  Auth Integration Test"
echo "========================================"
echo ""
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Test 1: Health Check (Step 1 still works)
echo "Test 1: Health Check"
echo "-------------------"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo "✅ PASS: Health endpoint returns status: ok"
else
    echo "❌ FAIL: Health endpoint failed"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

if echo "$HEALTH_RESPONSE" | grep -q '"database":"connected"'; then
    echo "✅ PASS: Database is connected"
else
    echo "❌ FAIL: Database not connected"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Register New User
echo "Test 2: Register New User"
echo "------------------------"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"$TEST_NAME\"}")

if echo "$REGISTER_RESPONSE" | grep -q '"token"'; then
    echo "✅ PASS: Registration successful, token received"
    REGISTER_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ FAIL: Registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

if echo "$REGISTER_RESPONSE" | grep -q '"user"'; then
    echo "✅ PASS: User object returned"
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   User ID: $USER_ID"
else
    echo "❌ FAIL: User object not in response"
    exit 1
fi
echo ""

# Test 3: Duplicate Registration Fails
echo "Test 3: Duplicate Registration Fails"
echo "------------------------------------"
DUPE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

if echo "$DUPE_RESPONSE" | grep -q '"code":"EMAIL_EXISTS"'; then
    echo "✅ PASS: Duplicate email rejected with EMAIL_EXISTS"
else
    echo "❌ FAIL: Duplicate email not properly rejected"
    echo "Response: $DUPE_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Login with Correct Credentials
echo "Test 4: Login with Correct Credentials"
echo "--------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    echo "✅ PASS: Login successful, token received"
    LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ FAIL: Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Test 5: Login with Wrong Password
echo "Test 5: Login with Wrong Password"
echo "---------------------------------"
WRONG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"wrongpassword\"}")

if echo "$WRONG_RESPONSE" | grep -q '"code":"INVALID_CREDENTIALS"'; then
    echo "✅ PASS: Wrong password returns INVALID_CREDENTIALS"
else
    echo "❌ FAIL: Wrong password not properly rejected"
    echo "Response: $WRONG_RESPONSE"
    exit 1
fi
echo ""

# Test 6: Access Protected Route with Valid Token
echo "Test 6: Access Protected Route with Valid Token"
echo "-----------------------------------------------"
ME_RESPONSE=$(curl -s "$BASE_URL/api/v1/auth/me" \
    -H "Authorization: Bearer $LOGIN_TOKEN")

if echo "$ME_RESPONSE" | grep -q '"user"'; then
    echo "✅ PASS: Protected route accessible with valid token"
else
    echo "❌ FAIL: Protected route failed with valid token"
    echo "Response: $ME_RESPONSE"
    exit 1
fi

if echo "$ME_RESPONSE" | grep -q "$TEST_EMAIL"; then
    echo "✅ PASS: Correct user data returned"
else
    echo "❌ FAIL: Wrong user data returned"
    echo "Response: $ME_RESPONSE"
    exit 1
fi
echo ""

# Test 7: Access Protected Route without Token
echo "Test 7: Access Protected Route without Token"
echo "--------------------------------------------"
NO_TOKEN_RESPONSE=$(curl -s "$BASE_URL/api/v1/auth/me")

if echo "$NO_TOKEN_RESPONSE" | grep -q '"code":"NO_TOKEN"'; then
    echo "✅ PASS: No token returns 401 with NO_TOKEN"
else
    echo "❌ FAIL: No token not properly rejected"
    echo "Response: $NO_TOKEN_RESPONSE"
    exit 1
fi
echo ""

# Test 8: Access Protected Route with Invalid Token
echo "Test 8: Access Protected Route with Invalid Token"
echo "-------------------------------------------------"
BAD_TOKEN_RESPONSE=$(curl -s "$BASE_URL/api/v1/auth/me" \
    -H "Authorization: Bearer invalid.token.here")

if echo "$BAD_TOKEN_RESPONSE" | grep -q '"code":"INVALID_TOKEN"'; then
    echo "✅ PASS: Invalid token returns 401 with INVALID_TOKEN"
else
    echo "❌ FAIL: Invalid token not properly rejected"
    echo "Response: $BAD_TOKEN_RESPONSE"
    exit 1
fi
echo ""

# Test 9: Logout
echo "Test 9: Logout"
echo "--------------"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
    -H "Authorization: Bearer $LOGIN_TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q '"message"'; then
    echo "✅ PASS: Logout endpoint responds"
else
    echo "⚠️  WARN: Logout response unexpected"
    echo "Response: $LOGOUT_RESPONSE"
fi
echo ""

echo "========================================"
echo "  ALL TESTS PASSED!"
echo "========================================"
echo ""
echo "Summary:"
echo "  ✅ Health check works (Step 1 verified)"
echo "  ✅ User registration works"
echo "  ✅ Duplicate email rejected"
echo "  ✅ Login works with correct credentials"
echo "  ✅ Invalid credentials rejected"
echo "  ✅ Protected routes work with valid token"
echo "  ✅ Protected routes reject missing token"
echo "  ✅ Protected routes reject invalid token"
echo "  ✅ Logout endpoint responds"
echo ""
