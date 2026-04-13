const db = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Database Maintenance Script
 * 
 * Features:
 * 1. Archive old transactions (older than 1 year)
 * 2. Delete failed transactions (older than 30 days)
 * 3. Export accounting data (every 6 months)
 */

class DatabaseMaintenance {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.archiveDir = path.join(__dirname, '..', 'archives');
    this.exportDir = path.join(__dirname, '..', 'exports');
    
    // Create directories if they don't exist
    [this.backupDir, this.archiveDir, this.exportDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Archive transactions older than 1 year
   */
  async archiveOldTransactions() {
    try {
      console.log('🗄️  Starting transaction archival...');
      
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoffDate = oneYearAgo.toISOString();

      // Get transactions to archive
      const transactionsToArchive = await db.all(`
        SELECT t.*, p.name as product_name
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        WHERE t.created_at < ?
      `, [cutoffDate]);

      if (transactionsToArchive.length === 0) {
        console.log('✅ No transactions to archive');
        return { archived: 0 };
      }

      // Create archive file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const archiveFile = path.join(this.archiveDir, `transactions_archive_${timestamp}.json`);
      
      fs.writeFileSync(archiveFile, JSON.stringify(transactionsToArchive, null, 2));
      console.log(`📦 Archived ${transactionsToArchive.length} transactions to ${archiveFile}`);

      // Delete archived transactions from main database
      const result = await db.run(`
        DELETE FROM transactions
        WHERE created_at < ?
      `, [cutoffDate]);

      console.log(`✅ Removed ${result.changes} transactions from active database`);
      
      return {
        archived: transactionsToArchive.length,
        archiveFile: archiveFile
      };
    } catch (error) {
      console.error('❌ Error archiving transactions:', error);
      throw error;
    }
  }

  /**
   * Delete failed transactions older than 30 days
   */
  async deleteFailedTransactions() {
    try {
      console.log('🗑️  Cleaning up failed transactions...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString();

      // Get count before deletion
      const beforeCount = await db.get(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE status = 'failed' AND created_at < ?
      `, [cutoffDate]);

      // Delete failed transactions
      const result = await db.run(`
        DELETE FROM transactions
        WHERE status = 'failed' AND created_at < ?
      `, [cutoffDate]);

      console.log(`✅ Deleted ${result.changes} failed transactions older than 30 days`);
      
      return {
        deleted: result.changes
      };
    } catch (error) {
      console.error('❌ Error deleting failed transactions:', error);
      throw error;
    }
  }

  /**
   * xport accounting data for the last 6 months
   */
  async exportAccountingData() {
    try {
      console.log('📊 Exporting accounting data...');
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString();

      // Get completed transactions from last 6 months
      const transactions = await db.all(`
        SELECT 
          t.id,
          t.created_at as transaction_date,
          t.phone_number,
          p.name as product_name,
          t.amount,
          t.mpesa_receipt_number,
          t.download_count,
          t.updated_at as completion_date
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        WHERE t.status = 'completed' AND t.created_at >= ?
        ORDER BY t.created_at DESC
      `, [startDate]);

      if (transactions.length === 0) {
        console.log('✅ No completed transactions in the last 6 months');
        return { exported: 0 };
      }

      // Calculate summary
      const summary = {
        period: {
          start: startDate,
          end: new Date().toISOString()
        },
        totalTransactions: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + t.amount, 0),
        averageOrderValue: transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length,
        productBreakdown: {}
      };

      // Product breakdown
      transactions.forEach(t => {
        if (!summary.productBreakdown[t.product_name]) {
          summary.productBreakdown[t.product_name] = {
            count: 0,
            revenue: 0
          };
        }
        summary.productBreakdown[t.product_name].count++;
        summary.productBreakdown[t.product_name].revenue += t.amount;
      });

      // Create export files
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      
      // JSON export (detailed)
      const jsonFile = path.join(this.exportDir, `accounting_${timestamp}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify({
        summary,
        transactions
      }, null, 2));

      // CSV export (for Excel/accounting software)
      const csvFile = path.join(this.exportDir, `accounting_${timestamp}.csv`);
      const csvHeader = 'Transaction ID,Date,Phone Number,Product,Amount (KSh),M-Pesa Receipt,Downloads,Completion Date\n';
      const csvRows = transactions.map(t => 
        `${t.id},"${t.transaction_date}","${t.phone_number}","${t.product_name}",${t.amount},"${t.mpesa_receipt_number}",${t.download_count},"${t.completion_date}"`
      ).join('\n');
      fs.writeFileSync(csvFile, csvHeader + csvRows);

      console.log(`✅ Exported ${transactions.length} transactions`);
      console.log(`📄 JSON: ${jsonFile}`);
      console.log(`📊 CSV: ${csvFile}`);
      console.log(`💰 Total Revenue: KSh ${summary.totalRevenue.toFixed(2)}`);
      
      return {
        exported: transactions.length,
        totalRevenue: summary.totalRevenue,
        jsonFile,
        csvFile,
        summary
      };
    } catch (error) {
      console.error('❌ Error exporting accounting data:', error);
      throw error;
    }
  }

  /**
   * Run full maintenance routine
   */
  async runFullMaintenance() {
    console.log('\n🔧 Starting Database Maintenance\n');
    console.log('=================================\n');

    const results = {
      timestamp: new Date().toISOString(),
      archive: null,
      cleanup: null,
      export: null
    };

    try {
      // 1. Archive old transactions (1+ year)
      results.archive = await this.archiveOldTransactions();
      console.log('');

      // 2. Delete failed transactions (30+ days)
      results.cleanup = await this.deleteFailedTransactions();
      console.log('');

      // 3. Export accounting data (last 6 months)
      results.export = await this.exportAccountingData();
      console.log('');

      console.log('=================================');
      console.log('✅ Maintenance completed successfully!\n');

      // Save maintenance log
      const logFile = path.join(this.backupDir, `maintenance_log_${new Date().toISOString().split('T')[0]}.json`);
      fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
      console.log(`📝 Maintenance log saved: ${logFile}\n`);

      return results;
    } catch (error) {
      console.error('\n❌ Maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Get maintenance statistics
   */
  async getMaintenanceStats() {
    try {
      const stats = {
        totalTransactions: 0,
        completedTransactions: 0,
        pendingTransactions: 0,
        failedTransactions: 0,
        oldestTransaction: null,
        newestTransaction: null,
        failedOlderThan30Days: 0,
        transactionsOlderThan1Year: 0,
        totalRevenue: 0,
        revenueLastSixMonths: 0
      };

      // Total transactions
      const total = await db.get('SELECT COUNT(*) as count FROM transactions');
      stats.totalTransactions = total.count;

      // By status
      const completed = await db.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'");
      stats.completedTransactions = completed.count;

      const pending = await db.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'");
      stats.pendingTransactions = pending.count;

      const failed = await db.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'failed'");
      stats.failedTransactions = failed.count;

      // Date ranges
      const dateRange = await db.get('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM transactions');
      stats.oldestTransaction = dateRange.oldest;
      stats.newestTransaction = dateRange.newest;

      // Failed older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const oldFailed = await db.get(
        "SELECT COUNT(*) as count FROM transactions WHERE status = 'failed' AND created_at < ?",
        [thirtyDaysAgo.toISOString()]
      );
      stats.failedOlderThan30Days = oldFailed.count;

      // Transactions older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oldTrans = await db.get(
        'SELECT COUNT(*) as count FROM transactions WHERE created_at < ?',
        [oneYearAgo.toISOString()]
      );
      stats.transactionsOlderThan1Year = oldTrans.count;

      // Revenue
      const revenue = await db.get("SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'");
      stats.totalRevenue = revenue.total || 0;

      // Revenue last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentRevenue = await db.get(
        "SELECT SUM(amount) as total FROM transactions WHERE status = 'completed' AND created_at >= ?",
        [sixMonthsAgo.toISOString()]
      );
      stats.revenueLastSixMonths = recentRevenue.total || 0;

      return stats;
    } catch (error) {
      console.error('Error getting maintenance stats:', error);
      throw error;
    }
  }
}

// Export class
module.exports = DatabaseMaintenance;

// CLI usage
if (require.main === module) {
  const maintenance = new DatabaseMaintenance();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'archive':
      maintenance.archiveOldTransactions()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'cleanup':
      maintenance.deleteFailedTransactions()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'export':
      maintenance.exportAccountingData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'stats':
      maintenance.getMaintenanceStats()
        .then(stats => {
          console.log('\n📊 Database Statistics\n');
          console.log('=================================');
          console.log(`Total Transactions: ${stats.totalTransactions}`);
          console.log(`Completed: ${stats.completedTransactions}`);
          console.log(`Pending: ${stats.pendingTransactions}`);
          console.log(`Failed: ${stats.failedTransactions}`);
          console.log(`\nOldest Transaction: ${stats.oldestTransaction || 'N/A'}`);
          console.log(`Newest Transaction: ${stats.newestTransaction || 'N/A'}`);
          console.log(`\nFailed (>30 days old): ${stats.failedOlderThan30Days}`);
          console.log(`Transactions (>1 year old): ${stats.transactionsOlderThan1Year}`);
          console.log(`\nTotal Revenue: KSh ${stats.totalRevenue.toFixed(2)}`);
          console.log(`Revenue (last 6 months): KSh ${stats.revenueLastSixMonths.toFixed(2)}`);
          console.log('=================================\n');
          process.exit(0);
        })
        .catch(() => process.exit(1));
      break;
      
    case 'full':
    default:
      maintenance.runFullMaintenance()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
  }
}
