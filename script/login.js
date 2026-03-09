const BASE_URL = 'https://intersync.onrender.com';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    errorMsg.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
        const res = await axios.post(`${BASE_URL}/api/users/login`, { email, password });

        // Store token and user data
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        // Redirect to dashboard
        window.location.href = './views/dashboard.html';

    } catch (err) {
        errorMsg.textContent = err.response?.data?.message || 'Login failed. Please try again.';
        errorMsg.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
});
