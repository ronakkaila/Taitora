/**
 * Early authentication check script
 * This script runs before the page fully loads to check if the user is authenticated
 * and redirect to the dashboard if they are.
 */

// Check if user is already logged in
const user = localStorage.getItem('user');
if (user) {
    // Only redirect if we're on the login or signup page
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html' || path === '/signup' || path === '/signup.html') {
        // Try to verify with the server
        fetch('/api/user/profile')
            .then(response => {
                if (response.ok) {
                    // Valid session, redirect to dashboard immediately
                    window.location.href = '/pages/user-dashboard.html';
                } else {
                    // Invalid session, clear localStorage
                    localStorage.removeItem('user');
                }
            })
            .catch(err => {
                console.error('Early auth check error:', err);
            });
    }
} 