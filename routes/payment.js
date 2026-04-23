const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const mpesa = require('../services/mpesa');

// initiate payment
router.post('/initiate', async (req, res) => {
  try {
    const { productId, phoneNumber, email} = req.body;

    // validate input
    if (!productId || !phoneNumber || !email) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, phone number, and email are required'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address required'
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
    await db.run(`
      INSERT INTO transactions 
      (product_id, merchant_request_id, checkout_request_id, phone_number, amount, status, customer_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      productId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      phoneNumber,
      product.price,
      'pending',
      email.toLowerCase().trim()
    ]);

    await db.run(`
      INSERT INTO customers (email, phone_number)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET
      phone_number = excluded.phone_number,
      updated_at = CURRENT_TIMESTAMP
    `, [email.toLowerCase().trim(), phoneNumber]);

    res.json({
      success: true,
      message: 'Payment request sent. Please check your phone.',
      checkoutRequestId: stkResponse.CheckoutRequestID
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
      'SELECT * FROM transactions WHERE checkout_request_id = ?',
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

      // generate secure download token
      const downloadToken = crypto.randomBytes(32).toString('hex');

      // update transaction
      await db.run(`
        UPDATE transactions 
        SET status = ?, 
            mpesa_receipt_number = ?, 
            transaction_date = ?, 
            download_token = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE checkout_request_id = ?
      `, ['completed', mpesaReceipt, transactionDate, downloadToken, checkoutRequestId]);

      console.log('✅ Payment completed:', mpesaReceipt);
    } else {
      // payment failed
      await db.run(`
        UPDATE transactions 
        SET status = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE checkout_request_id = ?
      `, ['failed', checkoutRequestId]);

      console.log('❌ Payment failed:', stkCallback.ResultDesc);
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

module.exports = router;
