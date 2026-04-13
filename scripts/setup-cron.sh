#!/bin/bash

# Setup automated database maintenance with cron
# Run this script once to configure automatic maintenance

echo "🔧 Setting up automated database maintenance..."
echo ""

# Getting project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_PATH=$(which node)

echo "Project directory: $PROJECT_DIR"
echo "Node.js path: $NODE_PATH"
echo ""

# Create cron jobs
CRON_JOBS="
# M-Pesa Download Site - Database Maintenance
# Run every 6 months on the 1st at 2:00 AM - Export accounting data
0 2 1 */6 * cd $PROJECT_DIR && $NODE_PATH database/maintenance.js export >> $PROJECT_DIR/logs/maintenance.log 2>&1

# Run monthly on the 1st at 3:00 AM - Archive old transactions (1+ year)
0 3 1 * * cd $PROJECT_DIR && $NODE_PATH database/maintenance.js archive >> $PROJECT_DIR/logs/maintenance.log 2>&1

# Run weekly on Sunday at 4:00 AM - Delete failed transactions (30+ days)
0 4 * * 0 cd $PROJECT_DIR && $NODE_PATH database/maintenance.js cleanup >> $PROJECT_DIR/logs/maintenance.log 2>&1
"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Backup existing crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_JOBS") | crontab -

echo "✅ Cron jobs installed successfully!"
echo ""
echo "Scheduled maintenance:"
echo "  📊 Export accounting data: Every 6 months (1st @ 2:00 AM)"
echo "  🗄️  Archive old transactions: Monthly (1st @ 3:00 AM)"
echo "  🗑️  Clean failed transactions: Weekly (Sunday @ 4:00 AM)"
echo ""
echo "Logs will be saved to: $PROJECT_DIR/logs/maintenance.log"
echo ""
echo "To view scheduled jobs, run: crontab -l"
echo "To remove scheduled jobs, run: crontab -e (then delete the lines)"
echo ""
