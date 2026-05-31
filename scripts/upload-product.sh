#!/bin/bash

# Upload product files to server
# Usage: ./upload-product.sh filename.zip

if [ -z "$1" ]; then
    echo "Usage: ./upload-product.sh filename.zip"
    exit 1
fi

SERVER="user@your-server-ip"
DEST="/home/deploy/dukayame/downloads/"

echo "📤 Uploading $1 to server..."
scp "$1" "$SERVER:$DEST"

if [ $? -eq 0 ]; then
    echo "✅ Upload complete!"
    echo "📝 Don't forget to add to database:"
    echo "   ssh $SERVER"
    echo "   cd /home/deploy/dukayame"
    echo "   node add-product.js"
else
    echo "❌ Upload failed!"
fi
