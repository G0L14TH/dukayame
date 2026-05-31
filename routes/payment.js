const express = require('express');
const router = express.Router();
const db = require('../database/db');
const crypto = require('crypto');
const mpesa = require('../services/mpesa');
const { sendReceiptEmail } = require('../services/email');

// initiate payment
router.post('/initiate', async (req, res) => {
  try {
    const { productId, phoneNumber } = req.body;

    // validate input
    if (!productId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and phone number are required'
      });
    }

    // validate phone number format
    const phoneRegex = /^(?:254|\+254|0)?([17]\d{8})$/;
    if (!phoneRegex.test(phoneNumber.replace(/[\s\-]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use 07XXXXXXXX or 254XXXXXXXXX'
      });
    }

    // get product details
    const product = await db.get(
      'SELECT * FROM products WHERE id = ? AND active = 1',
      [productId]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // initiate M-Pesa STK push
    const stkResponse = await mpesa.initiateSTKPush(
      phoneNumber,
      product.price,
      `ORDER-${productId}`,
      `Payment for ${product.name}`
    );

    // store transaction in database
    const result = await db.run(`
      INSERT INTO transactions 
      (product_id, merchant_request_id, checkout_request_id, phone_number, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      productId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      phoneNumber,
      product.price,
      'pending'
    ]);

    res.json({
      success: true,
      message: 'Payment request sent. Please check your phone.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      transactionId: result.id
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate payment'
    });
  }
});

// M-Pesa callback endpoint
router.post('/callback', async (req, res) => {
  try {
    console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;
    const stkCallback = Body?.stkCallback;

    if (!stkCallback) {
      return res.status(400).json({ success: false });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    // find transaction
    const transaction = await db.get(
      'SELECT id FROM transactions WHERE checkout_request_id = ?',
      [checkoutRequestId]
    );

    if (!transaction) {
      console.error('Transaction not found:', checkoutRequestId);
      return res.status(404).json({ success: false });
    }

    if (resultCode === 0) {
      // payment successful
      const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
      const mpesaReceipt = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate')?.Value;

      // Generate secure download token for in-browser download
      const downloadToken = crypto.randomBytes(32).toString('hex');

      // update transaction
      await db.run(`
        UPDATE transactions 
        SET status = ?, 
            mpesa_receipt_number = ?, 
            transaction_date = ?, 
            download_token = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['completed', mpesaReceipt, transactionDate, downloadToken, transaction.id]);

      console.log('Payment completed:', mpesaReceipt);
    } else {
      // payment failed
      await db.run(`
        UPDATE transactions 
        SET status = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, ['failed', transaction.id]);

      console.log('Payment failed:', stkCallback.ResultDesc);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ success: false });
  }
});

// Check payment status
router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const transaction = await db.get(
      'SELECT status, download_token, mpesa_receipt_number FROM transactions WHERE checkout_request_id = ?',
      [checkoutRequestId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      status: transaction.status,
      downloadToken: transaction.download_token,
      receiptNumber: transaction.mpesa_receipt_number
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// After successful payment, user captures email and generates email download token
router.post('/save-email', async (req, res) => {
  try {
    const { mpesaReceiptNumber, email, newsletter } = req.body;
    
    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }
    
    // Get transaction by receipt number
    const transaction = await db.get(
      'SELECT id, product_id, amount, mpesa_receipt_number, transaction_date FROM transactions WHERE mpesa_receipt_number = ?',
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
    
    // Create or update customer
    const customer = await db.get(
      'SELECT id FROM customers WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    
    let customerId;
    if (customer) {
      // Update existing customer
      await db.run(
        'UPDATE customers SET newsletter_opt_in = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newsletter ? 1 : 0, customer.id]
      );
      customerId = customer.id;
    } else {
      // Create new customer
      const result = await db.run(
        'INSERT INTO customers (email, newsletter_opt_in) VALUES (?, ?)',
        [email.toLowerCase().trim(), newsletter ? 1 : 0]
      );
      customerId = result.id;
    }
    
    // Link email and customer to transaction
    await db.run(
      'UPDATE transactions SET customer_email = ?, customer_id = ? WHERE id = ?',
      [email.toLowerCase().trim(), customerId, transaction.id]
    );
    
    // Generate ONE-CLICK email download token (expires in 24 hours)
    const emailToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await db.run(
      'INSERT INTO download_tokens (transaction_id, token, expires_at, click_count) VALUES (?, ?, ?, 0)',
      [transaction.id, emailToken, expiresAt]
    );
    
    const emailResult = await sendReceiptEmail(email, transaction, product, emailToken);
    if (!emailResult.success) {
      console.error('Failed to send download email for transaction', transaction.id, emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send download email. Please try again later.'
      });
    }

    console.log(`✅ Email captured for transaction ${transaction.id}: ${email}`);
    
    res.json({
      success: true,
      message: 'Email saved successfully. Check your inbox for the download link.',
      downloadToken: emailToken
    });
    
  } catch (error) {
    console.error('Error saving email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save email'
    });
  }
});

module.exports = router;
