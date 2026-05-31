const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const crypto = require('crypto');

const MAX_BROWSER_DOWNLOADS = 3;
const LINK_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// secure download endpoint
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Check if token is a download_token (email link - 1 click only)
    const emailToken = await db.get(`
      SELECT dt.id, dt.transaction_id, dt.click_count, dt.expires_at,
             t.id as trans_id, t.status, t.product_id,
             p.file_path, p.name as product_name
      FROM download_tokens dt
      JOIN transactions t ON dt.transaction_id = t.id
      JOIN products p ON t.product_id = p.id
      WHERE dt.token = ?
    `, [token]);

    if (emailToken) {
      // EMAIL TOKEN FLOW: 1 click only
      return handleEmailToken(res, emailToken);
    }

    // Check if token is in-browser legacy token (max 3 downloads)
    const inBrowserToken = await db.get(`
      SELECT t.id, t.download_token, t.download_count, t.status, 
             t.product_id, t.created_at,
             p.file_path, p.name as product_name
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      WHERE t.download_token = ? AND t.status = 'completed'
    `, [token]);

    if (inBrowserToken) {
      // IN-BROWSER TOKEN FLOW: max 3 downloads
      return handleInBrowserToken(res, inBrowserToken);
    }

    // Neither token found
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired download link'
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download'
    });
  }
});

/**
 * EMAIL TOKEN: Expires after 1 click or 24 hours
 */
async function handleEmailToken(res, emailToken) {
  try {
    // Check if already clicked
    if (emailToken.click_count > 0) {
      return res.status(410).json({
        success: false,
        message: '❌ This link has already been used (single-use). Request a new one via email recovery.'
      });
    }

    // Check if expired (24 hours)
    if (new Date() > new Date(emailToken.expires_at)) {
      return res.status(410).json({
        success: false,
        message: '⏰ Download link expired. Request a new one via email recovery.'
      });
    }

    // Get file
    const filePath = path.join(__dirname, '..', 'downloads', emailToken.file_path);
    
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Mark as clicked (sets click_count = 1)
    await db.run(
      'UPDATE download_tokens SET click_count = click_count + 1, clicked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [emailToken.id]
    );

    console.log(`📧 Email token downloaded: ${emailToken.product_name} (1-click, expires)`);

    // Send file
    res.download(filePath, emailToken.file_path, (err) => {
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
    console.error('Email token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download'
    });
  }
}

/**
 * IN-BROWSER TOKEN: Expires after 3 downloads or 24 hours
 */
async function handleInBrowserToken(res, inBrowserToken) {
  try {
    // Check download limit (max 3)
    if (inBrowserToken.download_count >= MAX_BROWSER_DOWNLOADS) {
      return res.status(403).json({
        success: false,
        message: `❌ Download limit exceeded (${MAX_BROWSER_DOWNLOADS} max). Use email recovery to re-download.`,
        downloadsRemaining: 0
      });
    }

    // Check if link expired (24 hours)
    const createdTime = new Date(inBrowserToken.created_at).getTime();
    const currentTime = new Date().getTime();
    const elapsed = currentTime - createdTime;

    if (elapsed > LINK_EXPIRY_MS) {
      return res.status(403).json({
        success: false,
        message: '⏰ Download link expired (24 hours). Use email recovery for new link.'
      });
    }

    // Get file
    const filePath = path.join(__dirname, '..', 'downloads', inBrowserToken.file_path);
    
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Increment download count
    const newCount = inBrowserToken.download_count + 1;
    await db.run(
      'UPDATE transactions SET download_count = ? WHERE id = ?',
      [newCount, inBrowserToken.id]
    );

    const downloadsRemaining = MAX_BROWSER_DOWNLOADS - newCount;
    console.log(`🌐 In-browser download: ${inBrowserToken.product_name} (${newCount}/${MAX_BROWSER_DOWNLOADS} used, ${downloadsRemaining} remaining)`);

    // Send file with custom headers
    res.setHeader('X-Downloads-Remaining', downloadsRemaining);
    res.download(filePath, inBrowserToken.file_path, (err) => {
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
    console.error('In-browser token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download'
    });
  }
}

module.exports = router;
