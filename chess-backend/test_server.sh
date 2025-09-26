#!/bin/bash

echo "=== Chess Backend Server Test Script ==="
echo "Testing server connectivity and endpoints step by step"
echo ""

SERVER_URL="http://127.0.0.1:8000"

echo "1. Testing basic server connectivity..."
curl -v "$SERVER_URL/up" 2>&1
echo ""

echo "2. Testing public test endpoint (GET)..."
curl -v "$SERVER_URL/public-test" 2>&1
echo ""

echo "3. Testing debug test endpoint (POST)..."
curl -v -X POST "$SERVER_URL/debug-test" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' 2>&1
echo ""

echo "4. Testing game-history endpoint with minimal data..."
curl -v -X POST "$SERVER_URL/public/game-history" \
  -H "Content-Type: application/json" \
  -d '{
    "player_color": "w",
    "computer_level": 1,
    "moves": "e4 e5",
    "final_score": 100,
    "result": "win"
  }' 2>&1
echo ""

echo "5. Testing game-history endpoint with full data..."
curl -v -X POST "$SERVER_URL/public/game-history" \
  -H "Content-Type: application/json" \
  -d '{
    "played_at": "2025-01-01 12:00:00",
    "player_color": "b",
    "computer_level": 3,
    "moves": "e4 e5 Nf3 Nc6",
    "final_score": 250,
    "result": "loss"
  }' 2>&1

echo ""
echo "=== Test completed. Check the Laravel logs for detailed information ==="