# DUKAYAME (v1.0)

DUKAYAME is a lightweight Node.js storefront for selling digital downloads with M-Pesa payments. It combines a simple public storefront, secure payment handling, and download delivery for customers who purchase products from the store.

![M-Pesa](https://img.shields.io/badge/payment-M--Pesa-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## What the project does

- Displays digital products from a local SQLite database
- Starts M-Pesa STK Push payments for customer purchases
- Tracks transactions and updates payment status after callbacks
- Issues secure download links for completed purchases
- Sends purchase receipts and recovery emails
- Provides a simple recovery flow when customers lose their download links

## Tech stack

- Node.js + Express
- SQLite for product and transaction storage
- M-Pesa Daraja API for mobile payments
- Nodemailer for email delivery
- QR code generation support

## Project structure

- [server.js](server.js) — Starts the Express server and mounts all API routes
- [routes/](routes/) — Product, payment, download, transaction, and recovery endpoints
- [database/](database/) — SQLite initialization and maintenance helpers
- [services/](services/) — M-Pesa and email integrations
- [public/](public/) — Frontend storefront and payment UI
- [downloads/](downloads/) — Product files that customers can download
- [scripts/](scripts/) — Helper deployment and upload scripts

## Requirements

- Node.js 16+ (18+ recommended)
- npm
- A Safaricom Daraja developer account for M-Pesa
- Optional: SMTP/Gmail credentials for email receipts and recovery links

## Installation

```bash
git clone <your-repo-url>
cd dukayame
npm install
cp .env.example .env
```

Edit the new [.env](.env.example) file and fill in the required values.

## Environment configuration

The app expects the following variables in your environment file:

```env
PORT=3000
NODE_ENV=development

MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=http://localhost:3000/api/payment/callback

EMAIL_USER=your_gmail_address
EMAIL_PASS=your_app_password
STORE_NAME=DUKAYAME
SITE_URL=http://localhost:3000

DOWNLOAD_TOKEN_SECRET=replace_with_a_random_string
DOWNLOAD_LINK_EXPIRY=86400000
```

## Running the app

Start the server in development mode:

```bash
npm run dev
```

Or use star cmd

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Adding products

Products are stored in the SQLite database and the storefront reads them from the API.

1. Place your downloadable files in [downloads/](downloads/).
2. Add a product record to the `products` table with the product name, price, description, and matching `file_path`.
3. Make sure the file name in `file_path` matches the file saved in [downloads/](downloads/).

The database is initialized automatically on first run, and a sample product is inserted if no products exist yet.

## API overview

The app shos the following main endpoints:

- `GET /api/products` — List active products
- `GET /api/products/:id` — Get a single product
- `POST /api/payment/initiate` — Start an M-Pesa STK Push payment
- `POST /api/payment/callback` — Handle M-Pesa callback updates
- `GET /api/payment/status/:checkoutRequestId` — Check transaction status
- `POST /api/payment/save-email` — Save customer email after payment
- `GET /api/download/:token` — Download a product using a secure token
- `POST /api/recovery/send-links` — Send recovery links to a customer email
- `GET /api/recovery/check-email/:email` — Check whether an email has previous purchases

## Maintenance scripts

The project includes maintenance helpers for database-related tasks:

```bash
npm run maintenance
npm run maintenance:export
npm run maintenance:archive
npm run maintenance:cleanup
npm run maintenance:stats
```

## Download behavior

- In-browser download links are valid for up to 3 downloads and 24 hours.
- Recovery email links are single-use and expire after a short window.
- Files must exist in [downloads/](downloads/) or downloads will fail.

## Troubleshooting

- Make sure [.env](.env.example) exists and contains valid M-Pesa credentials.
- Check your callback URL if the payment status never updates.
- If downloads fail, confirm the requested file is present in [downloads/](downloads/).
- Review the terminal output if the server does not start or the payment flow fails.

## License

This project is licensed under the All Rights Reserved License. Developed by mortalman, maintained by INTASOL

