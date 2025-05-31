
#!/bin/bash

echo "Starting Chess Application..."

# Start backend in background
cd chess-backend
echo "Starting Laravel backend on port 8000..."
php -S 0.0.0.0:8000 -t public > backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
cd ../chess-frontend
echo "Installing frontend dependencies..."
npm install

echo "Starting React frontend on port 3000..."
REACT_APP_API_URL=http://localhost:8000 npm start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
