// Add API base URL
const API_BASE_URL = window.location.origin;

// Check for registration success message
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
        const errorMessageElement = document.getElementById('errorMessage');
        if (errorMessageElement) {
            errorMessageElement.textContent = 'Registration successful! Please log in.';
            errorMessageElement.style.backgroundColor = '#e5ffe5';
            errorMessageElement.style.color = '#44aa44';
            errorMessageElement.style.display = 'block';
        }
    }
});

function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('errorMessage').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'flex';
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerTab').classList.add('active');
    document.getElementById('errorMessage').style.display = 'none';
}

function showForgotPassword(event) {
    event.preventDefault();
    
    // Get the email from the login form if available
    const loginEmail = document.getElementById('username').value;
    const resetEmailInput = document.getElementById('resetEmail');
    
    if (loginEmail) {
        resetEmailInput.value = loginEmail;
    }
    
    document.getElementById('forgotPasswordModal').style.display = 'block';
}

let isOTPSent = false;

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const resetMessageElement = document.getElementById('resetMessage');
    const submitButton = event.target.querySelector('.submit-btn');
    
    // Hide any previous messages
    resetMessageElement.style.display = 'none';
    
    // Get email
    const email = document.getElementById('resetEmail').value.trim();
    
    // Validate email
    if (!email) {
        resetMessageElement.textContent = 'Please enter your email address.';
        resetMessageElement.style.backgroundColor = '#ffe5e5';
        resetMessageElement.style.color = '#ff4444';
        resetMessageElement.style.display = 'block';
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        resetMessageElement.textContent = 'Please enter a valid email address.';
        resetMessageElement.style.backgroundColor = '#ffe5e5';
        resetMessageElement.style.color = '#ff4444';
        resetMessageElement.style.display = 'block';
        return;
    }
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            resetMessageElement.textContent = 'Password reset link has been sent to your email.';
            resetMessageElement.style.backgroundColor = '#e5ffe5';
            resetMessageElement.style.color = '#44aa44';
            resetMessageElement.style.display = 'block';
            
            // Close modal after 5 seconds
            setTimeout(() => {
                closeForgotPasswordModal();
            }, 5000);
        } else {
            // Show error message
            resetMessageElement.textContent = data.error || 'Failed to send reset link. Please try again.';
            resetMessageElement.style.backgroundColor = '#ffe5e5';
            resetMessageElement.style.color = '#ff4444';
            resetMessageElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Reset password error:', error);
        resetMessageElement.textContent = 'An error occurred. Please try again later.';
        resetMessageElement.style.backgroundColor = '#ffe5e5';
        resetMessageElement.style.color = '#ff4444';
        resetMessageElement.style.display = 'block';
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = '<span>Send Reset Link</span>';
    }
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
    document.getElementById('resetMessage').style.display = 'none';
    document.getElementById('resetForm').reset();
}

async function handleLogin(event) {
    event.preventDefault();
    
    const errorMessageElement = document.getElementById('errorMessage');
    const loadingElement = document.getElementById('loading');
    const submitButton = document.querySelector('#loginForm .submit-btn');
    
    // Hide any previous error messages
    errorMessageElement.style.display = 'none';
    
    // Get form values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate form fields
    if (!username || !password) {
        errorMessageElement.textContent = 'Username and password are required.';
        errorMessageElement.style.display = 'block';
        return;
    }
    
    // Show loading state
    loadingElement.style.display = 'block';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to user dashboard
            window.location.href = '/pages/user-dashboard.html';
        } else {
            // Show error message
            errorMessageElement.textContent = data.error || 'Invalid username or password.';
            errorMessageElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessageElement.textContent = 'An error occurred. Please try again later.';
        errorMessageElement.style.display = 'block';
    } finally {
        // Hide loading state
        loadingElement.style.display = 'none';
        submitButton.disabled = false;
    }
}

// Add form submission event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const resetForm = document.getElementById('resetForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (resetForm) {
        resetForm.addEventListener('submit', handleForgotPassword);
    }
    
    // Add event listeners for tab switching
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    
    if (loginTab) {
        loginTab.addEventListener('click', showLogin);
    }
    
    if (registerTab) {
        registerTab.addEventListener('click', showRegister);
    }
    
    // Add event listener for forgot password link
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', showForgotPassword);
    }
    
    // Add event listener for closing the forgot password modal
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeForgotPasswordModal);
    }
});

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
}

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const user = localStorage.getItem('user');

    // If user is logged in and trying to access login page
    if (user && currentPath === '/') {
        window.location.href = '/pages/user-dashboard.html';
    }
    
    // If user is not logged in and trying to access protected pages
    if (!user && currentPath !== '/' && currentPath !== '/index.html') {
        window.location.href = '/';
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
    });

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('forgotPasswordModal');
        if (event.target === modal) {
            closeForgotPasswordModal();
        }
    }
});

// Reset Password Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const credentialsModal = document.getElementById('credentialsModal');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const closeResetModal = resetPasswordModal.querySelector('.close');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const resetStep1 = document.getElementById('resetStep1');
    const resetStep2 = document.getElementById('resetStep2');

    // Show password reset modal when clicking the forgot password button
    forgotPasswordBtn.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        credentialsModal.style.display = 'none';
        
        if (!username) {
            alert('कृपया पहले यूजरनेम दर्ज करें');
            return;
        }

        // Pre-fill the username and show modal
        document.getElementById('resetUsername').value = username;
        resetPasswordModal.style.display = 'block';
        resetStep1.style.display = 'block';
        resetStep2.style.display = 'none';

        // Get user details to check available contact methods
        fetch(`${API_BASE_URL}/api/user/${encodeURIComponent(username)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('यूजर नहीं मिला');
                }
                return response.json();
            })
            .then(user => {
                const otpMethod = document.getElementById('otpMethod');
                const emailOption = otpMethod.querySelector('option[value="email"]');
                const mobileOption = otpMethod.querySelector('option[value="mobile"]');
                
                emailOption.disabled = !user.email;
                mobileOption.disabled = !user.mobile;
                
                if (user.email) {
                    otpMethod.value = 'email';
                } else if (user.mobile) {
                    otpMethod.value = 'mobile';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('यूजर की जानकारी प्राप्त करने में समस्या हुई');
                resetPasswordModal.style.display = 'none';
            });
    });

    // Send OTP functionality
    sendOtpBtn.addEventListener('click', async () => {
        const username = document.getElementById('resetUsername').value;
        const otpMethod = document.getElementById('otpMethod').value;

        try {
            sendOtpBtn.disabled = true;
            sendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> OTP भेजा जा रहा है...';

            const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    method: otpMethod
                })
            });

            if (!response.ok) {
                throw new Error('OTP भेजने में समस्या हुई');
            }

            alert(`OTP आपके ${otpMethod === 'email' ? 'ईमेल' : 'मोबाइल नंबर'} पर भेज दिया गया है`);
            resetStep1.style.display = 'none';
            resetStep2.style.display = 'block';

        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'OTP भेजने में समस्या हुई');
        } finally {
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = 'Send OTP';
        }
    });

    // Reset Password functionality
    resetPasswordBtn.addEventListener('click', async () => {
        const username = document.getElementById('resetUsername').value;
        const otp = document.getElementById('otpInput').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!otp || !newPassword || !confirmPassword) {
            alert('कृपया सभी फील्ड भरें');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('पासवर्ड मैच नहीं कर रहे हैं');
            return;
        }

        try {
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> पासवर्ड अपडेट हो रहा है...';

            const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    otp,
                    newPassword
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'पासवर्ड रीसेट करने में समस्या हुई');
            }

            alert('पासवर्ड सफलतापूर्वक अपडेट कर दिया गया है');
            resetPasswordModal.style.display = 'none';
            resetStep1.style.display = 'block';
            resetStep2.style.display = 'none';
            
            // Clear all fields
            document.getElementById('otpInput').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        } finally {
            resetPasswordBtn.disabled = false;
            resetPasswordBtn.innerHTML = 'Reset Password';
        }
    });

    // Close modal functionality
    closeResetModal.addEventListener('click', () => {
        resetPasswordModal.style.display = 'none';
        resetStep1.style.display = 'block';
        resetStep2.style.display = 'none';
        // Clear all fields
        document.getElementById('resetUsername').value = '';
        document.getElementById('otpInput').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === resetPasswordModal) {
            resetPasswordModal.style.display = 'none';
            resetStep1.style.display = 'block';
            resetStep2.style.display = 'none';
            // Clear all fields
            document.getElementById('resetUsername').value = '';
            document.getElementById('otpInput').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        }
    });
});

// Credentials Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const credentialsModal = document.getElementById('credentialsModal');
    const forgotCredentialsLink = document.getElementById('forgotCredentialsLink');
    const forgotUsernameBtn = document.getElementById('forgotUsernameBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotUsernameModal = document.getElementById('forgotUsernameModal');
    const verifyMethod = document.getElementById('verifyMethod');
    const emailVerifySection = document.getElementById('emailVerifySection');
    const mobileVerifySection = document.getElementById('mobileVerifySection');
    const recoverUsernameBtn = document.getElementById('recoverUsernameBtn');

    // Show credentials modal
    forgotCredentialsLink.addEventListener('click', (e) => {
        e.preventDefault();
        credentialsModal.style.display = 'block';
    });

    // Close credentials modal when clicking close button
    credentialsModal.querySelector('.close').addEventListener('click', () => {
        credentialsModal.style.display = 'none';
    });

    // Show username recovery modal
    forgotUsernameBtn.addEventListener('click', () => {
        credentialsModal.style.display = 'none';
        forgotUsernameModal.style.display = 'block';
    });

    // Show password reset modal
    forgotPasswordBtn.addEventListener('click', () => {
        credentialsModal.style.display = 'none';
        resetPasswordModal.style.display = 'block';
        resetStep1.style.display = 'block';
        resetStep2.style.display = 'none';
    });

    // Toggle verify sections based on selected method
    verifyMethod.addEventListener('change', () => {
        if (verifyMethod.value === 'email') {
            emailVerifySection.style.display = 'block';
            mobileVerifySection.style.display = 'none';
        } else {
            emailVerifySection.style.display = 'none';
            mobileVerifySection.style.display = 'block';
        }
    });

    // Close username recovery modal
    forgotUsernameModal.querySelector('.close').addEventListener('click', () => {
        forgotUsernameModal.style.display = 'none';
        // Reset form
        document.getElementById('verifyEmail').value = '';
        document.getElementById('verifyMobile').value = '';
        verifyMethod.value = 'email';
        emailVerifySection.style.display = 'block';
        mobileVerifySection.style.display = 'none';
    });

    // Recover username functionality
    recoverUsernameBtn.addEventListener('click', async () => {
        const method = verifyMethod.value;
        const contact = method === 'email' 
            ? document.getElementById('verifyEmail').value 
            : document.getElementById('verifyMobile').value;

        if (!contact) {
            alert(`कृपया अपना ${method === 'email' ? 'ईमेल' : 'मोबाइल नंबर'} दर्ज करें`);
            return;
        }

        try {
            // Show loading state
            recoverUsernameBtn.disabled = true;
            recoverUsernameBtn.textContent = 'खोज रहे हैं...';

            // Find user by email/mobile
            const response = await fetch(`/api/find-user?${method}=${encodeURIComponent(contact)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `कोई यूजर नहीं मिला`);
            }

            // Send username via email/SMS
            await fetch('/api/send-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method,
                    contact,
                    username: data.username
                })
            });

            alert(`आपका यूजरनेम आपके ${method === 'email' ? 'ईमेल' : 'मोबाइल नंबर'} पर भेज दिया गया है`);
            forgotUsernameModal.style.display = 'none';

        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'यूजरनेम खोजने में समस्या हुई');
        } finally {
            // Reset button state
            recoverUsernameBtn.disabled = false;
            recoverUsernameBtn.textContent = 'Recover Username';
        }
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === credentialsModal) {
            credentialsModal.style.display = 'none';
        }
        if (e.target === forgotUsernameModal) {
            forgotUsernameModal.style.display = 'none';
        }
    });
});

// Function to handle dropdown toggle
function toggleDropdown(dropdownContainer) {
    const dropdownList = dropdownContainer.querySelector('.dropdown-list');
    const allDropdowns = document.querySelectorAll('.dropdown-list');
    
    // Close all other dropdowns
    allDropdowns.forEach(dropdown => {
        if (dropdown !== dropdownList) {
            dropdown.classList.remove('show');
        }
    });
    
    // Toggle current dropdown
    dropdownList.classList.toggle('show');
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
        const dropdowns = document.querySelectorAll('.dropdown-list');
        dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    }
});

// Replace direct DOM rendering with virtualized lists
function initializeDataTable() {
  const container = document.getElementById('data-container');
  
  // If using vanilla JS, consider adding a library like clusterize.js
  const clusterize = new Clusterize({
    rows: [], // Will be populated via API
    scrollId: 'scrollArea',
    contentId: 'contentArea',
    rows_in_block: 50,
    blocks_in_cluster: 4
  });
  
  // Load data with pagination
  async function loadData(page = 1) {
    const response = await fetch(`/api/data?page=${page}&pageSize=100`);
    const { data, pagination } = await response.json();
    
    // Transform data to HTML rows
    const rows = data.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${item.name}</td>
        <!-- Other columns -->
      </tr>
    `);
    
    clusterize.update(rows);
    updatePagination(pagination);
  }
  
  loadData();
} 