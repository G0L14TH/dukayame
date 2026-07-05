# 🎵 DUKAYAME V1.0* digital store w/M-PESA payment


A clean, minimal platform for selling digital products (music, files) with M-Pesa payment integration.

![M-Pesa](https://img.shields.io/badge/payment-M--Pesa-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)

---

## ✨ Features

- 🎵 **Digital Downloads** - Sell music, albums, files
- 📱 **M-Pesa Payments** - Seamless Kenyan mobile money
- 🌓 **Dark/Light Mode** - Auto theme switching
- 🔐 **Secure Downloads** - Token-based with 24hr expiry
- 📊 **Sales Tracking** - View transactions and revenue
- 🎨 **Minimal Design** - Clean, centered, responsive
- 🌀 **Animated Background** - Subtle wobbling gradients
- ⚡ **Fast & Simple** - No bloat, just what you need

---

## Quick Start

### Prerequisites

- Node.js 16 or higher
- M-Pesa Developer Account (sandbox or production)
- Your digital products (ZIP files)

### Installation

```bash
# 1. Clone the repository
git clone [https://github.com/G0L147H/dukayame.git](https://github.com/G0L14TH/dukayame)
cd dukayame

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
nano .env  # Add your M-Pesa credentials

# 4. Start the server
npm start

# 5. Open in browser
http://dukayame.com^
```

---

## Configuration

### Get M-Pesa Credentials

**For Testing (Sandbox):**
1. Go to https://developer.safaricom.co.ke
2. Create an account
3. Create a new app
4. Copy your credentials

**Test Credentials:**
- Phone: `254708374149`
- PIN: `174379`

**For Production (Real Money):**
1. Apply for PayBill or Till Number at Safaricom
2. Get production credentials from Daraja Portal
3. Link your bank account

### Environment Variables (`.env`)

```env
# M-Pesa Sandbox (Testing)
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=http://localhost:3000/api/payment/callback

# Security
DOWNLOAD_TOKEN_SECRET=random_64_character_string
DOWNLOAD_LINK_EXPIRY=86400000
```

---

## 📦 Adding Products

### Method 1: Using the Script (Easiest)

```bash
# Edit add-product.js with your product details
nano add-product.js

# Run it
node add-product.js
```

### Method 2: Direct SQL

```bash
sqlite3 database/mpesa_downloads.db

INSERT INTO products (name, description, price, file_path, file_size)
VALUES ('Summer Album', '20 tracks + lyrics', 800, 'summer-album.zip', '150 MB');

.exit
```

### Adding Product Files

```bash
# 1. Create your ZIP file (music + lyrics + artwork)
# 2. Copy to downloads folder
cp your-album.zip downloads/

# 3. Reference in database
# file_path should match the ZIP filename
```

---

## 📊 Checking Sales

```bash
# View all sales
node check-sales.js

# View database directly
sqlite3 database/mpesa_downloads.db
SELECT * FROM transactions WHERE status='completed';
.exit
```

## 🛠️ Project Structure

mpesa-download-site/
├── database/
│   ├── db.js              # Database setup
│   └── dukayame.db        # SQLite database (created on first run)
    └── maintenance.js     # Maintenance database
├── downloads/             # Your product ZIP files
├── public/
│   ├── css/style.css      # Styles with dark mode
│   ├── js/main.js         # Frontend logic
│   └── index.html         # Main page
    └── qr.html            # QR code for store
├── routes/
│   ├── download.js       # Secure downloads
│   ├── payment.js        # M-Pesa integration
|   ├── products.js       # Product API
│   └── recovery.js       # Secure recovery downloads
    ├── transaction.js    # Transactions
├── services/
│   └── mpesa.js          # M-Pesa API wrapper
    ├── email.js          # email services (send downloadlinks and receipts)
    ├── logger.js         # logs of all activities in the system
├── scripts/
│   └── pre-upload-check.sh  # check the files to be uploaded
    ├── setup-cron.sh
    ├── upload-product.sh #script to upload products
├── add-product.js        # Script to add products
├── check-sales.js        # Script to view overall sales
├── daily-sales.js        # script to view daily sales
├── server.js             # Express server
├── migrate-email-recovery.js # migrate emails
└── package.json          # Dependencies
└── generate-qr.js        # Generates QR code


## 🎨 Features in Detail

### Dark Mode
- Automatically detects system theme preference
- Manual toggle button (top-right corner)
- Smooth transitions between themes
- Preference saved in browser

### Wobbling Background
- Subtle animated color gradients
- Adapts colors to dark/light theme
- GPU-accelerated (no performance impact)
- Adds modern, premium feel

### Secure Downloads
- Each purchase gets unique download token
- Token expires after 24 hours
- Maximum 3 downloads per purchase
- Prevents unauthorized sharing

---

## 🐛 Troubleshooting

### "Wrong credentials" error
- Check your M-Pesa keys in `.env`
- Make sure no extra spaces
- Restart server: `npm start`

### Callback not received
- In sandbox: callback might be delayed
- Check server logs: `pm2 logs mystore`
- Verify callback URL matches `.env`

### Download link not working
- Check file exists in `downloads/` folder
- Verify token hasn't expired (24hrs)
- Check download count (max 3)

### Server won't start
- Check if port 3000 is already in use
- Run: `killall node` then `npm start`
- Check `.env` file exists

---

## 📈 Roadmap

### Version 1.0 (Current)
- ✅ Digital product sales
- ✅ M-Pesa payments
- ✅ Dark/light mode
- ✅ Secure downloads

### Version 2.0 (Planned)
- 🎫 Event ticket sales with QR codes
- 💝 Pay What You Want pricing
- 💳 Card payments (Stripe)
- 🌍 Multi-currency support
- 👕 Physical product sales
- 🛒 Shopping cart

---

## License

MIT License - Free to use for personal and commercial projects

---

## Support

- 📧 Email: nisaidie@dukayame.com
- 🐛 Issues: [GitHub Issues](https://github.com/G0L14TH/repo/issues)

---

## Credits

Built with:
- [Node.js](https://nodejs.org) - Server runtime
- [Express](https://expressjs.com) - Web framework
- [SQLite](https://www.sqlite.org) - Database
- [Safaricom Daraja API](https://developer.safaricom.co.ke) - M-Pesa integration

---

**Built by mortalman, maintained by INTASOL**
