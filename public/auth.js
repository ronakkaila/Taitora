// Check if user is logged in
async function checkAuth() {
    const user = localStorage.getItem('user');
    const currentPath = window.location.pathname;
    
    // Debug information
    console.log('Current path:', currentPath);
    console.log('User logged in (localStorage):', !!user);
    
    // If user exists in localStorage, verify with server
    if (user) {
        try {
            const response = await fetch('/api/user/profile');
            if (!response.ok) {
                console.log('Session expired or invalid, redirecting to login');
                localStorage.removeItem('user');
                if (currentPath !== '/' && currentPath !== '/index.html') {
                    window.location.href = '/';
                }
                return false;
            }
            
            // If on login page but authenticated, redirect to dashboard
            if (currentPath === '/' || currentPath === '/index.html' || currentPath === '/signup' || currentPath === '/signup.html') {
                console.log('Redirecting to dashboard');
                window.location.href = '/pages/user-dashboard.html';
                return false;
            }
            
            // User is authenticated, allow them to stay on the current page
            return true;
        } catch (error) {
            console.error('Error checking authentication:', error);
            // On error, assume not authenticated
            localStorage.removeItem('user');
            if (currentPath !== '/' && currentPath !== '/index.html') {
                window.location.href = '/';
            }
            return false;
        }
    } else {
        // If not logged in and trying to access protected pages
        if (currentPath !== '/' && 
            currentPath !== '/index.html' && 
            currentPath !== '/signup' && 
            currentPath !== '/signup.html' && 
            !currentPath.includes('reset-password')) {
            console.log('Not logged in, redirecting to login page');
            window.location.href = '/';
            return false;
        }
    }
    
    return true;
}

// Logout function
function logout() {
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.location.href = '/';
}

// Run authentication check when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupAuthCheck();
    setupLogoutHandler();
});

// Setup periodic authentication checks
function setupAuthCheck() {
    // Run authentication check every 5 minutes
    setInterval(checkAuth, 5 * 60 * 1000);
    
    // Also check when the user interacts with the page after being idle
    let lastActivity = Date.now();
    const idleThreshold = 10 * 60 * 1000; // 10 minutes
    
    function resetTimer() {
        const now = Date.now();
        if (now - lastActivity > idleThreshold) {
            // If user was idle for more than the threshold, check auth
            checkAuth();
        }
        lastActivity = now;
    }
    
    // Events that reset the idle timer
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });
}

// Setup logout handler to ensure consistent logout experience
function setupLogoutHandler() {
    // Don't add logout button to login or signup pages
    if (window.location.pathname !== '/' && 
        window.location.pathname !== '/index.html' && 
        window.location.pathname !== '/signup' && 
        window.location.pathname !== '/signup.html') {
        
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            // Check if logout button already exists
            if (!document.querySelector('.logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                logoutBtn.className = 'logout-btn';
                logoutBtn.onclick = logout;
                
                // Add styles if they don't exist
                if (!document.querySelector('#logout-styles')) {
                    const style = document.createElement('style');
                    style.id = 'logout-styles';
                    style.textContent = `
                        .logout-btn {
                            background: transparent;
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            color: var(--text-light);
                            cursor: pointer;
                            padding: 0.4rem 0.8rem;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            font-size: 0.85rem;
                            border-radius: var(--border-radius-md);
                            transition: all 0.3s ease;
                            margin-left: 10px;
                        }
                        
                        .logout-btn:hover {
                            background-color: rgba(255, 255, 255, 0.1);
                            transform: translateY(-2px);
                        }
                        
                        .logout-btn i {
                            font-size: 0.9rem;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Insert logout button after theme toggle button if it exists
                const themeBtn = document.querySelector('#themeToggleBtn');
                if (themeBtn) {
                    themeBtn.parentNode.insertBefore(logoutBtn, themeBtn.nextSibling);
                } else {
                    topbar.appendChild(logoutBtn);
                }
            }
        }
    }
    
    // Also add event listener to existing logout button if it exists
    const existingLogoutBtn = document.getElementById('logoutBtn');
    if (existingLogoutBtn) {
        existingLogoutBtn.addEventListener('click', logout);
    }
}

// Handle session timeout
let sessionTimeout;
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

function resetSessionTimeout() {
    clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(() => {
        // Only logout if user is logged in
        if (localStorage.getItem('user')) {
            alert('Your session has expired. Please log in again.');
            logout();
        }
    }, SESSION_DURATION);
}

// Reset timeout on user activity
document.addEventListener('click', resetSessionTimeout);
document.addEventListener('keypress', resetSessionTimeout);
document.addEventListener('mousemove', resetSessionTimeout);
document.addEventListener('scroll', resetSessionTimeout);

// Initialize session timeout
resetSessionTimeout(); 