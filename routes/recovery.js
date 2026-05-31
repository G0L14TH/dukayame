const express = require('express');
const router = express.Router();
const db = require('../database/db');
const crypto = require('crypto');
const { sendRecoveryEmail } = require('../services/email');

/**
 * POST /api/recovery/send-links
 * User enters email → Get all their purchases → Send new download links
 */
router.post('/send-links', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // get all completed purchases for this email
    const purchases = await db.all(`
      SELECT t.id, t.mpesa_receipt_number, p.name, p.price, p.file_path
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      WHERE t.customer_email = ? AND t.status = 'completed'
      ORDER BY t.created_at DESC
    `, [email]);

    if (purchases.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No purchases found for this email'
      });
    }

    // Generate new download tokens for each purchase
    const downloadLinks = [];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    for (const purchase of purchases) {
      const token = crypto.randomBytes(32).toString('hex');

      // Insert new download token
      await db.run(
        `INSERT INTO download_tokens (transaction_id, token, expires_at, click_count) 
         VALUES (?, ?, ?, 0)`,
        [purchase.id, token, expiresAt]
      );

      downloadLinks.push({
        productName: purchase.name,
        purchaseDate: purchase.created_at,
        downloadUrl: `/api/download/${token}`,
        expiresAt: expiresAt
      });
    }

    const emailResult = await sendRecoveryEmail(email, downloadLinks);
    if (!emailResult.success) {
      console.error('Recovery email send failed:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send recovery email. Please try again later.'
      });
    }

    console.log(`✅ Generated ${downloadLinks.length} recovery links for ${email}`);

    res.json({
      success: true,
      message: 'Recovery links sent to your email',
      purchaseCount: purchases.length,
      // Remove this in production - only for testing
      links: process.env.NODE_ENV === 'development' ? downloadLinks : undefined
    });

  } catch (error) {
    console.error('Recovery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send recovery links'
    });
  }
});

/**
 * GET /api/recovery/check-email/:email
 * Check if email has purchases (for recovery form validation)
 */
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const count = await db.get(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE customer_email = ? AND status = 'completed'
    `, [email]);

    res.json({
      success: true,
      hasPurchases: count.count > 0,
      purchaseCount: count.count
    });

  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email'
    });
  }
});

module.exports = router;