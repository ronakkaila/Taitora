// Add a flag to track form submission status
let isSubmitting = false;

async function handleSignup(event) {
    event.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) {
        console.log('Form already being submitted');
        return;
    }
    
    const errorMessageElement = document.getElementById('errorMessage');
    const loadingElement = document.getElementById('loading');
    const submitButton = document.querySelector('.submit-btn');
    
    // Hide any previous error messages
    errorMessageElement.style.display = 'none';
    
    // Get form values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const companyName = document.getElementById('companyName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    
    // Validate form fields
    if (!username || !password || !email) {
        errorMessageElement.textContent = 'Username, password, and email are required.';
        errorMessageElement.style.display = 'block';
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorMessageElement.textContent = 'Please enter a valid email address.';
        errorMessageElement.style.display = 'block';
        return;
    }
    
    // Set submission flag
    isSubmitting = true;
    
    // Show loading state
    loadingElement.style.display = 'block';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                company_name: companyName,
                phone,
                email,
                address
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Registration successful
            window.location.href = '/?registered=true';
        } else {
            // Show error message
            errorMessageElement.textContent = data.error || 'Registration failed. Please try again.';
            errorMessageElement.style.display = 'block';
            
            // Reset submission flag and enable the button
            isSubmitting = false;
            submitButton.disabled = false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorMessageElement.textContent = 'An error occurred. Please try again later.';
        errorMessageElement.style.display = 'block';
        
        // Reset submission flag and enable the button
        isSubmitting = false;
        submitButton.disabled = false;
    } finally {
        // Hide loading state
        loadingElement.style.display = 'none';
        // Note: we don't re-enable the button on success as we're redirecting
    }
}

// Password validation
document.getElementById('password').addEventListener('input', function(e) {
    const password = e.target.value;
    const submitButton = document.querySelector('.submit-btn');
    
    // Password requirements
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    
    // Update password field style
    e.target.style.borderColor = isValid ? '#667eea' : '#ff4444';
    
    // Show/hide error message
    const errorMessageElement = document.getElementById('errorMessage');
    if (!isValid) {
        errorMessageElement.textContent = 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.';
        errorMessageElement.style.display = 'block';
        submitButton.disabled = true;
    } else {
        errorMessageElement.style.display = 'none';
        // Only enable the button if password is valid (other validations can be added here)
        submitButton.disabled = false;
    }
});

// Email validation
document.getElementById('email').addEventListener('input', function(e) {
    const email = e.target.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    // Update email field style
    e.target.style.borderColor = isValid || email === '' ? '#667eea' : '#ff4444';
    
    // Show/hide error message
    const errorMessageElement = document.getElementById('errorMessage');
    if (!isValid && email !== '') {
        errorMessageElement.textContent = 'Please enter a valid email address.';
        errorMessageElement.style.display = 'block';
    } else {
        // Only hide if this was the error showing
        if (errorMessageElement.textContent === 'Please enter a valid email address.') {
            errorMessageElement.style.display = 'none';
        }
    }
});

// Add form submission event listener when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}); 