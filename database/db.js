const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dukayame.db');
const db = new sqlite3.Database(dbPath);

// initialize database tables
const init = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {

    // products table
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          file_path TEXT NOT NULL,
          file_size TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          active INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) console.error('Error creating products table:', err);
      });

      // customers table
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          phone_number TEXT,
          first_name TEXT,
          last_name TEXT,
          newsletter_opt_in INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          merchant_request_id TEXT UNIQUE,
          checkout_request_id TEXT UNIQUE,
          phone_number TEXT NOT NULL,
          amount REAL NOT NULL,
          mpesa_receipt_number TEXT,
          transaction_date TEXT,
          status TEXT DEFAULT 'pending',
          download_token TEXT,
          download_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating transactions table:', err);
          reject(err);
        }
      });
      
      db.run(`
        ALTER TABLE transactions 
        ADD COLUMN customer_email TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate')) {
          console.error('Error adding column:', err);
        }
      });

      // indexes AFTER column exists
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_email 
        ON transactions(customer_email)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt 
        ON transactions(mpesa_receipt_number)
      `);

      // insert sample product
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (!err && row.count === 0) {
          db.run(`
            INSERT INTO products (name, description, price, file_path, file_size)
            VALUES (?, ?, ?, ?, ?)
          `, [
            'Premium Music Collection',
            'High-quality music tracks in MP3 format',
            100,
            'sample-music.zip',
            '50 MB'
          ], (err) => {
            if (err) console.error('Error inserting sample product:', err);
            else console.log('✅ Sample product created');
          });
        }
        resolve();
      });

    });
  });
};

// helper functions
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = { init, run, get, all, db };
