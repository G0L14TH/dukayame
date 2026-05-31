# Code Citations

## License: unknown
https://github.com/ballonura/jwt-playground-backend/blob/053bd781ab5d5a3a8b04f6cda59df750e1eb9fa7/middlewares/authenticateJWT.js

```
Based on my comprehensive analysis of your codebase, I've identified **25+ critical security and performance issues** that need immediate attention. Here's my **prioritized fix roadmap**:

## 🚨 **CRITICAL ISSUES** (Must fix before production)

### 1. **Exposed API Credentials** ⚠️
Your `.env` file contains real M-Pesa and Gmail credentials visible in the repository. 

**Immediate Actions:**
```bash
# 1. Rotate ALL exposed credentials immediately
# 2. Remove .env from git history
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove exposed credentials"

# 3. Create .env.example with placeholders
```

---

### 2. **Missing Database Tables** 🔴
Two critical tables don't exist, causing crashes:
- `rate_limit_log` (referenced in recovery endpoint)
- `link_recovery_requests` (referenced in link recovery)

**Fix:**
```sql
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_recovery_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  recovery_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions (id)
);

CREATE INDEX idx_rate_limit ON rate_limit_log(identifier, identifier_type);
CREATE INDEX idx_recovery_token ON link_recovery_requests(recovery_token);
```

---

### 3. **M-Pesa Callback Not Authenticated** 🔴
**Vulnerability:** Attackers can fake payment callbacks and mark any transaction as paid without actual payment.

**Fix in `/routes/payment.js`:**
```javascript
router.post('/callback', async (req, res) => {
  // 1. Verify IP whitelist
  const MPESA_IPS = ['196.201.214.206', '196.201.212.76'];
  if (!MPESA_IPS.includes(req.ip)) {
    console.error('❌ Callback from unauthorized IP:', req.ip);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
  }

  // 2. Verify request signature (if M-Pesa provides)
  const signature = req.headers['x-mpesa-signature'];
  if (signature) {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.MPESA_PASSKEY)
      .update(JSON.stringify(req.body))
      .digest('base64');
    
    if (signature !== expectedSig) {
      console.error('❌ Invalid callback signature');
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid signature' });
    }
  }

  // 3. Check for idempotency (prevent duplicate processing)
  const { CheckoutRequestID } = req.body.Body.stkCallback;
  const existingCallback = await db.get(
    'SELECT * FROM payment_callbacks WHERE checkout_request_id = ?',
    [CheckoutRequestID]
  );
  
  if (existingCallback) {
    console.log('⚠️ Duplicate callback, ignoring');
    return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  // ... rest of callback processing
});
```

---

### 4. **No CSRF Protection on POST Requests** 🔴
**Vulnerability:** Attacker can trick user into triggering payment from any website.

**Fix in `server.js`:**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Add middleware to pass token to frontend
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// In payment form (add to index.html)
// <input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

---

### 5. **No User Authentication/Session Management** 🔴
**Vulnerability:** Anyone can access anyone's download link by guessing tokens.

**Implement JWT Authentication:**
```javascript
// Add to server.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Protect download endpoint
router.get('/:downloadToken', authenticateToken, async (req, res) => {
  const transaction = await db.get(
    'SELECT * FROM transactions WHERE download_token = ? AND customer_email
```


## License: unknown
https://github.com/ballonura/jwt-playground-backend/blob/053bd781ab5d5a3a8b04f6cda59df750e1eb9fa7/middlewares/authenticateJWT.js

```
Based on my comprehensive analysis of your codebase, I've identified **25+ critical security and performance issues** that need immediate attention. Here's my **prioritized fix roadmap**:

## 🚨 **CRITICAL ISSUES** (Must fix before production)

### 1. **Exposed API Credentials** ⚠️
Your `.env` file contains real M-Pesa and Gmail credentials visible in the repository. 

**Immediate Actions:**
```bash
# 1. Rotate ALL exposed credentials immediately
# 2. Remove .env from git history
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove exposed credentials"

# 3. Create .env.example with placeholders
```

---

### 2. **Missing Database Tables** 🔴
Two critical tables don't exist, causing crashes:
- `rate_limit_log` (referenced in recovery endpoint)
- `link_recovery_requests` (referenced in link recovery)

**Fix:**
```sql
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_recovery_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  recovery_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions (id)
);

CREATE INDEX idx_rate_limit ON rate_limit_log(identifier, identifier_type);
CREATE INDEX idx_recovery_token ON link_recovery_requests(recovery_token);
```

---

### 3. **M-Pesa Callback Not Authenticated** 🔴
**Vulnerability:** Attackers can fake payment callbacks and mark any transaction as paid without actual payment.

**Fix in `/routes/payment.js`:**
```javascript
router.post('/callback', async (req, res) => {
  // 1. Verify IP whitelist
  const MPESA_IPS = ['196.201.214.206', '196.201.212.76'];
  if (!MPESA_IPS.includes(req.ip)) {
    console.error('❌ Callback from unauthorized IP:', req.ip);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
  }

  // 2. Verify request signature (if M-Pesa provides)
  const signature = req.headers['x-mpesa-signature'];
  if (signature) {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.MPESA_PASSKEY)
      .update(JSON.stringify(req.body))
      .digest('base64');
    
    if (signature !== expectedSig) {
      console.error('❌ Invalid callback signature');
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid signature' });
    }
  }

  // 3. Check for idempotency (prevent duplicate processing)
  const { CheckoutRequestID } = req.body.Body.stkCallback;
  const existingCallback = await db.get(
    'SELECT * FROM payment_callbacks WHERE checkout_request_id = ?',
    [CheckoutRequestID]
  );
  
  if (existingCallback) {
    console.log('⚠️ Duplicate callback, ignoring');
    return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  // ... rest of callback processing
});
```

---

### 4. **No CSRF Protection on POST Requests** 🔴
**Vulnerability:** Attacker can trick user into triggering payment from any website.

**Fix in `server.js`:**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Add middleware to pass token to frontend
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// In payment form (add to index.html)
// <input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

---

### 5. **No User Authentication/Session Management** 🔴
**Vulnerability:** Anyone can access anyone's download link by guessing tokens.

**Implement JWT Authentication:**
```javascript
// Add to server.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Protect download endpoint
router.get('/:downloadToken', authenticateToken, async (req, res) => {
  const transaction = await db.get(
    'SELECT * FROM transactions WHERE download_token = ? AND customer_email
```


## License: unknown
https://github.com/RinesaKrasniqi/PetShop/blob/94d9846b92e8f2e82c2536dc6f6f94a6ca30e5b0/Backend/api.js

```
Based on my comprehensive analysis of your codebase, I've identified **25+ critical security and performance issues** that need immediate attention. Here's my **prioritized fix roadmap**:

## 🚨 **CRITICAL ISSUES** (Must fix before production)

### 1. **Exposed API Credentials** ⚠️
Your `.env` file contains real M-Pesa and Gmail credentials visible in the repository. 

**Immediate Actions:**
```bash
# 1. Rotate ALL exposed credentials immediately
# 2. Remove .env from git history
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove exposed credentials"

# 3. Create .env.example with placeholders
```

---

### 2. **Missing Database Tables** 🔴
Two critical tables don't exist, causing crashes:
- `rate_limit_log` (referenced in recovery endpoint)
- `link_recovery_requests` (referenced in link recovery)

**Fix:**
```sql
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_recovery_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  recovery_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions (id)
);

CREATE INDEX idx_rate_limit ON rate_limit_log(identifier, identifier_type);
CREATE INDEX idx_recovery_token ON link_recovery_requests(recovery_token);
```

---

### 3. **M-Pesa Callback Not Authenticated** 🔴
**Vulnerability:** Attackers can fake payment callbacks and mark any transaction as paid without actual payment.

**Fix in `/routes/payment.js`:**
```javascript
router.post('/callback', async (req, res) => {
  // 1. Verify IP whitelist
  const MPESA_IPS = ['196.201.214.206', '196.201.212.76'];
  if (!MPESA_IPS.includes(req.ip)) {
    console.error('❌ Callback from unauthorized IP:', req.ip);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
  }

  // 2. Verify request signature (if M-Pesa provides)
  const signature = req.headers['x-mpesa-signature'];
  if (signature) {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.MPESA_PASSKEY)
      .update(JSON.stringify(req.body))
      .digest('base64');
    
    if (signature !== expectedSig) {
      console.error('❌ Invalid callback signature');
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid signature' });
    }
  }

  // 3. Check for idempotency (prevent duplicate processing)
  const { CheckoutRequestID } = req.body.Body.stkCallback;
  const existingCallback = await db.get(
    'SELECT * FROM payment_callbacks WHERE checkout_request_id = ?',
    [CheckoutRequestID]
  );
  
  if (existingCallback) {
    console.log('⚠️ Duplicate callback, ignoring');
    return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  // ... rest of callback processing
});
```

---

### 4. **No CSRF Protection on POST Requests** 🔴
**Vulnerability:** Attacker can trick user into triggering payment from any website.

**Fix in `server.js`:**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Add middleware to pass token to frontend
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// In payment form (add to index.html)
// <input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

---

### 5. **No User Authentication/Session Management** 🔴
**Vulnerability:** Anyone can access anyone's download link by guessing tokens.

**Implement JWT Authentication:**
```javascript
// Add to server.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Protect download endpoint
router.get('/:downloadToken', authenticateToken, async (req, res) => {
  const transaction = await db.get(
    'SELECT * FROM transactions WHERE download_token = ? AND customer_email = ?',
    [req.params.downloadToken, req.user.email]
  );
  
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  // ... rest of download logic
});
```

---

### 6. **Download Token Expiry Bug** 🔴
Uses `updated_at` which resets when email is updated, extending the 24-hour window.

**Fix in database/db.js:**
```javascript
// Add this column to transactions table
db.run(`
  ALTER TABLE transactions 
  ADD COLUMN completed_at DATETIME DEFAULT NULL
`);

// In payment.js callback, set this field:
await db.run(`
  UPDATE transactions 
  SET status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      ...
  WHERE checkout_request_id = ?
`);

// In download.js, use completed_at:
const completionTime = new Date(transaction.completed_at).getTime();
const currentTime = new Date().getTime();
if (currentTime - completionTime > 86400000) { // 24 hours
  return res.status(410).json({ error: 'Link expired' });
}
```

---

## 🟠 **HIGH PRIORITY ISSUES**

### 7. **No Environment Variable Validation**
```javascript
// Add to server.js after dotenv.config()
const requiredEnvVars = [
  'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY',
  'MPESA_SHORTCODE', 'EMAIL_USER', 'EMAIL_PASS', 'SITE_URL',
  'DOWNLOAD_TOKEN_SECRET', 'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
```

---

### 8. **Overly Permissive CORS**
```javascript
// Replace in server.js
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  sameSite: 'strict'
}));
```

---

### 9. **No Request Size Limits**
```javascript
// Add to server.js
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

---

### 10. **Amount Validation Missing M-Pesa Limits**
```javascript
// In routes/payment.js
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 150
```


## License: unknown
https://github.com/RinesaKrasniqi/PetShop/blob/94d9846b92e8f2e82c2536dc6f6f94a6ca30e5b0/Backend/api.js

```
Based on my comprehensive analysis of your codebase, I've identified **25+ critical security and performance issues** that need immediate attention. Here's my **prioritized fix roadmap**:

## 🚨 **CRITICAL ISSUES** (Must fix before production)

### 1. **Exposed API Credentials** ⚠️
Your `.env` file contains real M-Pesa and Gmail credentials visible in the repository. 

**Immediate Actions:**
```bash
# 1. Rotate ALL exposed credentials immediately
# 2. Remove .env from git history
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove exposed credentials"

# 3. Create .env.example with placeholders
```

---

### 2. **Missing Database Tables** 🔴
Two critical tables don't exist, causing crashes:
- `rate_limit_log` (referenced in recovery endpoint)
- `link_recovery_requests` (referenced in link recovery)

**Fix:**
```sql
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_recovery_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  recovery_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions (id)
);

CREATE INDEX idx_rate_limit ON rate_limit_log(identifier, identifier_type);
CREATE INDEX idx_recovery_token ON link_recovery_requests(recovery_token);
```

---

### 3. **M-Pesa Callback Not Authenticated** 🔴
**Vulnerability:** Attackers can fake payment callbacks and mark any transaction as paid without actual payment.

**Fix in `/routes/payment.js`:**
```javascript
router.post('/callback', async (req, res) => {
  // 1. Verify IP whitelist
  const MPESA_IPS = ['196.201.214.206', '196.201.212.76'];
  if (!MPESA_IPS.includes(req.ip)) {
    console.error('❌ Callback from unauthorized IP:', req.ip);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
  }

  // 2. Verify request signature (if M-Pesa provides)
  const signature = req.headers['x-mpesa-signature'];
  if (signature) {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.MPESA_PASSKEY)
      .update(JSON.stringify(req.body))
      .digest('base64');
    
    if (signature !== expectedSig) {
      console.error('❌ Invalid callback signature');
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid signature' });
    }
  }

  // 3. Check for idempotency (prevent duplicate processing)
  const { CheckoutRequestID } = req.body.Body.stkCallback;
  const existingCallback = await db.get(
    'SELECT * FROM payment_callbacks WHERE checkout_request_id = ?',
    [CheckoutRequestID]
  );
  
  if (existingCallback) {
    console.log('⚠️ Duplicate callback, ignoring');
    return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  // ... rest of callback processing
});
```

---

### 4. **No CSRF Protection on POST Requests** 🔴
**Vulnerability:** Attacker can trick user into triggering payment from any website.

**Fix in `server.js`:**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Add middleware to pass token to frontend
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// In payment form (add to index.html)
// <input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

---

### 5. **No User Authentication/Session Management** 🔴
**Vulnerability:** Anyone can access anyone's download link by guessing tokens.

**Implement JWT Authentication:**
```javascript
// Add to server.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Protect download endpoint
router.get('/:downloadToken', authenticateToken, async (req, res) => {
  const transaction = await db.get(
    'SELECT * FROM transactions WHERE download_token = ? AND customer_email = ?',
    [req.params.downloadToken, req.user.email]
  );
  
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  // ... rest of download logic
});
```

---

### 6. **Download Token Expiry Bug** 🔴
Uses `updated_at` which resets when email is updated, extending the 24-hour window.

**Fix in database/db.js:**
```javascript
// Add this column to transactions table
db.run(`
  ALTER TABLE transactions 
  ADD COLUMN completed_at DATETIME DEFAULT NULL
`);

// In payment.js callback, set this field:
await db.run(`
  UPDATE transactions 
  SET status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      ...
  WHERE checkout_request_id = ?
`);

// In download.js, use completed_at:
const completionTime = new Date(transaction.completed_at).getTime();
const currentTime = new Date().getTime();
if (currentTime - completionTime > 86400000) { // 24 hours
  return res.status(410).json({ error: 'Link expired' });
}
```

---

## 🟠 **HIGH PRIORITY ISSUES**

### 7. **No Environment Variable Validation**
```javascript
// Add to server.js after dotenv.config()
const requiredEnvVars = [
  'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY',
  'MPESA_SHORTCODE', 'EMAIL_USER', 'EMAIL_PASS', 'SITE_URL',
  'DOWNLOAD_TOKEN_SECRET', 'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
```

---

### 8. **Overly Permissive CORS**
```javascript
// Replace in server.js
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  sameSite: 'strict'
}));
```

---

### 9. **No Request Size Limits**
```javascript
// Add to server.js
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

---

### 10. **Amount Validation Missing M-Pesa Limits**
```javascript
// In routes/payment.js
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 150
```

