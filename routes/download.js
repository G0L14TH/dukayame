const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

// secure download endpoint
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find transaction by download token
    const transaction = await db.get(`
      SELECT t.*, p.file_path, p.name as product_name
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      WHERE t.download_token = ? AND t.status = 'completed'
    `, [token]);

    if (!transaction) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired download link'
      });
    }

    // check if download limit exceeded (optional: limit to 3 downloads)
    const maxDownloads = 3;
    if (transaction.download_count >= maxDownloads) {
      return res.status(403).json({
        success: false,
        message: `Download limit exceeded. Maximum ${maxDownloads} downloads allowed.`
      });
    }

    // check if link expired (24 hours)
    const linkExpiry = parseInt(process.env.DOWNLOAD_LINK_EXPIRY) || 86400000; // 24 hours
    const transactionTime = new Date(transaction.updated_at).getTime();
    const currentTime = new Date().getTime();

    if (currentTime - transactionTime > linkExpiry) {
      return res.status(403).json({
        success: false,
        message: 'Download link has expired'
      });
    }

    // construct file path
    const filePath = path.join(__dirname, '..', 'downloads', transaction.file_path);

    // check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // increment download count
    await db.run(
      'UPDATE transactions SET download_count = download_count + 1 WHERE id = ?',
      [transaction.id]
    );

    // send file
    res.download(filePath, transaction.file_path, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading file'
          });
        }
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download'
    });
  }
});

module.exports = router;
