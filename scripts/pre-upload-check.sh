#!/bin/bash

echo "🔍 Security Check Before GitHub Upload..."
echo ""

# Check for .env file
if [ -f .env ]; then
    echo "⚠️  WARNING: .env file found!"
    echo "   Make sure it's in .gitignore"
else
    echo "✅ No .env file (good - use .env.example)"
fi

# Check for .gitignore
if [ -f .gitignore ]; then
    echo "✅ .gitignore exists"
else
    echo "❌ ERROR: No .gitignore file!"
    exit 1
fi

# Check for sensitive data in .gitignore
if grep -q "\.env" .gitignore; then
    echo "✅ .env is in .gitignore"
else
    echo "❌ ERROR: .env not in .gitignore!"
    exit 1
fi

# Check for database files
if ls database/*.db 1> /dev/null 2>&1; then
    echo "⚠️  Database files found"
    if grep -q "\.db" .gitignore; then
        echo "✅ Database files in .gitignore"
    else
        echo "❌ ERROR: Database files not in .gitignore!"
        exit 1
    fi
fi

# Check for downloads
if [ -d downloads ] && [ "$(ls -A downloads)" ]; then
    echo "⚠️  Files in downloads folder"
    if grep -q "downloads/\*" .gitignore; then
        echo "✅ Downloads excluded in .gitignore"
    else
        echo "❌ ERROR: Downloads not in .gitignore!"
        exit 1
    fi
fi

echo ""
echo "✅ Security check passed! Safe to upload to GitHub"
