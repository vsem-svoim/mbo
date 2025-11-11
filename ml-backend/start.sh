#!/bin/bash
# Startup script for ML Backend API

set -e

echo "🚀 Starting ML Models Backend API..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $python_version"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"
export API_HOST="${API_HOST:-0.0.0.0}"
export API_PORT="${API_PORT:-8000}"

# Start the API server
echo "✅ Starting FastAPI server on ${API_HOST}:${API_PORT}..."
echo "📖 API docs will be available at http://localhost:${API_PORT}/docs"
echo ""

python -m uvicorn api.main:app \
    --host "${API_HOST}" \
    --port "${API_PORT}" \
    --reload \
    --log-level "${LOG_LEVEL,,}"
