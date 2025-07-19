#!/bin/bash

# 3D Gallery Exhibition Project Startup Script
# This script resolves Node.js v17+ compatibility issues with older webpack versions

echo "🚀 Starting 3D Gallery Exhibition Project..."
echo "📝 Setting up Node.js legacy OpenSSL provider for compatibility..."

# Set Node.js options for legacy OpenSSL provider
export NODE_OPTIONS="--openssl-legacy-provider"

echo "✅ Environment configured successfully!"
echo "🌐 Starting development server..."

# Start the Vue.js development server
npm run serve 