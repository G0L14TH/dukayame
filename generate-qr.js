const QRCode = require('qrcode');

// generate QR code for your website
async function generateQR() {
  const url = 'https://dukayame.com';
  
  try {
    // generate and save as image
    await QRCode.toFile('qr-code.png', url, {
      width: 500,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('QR code saved as qr-code.png');
    
    // also generate for terminal (preview)
    const qrTerminal = await QRCode.toString(url, { type: 'terminal' });
    console.log('\nPreview:');
    console.log(qrTerminal);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

generateQR();
