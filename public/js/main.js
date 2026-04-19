function getInitialTheme() {
    // Check if user has saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        return savedTheme;
    }
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    
    // Default to light
    return 'light';
}

// Apply theme
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update SVG icon
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    
    if (theme === 'dark') {
        // Show Sun icon (to switch back to light)
        icon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
        label.textContent = 'Light';
    } else {
        // Show Moon icon (to switch to dark)
        icon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
        label.textContent = 'Dark';
    }
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);
    
    // add click event to toggle button
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleTheme);
    }
    
    
    updateCopyrightYear();
    
    // Rest of your existing code
    loadProducts();
    setupModalEvents();
});

// auto-update copyright year
function updateCopyrightYear() {
    const footer = document.querySelector('footer p');
    if (footer) {
        const currentYear = new Date().getFullYear();
        footer.innerHTML = `&copy; ${currentYear} DARK RUUM STUDIOS. All rights reserved.`;
    }
}

updateCopyrightYear();


let currentProduct = null;
let checkoutRequestId = null;
let statusCheckInterval = null;

// initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupModalEvents();
});

// loading  products from API
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const data = await response.json();
        
        if (data.success) {
            displayProducts(data.products);
        } else {
            showError('Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please refresh the page.');
    }
}

// display products in grid
function displayProducts(products) {
    const mainContent = document.getElementById('main-content');
    
    if (products.length === 0) {
        mainContent.innerHTML = '<p style="text-align: center; color: #999;">No products available at the moment.</p>';
        return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'products-grid';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h2>${escapeHtml(product.name)}</h2>
            <p>${escapeHtml(product.description)}</p>
            <div class="product-meta">
                <span class="file-size">📦 ${escapeHtml(product.file_size)}</span>
                <span class="price">KSh ${product.price}</span>
            </div>
            <button class="btn btn-primary" onclick="openPaymentModal(${product.id}, '${escapeHtml(product.name)}', ${product.price})">
                Buy Now
            </button>
        `;
        grid.appendChild(card);
    });
    
    mainContent.innerHTML = '';
    mainContent.appendChild(grid);
}

// open payment modal
function openPaymentModal(productId, productName, price) {
    currentProduct = { id: productId, name: productName, price: price };
    
    document.getElementById('modal-product-name').textContent = productName;
    document.getElementById('modal-product-price').textContent = price;
    document.getElementById('phone-number').value = '';
    
    // reset modal state
    document.getElementById('payment-form').style.display = 'block';
    document.getElementById('payment-status').style.display = 'none';
    
    document.getElementById('payment-modal').style.display = 'block';
}

// setup modal events
function setupModalEvents() {
    const modal = document.getElementById('payment-modal');
    const closeBtn = document.querySelector('.close');
    const form = document.getElementById('mpesa-form');
    
    // close modal
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        clearStatusCheck();
    };
    
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
            clearStatusCheck();
        }
    };
    
    // handle form submissions
    form.onsubmit = async (e) => {
        e.preventDefault();
        await initiatePayment();
    };
}

// initiate M-Pesa payment
async function initiatePayment() {
    const phoneNumber = document.getElementById('phone-number').value.trim();
    const payBtn = document.getElementById('pay-btn');
    
    // phone number validation
    const phoneRegex = /^(?:254|\+254|0)?([17]\d{8})$/;
    if (!phoneRegex.test(phoneNumber)) {
        alert('Tafadhali enter a valid M-Pesa phone number (e.g., 0712345678)');
        return;
    }
    
    // disable button and show loading
    payBtn.disabled = true;
    payBtn.innerHTML = '<div class="spinner"></div> Processing...';
    
    try {
        const response = await fetch('/api/payment/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: currentProduct.id,
                phoneNumber: phoneNumber
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            checkoutRequestId = data.checkoutRequestId;
            showPaymentPending();
            startStatusCheck();
        } else {
            alert(data.message || 'Payment failed. Jaribu tena.');
            payBtn.disabled = false;
            payBtn.textContent = 'Pay with M-Pesa';
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
        payBtn.disabled = false;
        payBtn.textContent = 'Pay with M-Pesa';
    }
}

// show payment pending status
function showPaymentPending() {
    document.getElementById('payment-form').style.display = 'none';
    const statusDiv = document.getElementById('payment-status');
    statusDiv.style.display = 'block';
    
    document.getElementById('status-icon').className = 'status-icon pending';
    document.getElementById('status-title').textContent = 'Payment Pending';
    document.getElementById('status-message').textContent = 'Please check your phone and enter your M-Pesa PIN to complete the payment.';
    document.getElementById('download-section').style.display = 'none';
}

// start checking payment status
function startStatusCheck() {
    statusCheckInterval = setInterval(checkPaymentStatus, 3000); // Check every 3 seconds
}

// clear status check interval
function clearStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// check payment status
async function checkPaymentStatus() {
    if (!checkoutRequestId) return;
    
    try {
        const response = await fetch(`/api/payment/status/${checkoutRequestId}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.status === 'completed') {
                clearStatusCheck();
                showPaymentSuccess(data.downloadToken, data.receiptNumber);
            } else if (data.status === 'failed') {
                clearStatusCheck();
                showPaymentFailed();
            }
            // if pending, keep checking
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

// show payment success
function showPaymentSuccess(downloadToken, receiptNumber) {
    const statusDiv = document.getElementById('payment-status');
    
    document.getElementById('status-icon').className = 'status-icon success';
    document.getElementById('status-title').textContent = 'Payment Successful!';
    document.getElementById('status-message').innerHTML = `
        Your payment has been confirmed.<br>
        <strong>Receipt: ${escapeHtml(receiptNumber)}</strong>
    `;
    
    const downloadSection = document.getElementById('download-section');
    const downloadLink = document.getElementById('download-link');
    downloadLink.href = `/api/download/${downloadToken}`;
    downloadSection.style.display = 'block';
}
// show payment failed
function showPaymentFailed() {
    document.getElementById('status-icon').className = 'status-icon error';
    document.getElementById('status-title').textContent = 'Payment Failed';
    document.getElementById('status-message').textContent = 'The payment was not completed. Please try again.';
    document.getElementById('download-section').style.display = 'none';
    
    // re-enable form after 3 seconds
    setTimeout(() => {
        document.getElementById('payment-form').style.display = 'block';
        document.getElementById('payment-status').style.display = 'none';
        document.getElementById('pay-btn').disabled = false;
        document.getElementById('pay-btn').textContent = 'Pay with M-Pesa';
    }, 3000);
}

// show error message
function showError(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #dc3545;">
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

//modified payment success handler 
async function checkPaymentStatus(checkoutRequestId) {
    const statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/payment/status/${checkoutRequestId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                // Show email capture instead of direct download
                showEmailCapture(data.mpesaReceipt, data.downloadToken);
            } else if (data.status === 'failed') {
                clearInterval(statusCheckInterval);
                showError(data.message || 'Payment failed');
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000); // Check every 2 seconds
}

function showEmailCapture(mpesaReceipt, downloadToken) {
    const statusDiv = document.getElementById('payment-status');
    statusDiv.style.display = 'block';
    
    statusDiv.innerHTML = `
        <div class="status-icon success"></div>
        <h3 id="status-title">✅ Payment Successful!</h3>
        <p id="status-message">Receipt: ${mpesaReceipt}</p>
        
        <div class="email-capture-section">
            <h4>Get Your Receipt & Updates</h4>
            <p class="capture-description">
                Enter your email to receive your purchase confirmation and future updates
            </p>
            
            <div class="form-group">
                <input type="email" 
                       id="customer-email" 
                       class="email-input"
                       placeholder="your@email.com"
                       autocomplete="email">
                <span class="input-error" id="email-error"></span>
            </div>
            
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="newsletter-opt-in" checked>
                    <span>Send me exclusive offers and new releases</span>
                </label>
            </div>
            
            <button class="btn btn-primary" 
                    onclick="submitEmail('${mpesaReceipt}', '${downloadToken}')">
                Continue to Download
            </button>
            
            <button class="btn btn-secondary" 
                    onclick="skipEmailCapture('${downloadToken}')">
                Skip for now
            </button>
        </div>
    `;
    
    // Focus email input
    setTimeout(() => {
        document.getElementById('customer-email')?.focus();
    }, 300);
}

async function submitEmail(mpesaReceipt, downloadToken) {
    const emailInput = document.getElementById('customer-email');
    const newsletterCheckbox = document.getElementById('newsletter-opt-in');
    const errorSpan = document.getElementById('email-error');
    
    const email = emailInput.value.trim();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorSpan.textContent = 'Please enter a valid email address';
        errorSpan.style.display = 'block';
        emailInput.focus();
        return;
    }
    
    // Clear error
    errorSpan.style.display = 'none';
    
    // Disable button during submission
    const submitBtn = event.target;
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/transaction/link-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mpesaReceiptNumber: mpesaReceipt,
                email: email,
                newsletter: newsletterCheckbox.checked
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showDownloadLink(downloadToken, email);
        } else {
            errorSpan.textContent = data.message || 'Failed to save email';
            errorSpan.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (error) {
        console.error('Email submission error:', error);
        errorSpan.textContent = 'Network error. You can still download.';
        errorSpan.style.display = 'block';
        
        // Allow download anyway after 3 seconds
        setTimeout(() => {
            skipEmailCapture(downloadToken);
        }, 3000);
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function skipEmailCapture(downloadToken) {
    showDownloadLink(downloadToken, null);
}

function showDownloadLink(downloadToken, email) {
    const statusDiv = document.getElementById('payment-status');
    
    statusDiv.innerHTML = `
        <div class="status-icon success"></div>
        <h3 id="status-title">✅ Ready to Download!</h3>
        ${email ? `<p id="status-message">Receipt sent to: <strong>${email}</strong></p>` : ''}
        
        <div id="download-section">
            <a href="/api/download/${downloadToken}" 
               class="btn btn-success"
               download>
                📥 Download Now
            </a>
            <p class="download-info">
                ⏰ Link expires in 24 hours<br>
                📊 Maximum 3 downloads<br>
                💾 Save the file to your device
            </p>
        </div>
    `;
}

// ============================================
// LINK RECOVERY FEATURE
// ============================================

// Toggle recovery form
function toggleRecoveryForm() {
    const widget = document.getElementById('recovery-widget');
    const form = document.getElementById('recovery-form');
    
    if (form.style.display === 'none' || !form.style.display) {
        form.style.display = 'block';
        widget.classList.add('expanded');
    } else {
        form.style.display = 'none';
        widget.classList.remove('expanded');
    }
}

// Close recovery widget
function closeRecoveryWidget() {
    const widget = document.getElementById('recovery-widget');
    const form = document.getElementById('recovery-form');
    form.style.display = 'none';
    widget.classList.remove('expanded');
}

// Submit recovery request
async function submitRecoveryRequest(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('recovery-email');
    const resultDiv = document.getElementById('recovery-result');
    const submitBtn = document.getElementById('recovery-submit-btn');
    
    const email = emailInput.value.trim();
    
    // Validate email is required
    if (!email) {
        showRecoveryResult('error', 'Please enter your email address');
        emailInput.focus();
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showRecoveryResult('error', 'Invalid email format');
        emailInput.focus();
        return;
    }
    
    // Disable form during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';
    emailInput.disabled = true;
    
    try {
        const response = await fetch('/api/transaction/recover-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showRecoveryResult('success', 
                `✅ Recovery link sent! Found ${data.purchaseCount} purchase(s). ` +
                `Check your email for download link(s). Link expires in ${data.expiresIn}.`
            );
            
            // Clear form after success
            setTimeout(() => {
                emailInput.value = '';
                closeRecoveryWidget();
            }, 5000);
        } else {
            showRecoveryResult('error', data.message);
            
            // Re-enable form
            submitBtn.disabled = false;
            submitBtn.textContent = 'Recover Link';
            emailInput.disabled = false;
        }
    } catch (error) {
        console.error('Recovery request error:', error);
        showRecoveryResult('error', 'Network error. Please try again.');
        
        // Re-enable form
        submitBtn.disabled = false;
        submitBtn.textContent = 'Recover Link';
        emailInput.disabled = false;
    }
}

function showRecoveryResult(type, message) {
    const resultDiv = document.getElementById('recovery-result');
    resultDiv.className = `recovery-result ${type}`;
    resultDiv.textContent = message;
    resultDiv.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 10000);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for global access
window.submitEmail = submitEmail;
window.skipEmailCapture = skipEmailCapture;
window.toggleRecoveryForm = toggleRecoveryForm;
window.closeRecoveryWidget = closeRecoveryWidget;
window.submitRecoveryRequest = submitRecoveryRequest;
