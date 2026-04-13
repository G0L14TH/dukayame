const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all active products
router.get('/', async (req, res) => {
  try {
    const products = await db.all(
      'SELECT id, name, description, price, file_size FROM products WHERE active = 1'
    );
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await db.get(
      'SELECT id, name, description, price, file_size FROM products WHERE id = ? AND active = 1',
      [req.params.id]
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    });
  }
});

module.exports = router;
