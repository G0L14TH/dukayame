const express = require('express');
const router = express.Router();
const db = require('../database/db');
const crypto = require('crypto');
const mpesa = require('../services/mpesa');
const { sendReceiptEmail } = require('../services/email');

router.post('/initiate', async (req, res) => {
  try {
    const { productId, phoneNumber } = req.body;

    // Validate input
    if (!productId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and phone number are required'
      });
    }

    // Validate and normalize phone number
    let normalizedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    
    // Handle different formats
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '254' + normalizedPhone.substring(1);
    } else if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }

    // Validate Kenyan number format
    const phoneRegex = /^254[17]\d{8}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Use format: 07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX'
      });
    }

    // Get product details
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

    // Validate amount
    if (product.price <= 0 || product.price > 150000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product price'
      });
    }

    // Initiate M-Pesa STK push
    const stkResponse = await mpesa.initiateSTKPush(
      normalizedPhone,
      product.price,
      `ORDER-${productId}`,
      `Payment for ${product.name}`
    );

    if (!stkResponse || !stkResponse.CheckoutRequestID) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate M-Pesa payment'
      });
    }

    // Store transaction in database
    const result = await db.run(`
      INSERT INTO transactions 
      (product_id, merchant_request_id, checkout_request_id, phone_number, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      productId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      normalizedPhone,
      product.price,
      'pending'
    ]);

    console.log('Payment initiated:', {
      transactionId: result.id,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      amount: product.price,
      phone: normalizedPhone
    });

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

// m-pesa call back handler
router.post('/callback', async (req, res) => {
  try {
    console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));

    // Extract callback body
    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      console.error('Invalid callback format: missing Body or stkCallback');
      return res.json({ 
        ResultCode: 1, 
        ResultDesc: 'Invalid callback format' 
      });
    }

    const stkCallback = Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const transaction = await db.get(
      'SELECT * FROM transactions WHERE checkout_request_id = ?',
      [checkoutRequestId]
    );
    
    if (!transaction) {
      console.error('Unknown transaction (possible attack):', checkoutRequestId);
      return res.json({ 
        ResultCode: 1, 
        ResultDesc: 'Transaction not found' 
      });
    }

    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
    const callbackAmount = callbackMetadata.find(item => item.Name === 'Amount')?.Value;
    
    if (callbackAmount && callbackAmount !== transaction.amount) {
      console.error('SECURITY ALERT - Amount mismatch!', { 
        expected: transaction.amount, 
        received: callbackAmount,
        transactionId: transaction.id 
      });
      return res.json({ 
        ResultCode: 1, 
        ResultDesc: 'Amount mismatch - possible tampering detected' 
      });
    }

    const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate')?.Value;
    if (transactionDate) {
      const callbackTime = new Date(transactionDate);
      const timeDiff = Math.abs(Date.now() - callbackTime.getTime());
      
      // If callback is older than 5 minutes, reject it (replay attack)
      if (timeDiff > 5 * 60 * 1000) {
        console.error('SECURITY ALERT - Callback too old (replay attack?)', {
          timeDiff: timeDiff,
          transactionId: transaction.id
        });
        return res.json({ 
          ResultCode: 1, 
          ResultDesc: 'Callback timestamp invalid' 
        });
      }
    }

    // payment processing

    if (resultCode === 0) {
    
      const mpesaReceipt = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      
      if (!mpesaReceipt) {
        console.error('Missing M-Pesa receipt number');
        return res.json({ 
          ResultCode: 1, 
          ResultDesc: 'Missing receipt number' 
        });
      }

      // Generate secure download token
      const downloadToken = crypto.randomBytes(32).toString('hex');

      // Update transaction to completed
      await db.run(`
        UPDATE transactions 
        SET status = 'completed',
            mpesa_receipt_number = ?,
            transaction_date = CURRENT_TIMESTAMP,
            download_token = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE checkout_request_id = ?
      `, [mpesaReceipt, downloadToken, checkoutRequestId]);

      console.log('Payment completed:', {
        transactionId: transaction.id,
        receipt: mpesaReceipt,
        amount: transaction.amount
      });

    } else {
      // PAYMENT FAILED
      console.log('Payment failed:', {
        transactionId: transaction.id,
        resultCode: resultCode,
        reason: resultDesc
      });

      await db.run(`
        UPDATE transactions 
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE checkout_request_id = ?
      `, [checkoutRequestId]);
    }

    // Acknowledge successful callback processing
    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });

  } catch (error) {
    console.error('Callback processing error:', error);
    // Still acknowledge the callback to prevent retries
    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed'
    });
  }
});

// check payment status
router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID required'
      });
    }

    const transaction = await db.get(
      'SELECT id, status, download_token, mpesa_receipt_number, amount FROM transactions WHERE checkout_request_id = ?',
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
      receiptNumber: transaction.mpesa_receipt_number,
      amount: transaction.amount,
      message: transaction.status === 'completed' 
        ? 'Payment successful!' 
        : transaction.status === 'failed'
        ? 'Payment failed. Please try again.'
        : 'Payment pending...'
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// save email and link to transaction
router.post('/save-email', async (req, res) => {
  try {
    const { mpesaReceiptNumber, email, newsletter } = req.body;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();

    // Get transaction by receipt number
    const transaction = await db.get(
      'SELECT id, product_id, amount, mpesa_receipt_number, download_token FROM transactions WHERE mpesa_receipt_number = ?',
      [mpesaReceiptNumber]
    );
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Verify transaction is completed
    if (transaction.download_token === null) {
      return res.status(400).json({
        success: false,
        message: 'Payment not yet confirmed. Please wait a moment and try again.'
      });
    }

    // Get product details
    const product = await db.get(
      'SELECT id, name FROM products WHERE id = ?',
      [transaction.product_id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Create or update customer
    let customer = await db.get(
      'SELECT id FROM customers WHERE email = ?',
      [normalizedEmail]
    );
    
    let customerId;
    if (customer) {
      // Update existing customer
      await db.run(
        'UPDATE customers SET newsletter_opt_in = ?, total_purchases = total_purchases + 1, total_spent = total_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newsletter ? 1 : 0, transaction.amount, customer.id]
      );
      customerId = customer.id;
      console.log(`Customer updated: ${normalizedEmail}`);
    } else {
      // Create new customer
      const result = await db.run(
        'INSERT INTO customers (email, phone_number, newsletter_opt_in, total_purchases, total_spent) VALUES (?, NULL, ?, 1, ?)',
        [normalizedEmail, newsletter ? 1 : 0, transaction.amount]
      );
      customerId = result.id;
      console.log(`New customer created: ${normalizedEmail}`);
    }
    
    // Link email and customer to transaction
    await db.run(
      'UPDATE transactions SET customer_email = ?, customer_id = ? WHERE id = ?',
      [normalizedEmail, customerId, transaction.id]
    );
    
    // Send receipt email with download link
    try {
      const emailResult = await sendReceiptEmail(
        normalizedEmail, 
        transaction, 
        product, 
        transaction.download_token
      );

      if (!emailResult.success) {
        console.warn('Email send failed (non-critical):', emailResult.error);
        // Still return success - email optional
      } else {
        console.log(`Receipt email sent to: ${normalizedEmail}`);
      }
    } catch (emailError) {
      console.warn('⚠️ Email service error (non-critical):', emailError.message);
      // Don't fail the request if email fails
    }

    console.log(`Email linked to transaction: ${transaction.id}`);
    
    res.json({
      success: true,
      message: 'Email saved successfully. Check your inbox for the download link.',
      downloadToken: transaction.download_token
    });
    
  } catch (error) {
    console.error('Error saving email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save email. You can still download using your receipt number.'
    });
  }
});

module.exports = router;