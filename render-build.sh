#!/usr/bin/env bash
# Exit on error
set -e

# Install dependencies
npm install

# Rebuild sqlite3 specifically for this environment
npm rebuild sqlite3 --build-from-source

echo "Build completed successfully" 