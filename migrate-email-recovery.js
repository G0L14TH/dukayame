// ============================================
// DATABASE MIGRATION: Email Capture & Link Recovery
// Run this ONCE* to update V1.0 database
// ============================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database/mpesa_downloads.db');
const db = new sqlite3.Database(dbPath);

async function migrate() {
  console.log('🔄 Starting database migration...\n');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      
      // ============================================
      // 1. CREATE CUSTOMERS TABLE
      // ============================================
      console.log('📋 Creating customers table...');
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          phone_number TEXT,
          first_name TEXT,
          last_name TEXT,
          newsletter_opt_in INTEGER DEFAULT 0,
          total_purchases INTEGER DEFAULT 0,
          total_spent REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating customers table:', err.message);
        } else {
          console.log('✅ Customers table created\n');
        }
      });

      // ============================================
      // 2. ADD CUSTOMER_EMAIL COLUMN TO TRANSACTIONS
      // ============================================
      console.log('📋 Adding customer_email column to transactions...');
      db.run(`
        ALTER TABLE transactions 
        ADD COLUMN customer_email TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('❌ Error adding customer_email:', err.message);
        } else {
          console.log('✅ customer_email column added\n');
        }
      });

      // ============================================
      // 3. CREATE LINK_RECOVERY_REQUESTS TABLE
      // ============================================
      console.log('📋 Creating link_recovery_requests table...');
      db.run(`
        CREATE TABLE IF NOT EXISTS link_recovery_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id INTEGER NOT NULL,
          email TEXT,
          phone_number TEXT,
          recovery_token TEXT UNIQUE NOT NULL,
          ip_address TEXT,
          request_count INTEGER DEFAULT 1,
          used INTEGER DEFAULT 0,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used_at DATETIME,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating recovery table:', err.message);
        } else {
          console.log('✅ link_recovery_requests table created\n');
        }
      });

      // ============================================
      // 4. CREATE INDEXES FOR PERFORMANCE
      // ============================================
      console.log('📋 Creating database indexes...');
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_email 
        ON transactions(customer_email)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt 
        ON transactions(mpesa_receipt_number)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_phone 
        ON transactions(phone_number)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_customers_email 
        ON customers(email)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_customers_phone 
        ON customers(phone_number)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_recovery_token 
        ON link_recovery_requests(recovery_token)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_recovery_transaction 
        ON link_recovery_requests(transaction_id)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating indexes:', err.message);
        } else {
          console.log('✅ Indexes created\n');
        }
      });

      // ============================================
      // 5. CREATE RATE_LIMIT_LOG TABLE
      // ============================================
      console.log('📋 Creating rate_limit_log table...');
      db.run(`
        CREATE TABLE IF NOT EXISTS rate_limit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL,
          identifier_type TEXT NOT NULL,
          action TEXT NOT NULL,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating rate limit table:', err.message);
        } else {
          console.log('✅ rate_limit_log table created\n');
        }
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier 
        ON rate_limit_log(identifier, action, created_at)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating rate limit index:', err.message);
          reject(err);
        } else {
          console.log('✅ Rate limit index created\n');
          
          // ============================================
          // 6. VERIFY MIGRATION
          // ============================================
          console.log('🔍 Verifying migration...\n');
          
          db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) {
              console.error('❌ Verification failed:', err.message);
              reject(err);
            } else {
              console.log('📊 Database tables:');
              tables.forEach(table => {
                console.log(`  - ${table.name}`);
              });
              
              console.log('\n✅ Migration completed successfully!\n');
              console.log('Next steps:');
              console.log('1. Restart your server: npm start');
              console.log('2. Test email capture after payment');
              console.log('3. Test link recovery feature\n');
              
              resolve();
            }
          });
        }
      });
    });
  });
}

// Run migration
migrate()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    db.close();
    process.exit(1);
  });
