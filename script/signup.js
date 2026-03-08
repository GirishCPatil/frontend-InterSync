const BASE_URL = 'https://intersync.onrender.com';

// Chip management for skills and companies
const selectedSkills = [];
const selectedCompanies = [];

function addChip(value, array, containerId) {
    if (!value || array.includes(value)) return;
    array.push(value);
    renderChips(array, containerId);
}

function removeChip(value, array, containerId) {
    const index = array.indexOf(value);
    if (index > -1) {
        array.splice(index, 1);
        renderChips(array, containerId);
    }
}

function renderChips(array, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = array.map(item =>
        `<span class="chip">${item} <span class="remove" onclick="removeChip('${item}', ${containerId === 'skillChips' ? 'selectedSkills' : 'selectedCompanies'}, '${containerId}')">&times;</span></span>`
    ).join('');
}

// Event listeners for dropdowns
document.getElementById('skillSelect').addEventListener('change', function () {
    addChip(this.value, selectedSkills, 'skillChips');
    this.value = '';
});

document.getElementById('companySelect').addEventListener('change', function () {
    addChip(this.value, selectedCompanies, 'companyChips');
    this.value = '';
});

// Form submit
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorMsg.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
        const res = await axios.post(`${BASE_URL}/api/users/signup`, {
            name,
            email,
            password,
            skills: selectedSkills,
            targetCompanies: selectedCompanies
        });

        alert('Account created successfully! Please login.');
        window.location.href = './login.html';

    } catch (err) {
        errorMsg.textContent = err.response?.data?.message || 'Signup failed. Please try again.';
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
});
