#!/usr/bin/env bash
# Exit on error
set -e

# Install dependencies
npm install

# Rebuild native modules for this environment
npm rebuild sqlite3 --build-from-source
npm rebuild bcrypt --build-from-source

echo "Build completed successfully" 