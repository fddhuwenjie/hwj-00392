#!/bin/bash
echo "Installing backend dependencies..."
cd "$(dirname "$0")/backend"
npm install
echo "Starting backend server on port 8392..."
node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Installing frontend dependencies..."
cd "$(dirname "$0")/frontend"
npm install
echo "Starting frontend dev server on port 3392..."
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "Servers started!"
echo "Backend: http://localhost:8392"
echo "Frontend: http://localhost:3392"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
