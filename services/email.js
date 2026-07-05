// EMAIL SERVICE - Send Download Links & Receipts

const nodemailer = require('nodemailer');

const requiredEnv = ['EMAIL_USER', 'EMAIL_PASS', 'STORE_NAME', 'SITE_URL'];

function isEmailConfigured() {
  return requiredEnv.every(key => !!process.env[key]);
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function buildDownloadUrl(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = process.env.SITE_URL.replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

function normalizeRecoveryLinks(recoveryLinks) {
  return recoveryLinks.map(link => ({
    productName: escapeHtml(link.productName || link.product || 'Purchase'),
    purchaseDate: formatDate(link.purchaseDate || link.purchase_date || new Date()),
    downloadUrl: buildDownloadUrl(link.downloadUrl || link.link || ''),
    expiresAt: formatDate(link.expiresAt || link.expires_at || new Date())
  }));
}

function buildPlainLinkList(recoveryLinks) {
  return recoveryLinks
    .map(link => `Product: ${link.productName}\nPurchased: ${link.purchaseDate}\nDownload: ${link.downloadUrl}\nExpires: ${link.expiresAt}\n`)
    .join('\n');
}

async function sendReceiptEmail(email, transaction, product, downloadToken) {
  if (!isEmailConfigured()) {
    console.error('Email not configured: missing EMAIL_USER, EMAIL_PASS, STORE_NAME, or SITE_URL');
    return { success: false, error: 'Email service is not configured' };
  }

  const downloadUrl = buildDownloadUrl(`/api/download/${downloadToken}`);
  const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const mailOptions = {
    from: `"${escapeHtml(process.env.STORE_NAME)}" <${escapeHtml(process.env.EMAIL_USER)}>`,
    to: email,
    subject: `Your Purchase Receipt - ${escapeHtml(transaction.mpesa_receipt_number || '')}`,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #45474e 0%, #503a66 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
        }
        .receipt-box {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .receipt-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        .receipt-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 1.2em;
        }
        .download-btn {
            display: inline-block;
            background: #667eea;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            color: #888;
            font-size: 0.9em;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎵 Thank You for Your Purchase!</h1>
    </div>
    
    <div class="content">
        <p>Hi there!</p>
        <p>Your payment was successful. Here are your purchase details:</p>
        
        <div class="receipt-box">
            <div class="receipt-item">
                <span>Product:</span>
                <span><strong>${escapeHtml(product?.name || 'Purchase')}</strong></span>
            </div>
            <div class="receipt-item">
                <span>Amount Paid:</span>
                <span>KSh ${escapeHtml(transaction.amount || '')}</span>
            </div>
            <div class="receipt-item">
                <span>M-Pesa Receipt:</span>
                <span><strong>${escapeHtml(transaction.mpesa_receipt_number || '')}</strong></span>
            </div>
            <div class="receipt-item">
                <span>Transaction Date:</span>
                <span>${escapeHtml(formatDate(transaction.transaction_date || new Date()))}</span>
            </div>
        </div>
        
        <div style="text-align: center;">
            <a href="${downloadUrl}" class="download-btn">
                📥 Download Your Purchase
            </a>
        </div>
        
        <div class="warning-box">
            <strong>⚠️ Important:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Download link expires on <strong>${escapeHtml(formatDate(expiryDate))}</strong> (24 hours)</li>
                <li>You can download up to <strong>3 times</strong></li>
                <li>Save the file to your device after downloading</li>
            </ul>
        </div>
        
        <p>If you have any questions or issues with your download, please reply to this email.</p>
        
        <p>Enjoy! 🎉</p>
    </div>
    
    <div class="footer">
        <p>&copy; ${escapeHtml(new Date().getFullYear())} ${escapeHtml(process.env.STORE_NAME)}</p>
        <p>This is an automated receipt. Please do not reply unless you need support.</p>
    </div>
</body>
</html>
        `,
    text: `
Thank You for Your Purchase!

Product: ${escapeHtml(product?.name || 'Purchase')}
Amount Paid: KSh ${escapeHtml(transaction.amount || '')}
M-Pesa Receipt: ${escapeHtml(transaction.mpesa_receipt_number || '')}
Transaction Date: ${escapeHtml(formatDate(transaction.transaction_date || new Date()))}

Download Your Purchase:
${downloadUrl}

Important:
- Link expires in 24 hours
- Maximum of 3 downloads
- Save the file after downloading

If you have any questions, reply to this email.

© ${escapeHtml(new Date().getFullYear())} ${escapeHtml(process.env.STORE_NAME)}
        `
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Receipt email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, error: error.message };
  }
}

// SEND RECOVERY LINKS

async function sendRecoveryEmail(email, recoveryLinks) {
  if (!isEmailConfigured()) {
    console.error('Email not configured: missing EMAIL_USER, EMAIL_PASS, STORE_NAME, or SITE_URL');
    return { success: false, error: 'Email service is not configured' };
  }

  const normalizedLinks = normalizeRecoveryLinks(recoveryLinks);
  const linksHtml = normalizedLinks.map(link => `
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0;">📦 ${link.productName}</h3>
            <p style="margin: 5px 0; color: #666;">
                Purchased: ${link.purchaseDate}
            </p>
            <a href="${link.downloadUrl}" 
               style="display: inline-block; background: #667eea; color: white; 
                      padding: 12px 30px; text-decoration: none; border-radius: 6px; 
                      font-weight: bold; margin-top: 10px;">
                Download Now
            </a>
            <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #888;">
                Expires: ${link.expiresAt}
            </p>
        </div>
    `).join('');

  const mailOptions = {
    from: `"${escapeHtml(process.env.STORE_NAME)}" <${escapeHtml(process.env.EMAIL_USER)}>`,
    to: email,
    subject: 'Your Download Link Recovery',
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
        }
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 Your Download Links</h1>
    </div>
    
    <div class="content">
        <p>Hi there! 👋</p>
        <p>We found ${normalizedLinks.length} purchase(s) associated with your email. Here are your recovery links:</p>
        
        ${linksHtml}
        
        <div class="warning-box">
            <strong>⚠️ Important Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>These recovery links expire in <strong>2 hours</strong></li>
                <li>Each link is <strong>single-use only</strong> (expires after first download)</li>
                <li>Download immediately and save to your device</li>
                <li>If you didn't request this, please ignore this email</li>
            </ul>
        </div>
        
        <p>Need help? Reply to this email and we'll assist you.</p>
    </div>
    
    <div style="text-align: center; color: #888; font-size: 0.9em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p>&copy; ${escapeHtml(new Date().getFullYear())} ${escapeHtml(process.env.STORE_NAME)}</p>
    </div>
</body>
</html>
        `
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Recovery email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Recovery email send failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendReceiptEmail,
  sendRecoveryEmail
};