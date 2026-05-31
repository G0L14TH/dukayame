const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database/db');
const crypto = require('crypto');
const { sendReceiptEmail, sendRecoveryEmail } = require('../services/email');

// LINK EMAIL TO TRANSACTION (After Payment)
router.post('/link-email', async (req, res) => {
  try {
    const { mpesaReceiptNumber, email, newsletter } = req.body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if transaction exists
    const transaction = await db.get(
      'SELECT id, product_id, download_token, amount, mpesa_receipt_number, transaction_date, phone_number FROM transactions WHERE mpesa_receipt_number = ?',
      [mpesaReceiptNumber]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const product = await db.get(
      'SELECT id, name, price FROM products WHERE id = ?',
      [transaction.product_id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for this transaction'
      });
    }

    // Check if customer exists
    let customer = await db.get(
      'SELECT * FROM customers WHERE email = ?',
      [email]
    );

    if (!customer) {
      // Create new customer
      await db.run(`
        INSERT INTO customers (
          email, 
          phone_number, 
          newsletter_opt_in,
          total_purchases,
          total_spent
        )
        VALUES (?, ?, ?, 1, ?)
      `, [
        email, 
        transaction.phone_number, 
        newsletter ? 1 : 0,
        transaction.amount
      ]);
      
      console.log('✅ New customer created:', email);
    } else {
      // Update existing customer
      const updates = [];
      const params = [];
      
      // Update newsletter preference if opted in
      if (newsletter && !customer.newsletter_opt_in) {
        updates.push('newsletter_opt_in = 1');
      }
      
      // Update purchase stats
      updates.push('total_purchases = total_purchases + 1');
      updates.push('total_spent = total_spent + ?');
      params.push(transaction.amount);
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(email);
      
      await db.run(
        `UPDATE customers SET ${updates.join(', ')} WHERE email = ?`,
        params
      );
      
      console.log('✅ Customer updated:', email);
    }

    // Link email to transaction
    await db.run(`
      UPDATE transactions 
      SET customer_email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE mpesa_receipt_number = ?
    `, [email, mpesaReceiptNumber]);

    console.log('✅ Email linked to transaction:', mpesaReceiptNumber);

    const emailResult = await sendReceiptEmail(email, transaction, product, transaction.download_token);
    const suffix = emailResult.success
      ? 'Receipt email sent.'
      : 'Email linked successfully, but receipt email was not sent.';

    res.json({
      success: true,
      message: `Email linked successfully. ${suffix}`,
      downloadToken: transaction.download_token,
      emailReceiptSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error
    });

  } catch (error) {
    console.error('❌ Error linking email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link email'
    });
  }
});

// HELPER: Check Rate Limit
async function checkRateLimit(identifier, identifierType, action, maxRequests, timeWindowMinutes) {
  const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000)
    .toISOString();

  const count = await db.get(`
    SELECT COUNT(*) as count 
    FROM rate_limit_log 
    WHERE identifier = ? 
      AND identifier_type = ?
      AND action = ? 
      AND created_at > ?
  `, [identifier, identifierType, action, cutoffTime]);

  return count.count < maxRequests;
}

async function logRateLimit(identifier, identifierType, action, ipAddress) {
  await db.run(`
    INSERT INTO rate_limit_log (identifier, identifier_type, action, ip_address)
    VALUES (?, ?, ?, ?)
  `, [identifier, identifierType, action, ipAddress]);
}

// REQUEST LINK RECOVERY
router.post('/recover-link', async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Validate email is required
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check rate limits
    const identifier = email;
    const identifierType = 'email';

    // Rate limit: 3 requests per email per day
    const canRequest = await checkRateLimit(identifier, identifierType, 'recover_link', 3, 1440);
    if (!canRequest) {
      return res.status(429).json({
        success: false,
        message: 'Too many recovery requests. Please try again tomorrow.'
      });
    }

    // Rate limit: 10 requests per IP per hour
    const canRequestIP = await checkRateLimit(ipAddress, 'ip', 'recover_link', 10, 60);
    if (!canRequestIP) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests from your network. Please try again later.'
      });
    }

    // Find matching transactions - EMAIL ONLY
    const transactions = await db.all(`
      SELECT * FROM transactions 
      WHERE status = 'completed'
        AND customer_email = ?
      ORDER BY created_at DESC 
      LIMIT 5
    `, [email]);

    if (!transactions || transactions.length === 0) {
      // Log attempt even if not found (security)
      await logRateLimit(identifier, identifierType, 'recover_link', ipAddress);
      
      return res.status(404).json({
        success: false,
        message: 'No purchases found with this email address'
      });
    }

    // Generate recovery tokens for all found transactions
    const recoveryLinks = [];

    for (const transaction of transactions) {
      // Generate new recovery token (2-hour expiry, single-use)
      const recoveryToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

      // Save recovery request
      await db.run(`
        INSERT INTO link_recovery_requests (
          transaction_id,
          email,
          phone_number,
          recovery_token,
          ip_address,
          expires_at
        )
        VALUES (?, ?, NULL, ?, ?, ?)
      `, [
        transaction.id,
        email,
        recoveryToken,
        ipAddress,
        expiresAt.toISOString()
      ]);

      // Get product info
      const product = await db.get(
        'SELECT name FROM products WHERE id = ?',
        [transaction.product_id]
      );

      recoveryLinks.push({
        productName: product.name,
        purchaseDate: transaction.created_at,
        downloadUrl: `/api/download/recovery/${recoveryToken}`,
        expiresAt: expiresAt.toISOString()
      });
    }

    // Send recovery email
    const recoveryEmailResult = await sendRecoveryEmail(email, recoveryLinks);
    if (!recoveryEmailResult.success) {
      console.error('Recovery email send failed:', recoveryEmailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send recovery email. Please try again later.'
      });
    }

    // Log rate limit
    await logRateLimit(identifier, identifierType, 'recover_link', ipAddress);

    res.json({
      success: true,
      message: 'Recovery link sent to your email. Check your inbox.',
      purchaseCount: transactions.length,
      expiresIn: '2 hours',
      emailSent: true
    });

  } catch (error) {
    console.error('❌ Error recovering link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process recovery request'
    });
  }
});

// DOWNLOAD VIA RECOVERY TOKEN
router.get('/download/recovery/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find recovery request
    const recovery = await db.get(`
      SELECT * FROM link_recovery_requests 
      WHERE recovery_token = ?
    `, [token]);

    if (!recovery) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>❌ Invalid Recovery Link</h2>
            <p>This link is not valid.</p>
            <a href="/">Return to Store</a>
          </body>
        </html>
      `);
    }

    // Check if already used
    if (recovery.used) {
      return res.status(403).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>⚠️ Link Already Used</h2>
            <p>This recovery link has already been used.</p>
            <p>Need another link? <a href="/">Request new recovery</a></p>
          </body>
        </html>
      `);
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(recovery.expires_at);
    
    if (now > expiresAt) {
      return res.status(403).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>⏰ Link Expired</h2>
            <p>This recovery link has expired (2-hour limit).</p>
            <p><a href="/">Request new recovery link</a></p>
          </body>
        </html>
      `);
    }

    // Get transaction details
    const transaction = await db.get(
      'SELECT * FROM transactions WHERE id = ?',
      [recovery.transaction_id]
    );

    if (!transaction) {
      return res.status(404).send('Transaction not found');
    }

    // Get product file path
    const product = await db.get(
      'SELECT file_path, name FROM products WHERE id = ?',
      [transaction.product_id]
    );

    if (!product || !product.file_path) {
      return res.status(404).send('Product file not found');
    }

    // Mark recovery link as used
    await db.run(`
      UPDATE link_recovery_requests 
      SET used = 1, used_at = CURRENT_TIMESTAMP
      WHERE recovery_token = ?
    `, [token]);

    // Serve the file (same as regular download)
    const filePath = path.join(__dirname, '../downloads', product.file_path);
    
    res.download(filePath, product.file_path, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Error downloading file');
      } else {
        console.log('✅ Recovery download completed:', product.name);
      }
    });

  } catch (error) {
    console.error('❌ Recovery download error:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
