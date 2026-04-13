const QRCode = require('qrcode');

// Generate QR code for your website
async function generateQR() {
  const url = 'https://yourstore.com'; // Change when you have domain
  
  try {
    // Generate and save as image
    await QRCode.toFile('qr-code.png', url, {
      width: 500,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('✅ QR code saved as qr-code.png');
    
    // Also generate for terminal (preview)
    const qrTerminal = await QRCode.toString(url, { type: 'terminal' });
    console.log('\nPreview:');
    console.log(qrTerminal);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

generateQR();
