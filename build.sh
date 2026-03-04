#!/usr/bin/env bash
# Build script for Render deployment
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js if not available
if ! command -v node &> /dev/null; then
    echo "Node.js not found, installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install frontend dependencies and build
cd frontend
npm install
npm run build
cd ..

echo "Build completed successfully!"
