#!/usr/bin/env bash
# Exit on error
set -e

echo "Starting build process..."
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Rebuild native modules for this environment
echo "Rebuilding sqlite3 from source..."
npm rebuild sqlite3 --build-from-source

echo "Build completed successfully" 