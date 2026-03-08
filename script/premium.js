const BASE_URL = 'https://intersync.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Auth check
if (!token) {
    window.location.href = '../index.html';
}

// If already premium, show badge
if (user.isPremium) {
    document.getElementById('payBtn').style.display = 'none';
    document.getElementById('alreadyPremium').style.display = 'block';
}

// Pay button
document.getElementById('payBtn').addEventListener('click', async () => {
    const btn = document.getElementById('payBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        // Step 1: Create order on backend
        const res = await axios.post(`${BASE_URL}/api/payment/create-order`, {}, {
            headers: { Authorization: token }
        });

        const { order, key_id } = res.data;

        // Step 2: Open Razorpay checkout
        const options = {
            key: key_id,
            amount: order.amount,
            currency: order.currency,
            name: 'InterSync',
            description: 'Premium Membership',
            order_id: order.id,
            handler: async function (response) {
                // Step 3: Verify payment on backend
                try {
                    const verifyRes = await axios.post(`${BASE_URL}/api/payment/verify`, {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    }, {
                        headers: { Authorization: token }
                    });

                    // Update local user data
                    user.isPremium = true;
                    localStorage.setItem('user', JSON.stringify(user));

                    // Show success
                    const statusDiv = document.getElementById('paymentStatus');
                    statusDiv.className = 'payment-status payment-success';
                    statusDiv.textContent = '✅ Payment successful! You are now a Premium member!';
                    statusDiv.style.display = 'block';
                    btn.style.display = 'none';

                } catch (verifyErr) {
                    showPaymentError('Payment verification failed. Contact support.');
                }
            },
            prefill: {
                name: user.name || '',
                email: user.email || ''
            },
            theme: {
                color: '#6c63ff'
            },
            modal: {
                ondismiss: function () {
                    btn.disabled = false;
                    btn.textContent = '🔒 Pay ₹499 & Upgrade';
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

    } catch (err) {
        showPaymentError(err.response?.data?.message || 'Failed to create order. Please try again.');
        btn.disabled = false;
        btn.textContent = '🔒 Pay ₹499 & Upgrade';
    }
});

function showPaymentError(message) {
    const statusDiv = document.getElementById('paymentStatus');
    statusDiv.className = 'payment-status payment-failure';
    statusDiv.textContent = `❌ ${message}`;
    statusDiv.style.display = 'block';
}
