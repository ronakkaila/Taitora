/**
 * Common JavaScript functions used across all pages
 */

// Update company name in the topbar when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load theme preference
        loadThemePreference();
        
        // Initialize financial year data
        initializeFinancialYearData();
        
        // Try to fetch the user profile
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const userData = await response.json();
            
            // Find the company name element in the topbar
            const companyNameElem = document.querySelector('.topbar .logo span');
            if (companyNameElem && userData.company_name) {
                companyNameElem.textContent = userData.company_name;
                
                // Also set the document title to include the company name
                if (document.title) {
                    document.title = `${document.title} | ${userData.company_name}`;
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load user profile data:', error);
    }
    
    // Ensure consistent topbar across all pages
    standardizeTopbar();
    
    // Fix overlapping issues
    fixLayoutOverlaps();
});

/**
 * Gets the current financial year from the server
 * @returns {Object|null} The current financial year object
 */
function getCurrentFinancialYear() {
    const financialYears = JSON.parse(localStorage.getItem('financialYears') || '[]');
    const currentFinancialYearId = localStorage.getItem('currentFinancialYear');
    
    if (financialYears.length === 0 || !currentFinancialYearId) {
        return null;
    }
    
    return financialYears.find(year => year.id === currentFinancialYearId);
}

/**
 * Fetch all financial years from the server
 */
function fetchFinancialYears() {
    return fetch('/api/financial-years')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch financial years');
            }
            return response.json();
        })
        .then(years => {
            // Cache the years in sessionStorage
            sessionStorage.setItem('financialYears', JSON.stringify(years));
            return years;
        });
}

/**
 * Initialize financial year data
 * This will be triggered automatically when first needed
 */
function initializeFinancialYearData() {
    fetchFinancialYears().catch(err => {
        console.error('Failed to initialize financial year data:', err);
    });
}

/**
 * Checks if a date is within the current financial year
 * @param {string} dateStr - The date string to check
 * @returns {boolean} True if the date is within the current financial year
 */
function isDateInCurrentFinancialYear(dateStr) {
    const currentFY = getCurrentFinancialYear();
    if (!currentFY) return true; // Default to true if no financial year is set
    
    const date = new Date(dateStr);
    const startDate = new Date(currentFY.startDate);
    const endDate = new Date(currentFY.endDate);
    
    return date >= startDate && date <= endDate;
}

/**
 * Filters an array of objects based on the current financial year
 * @param {Array} items - Array of objects with date properties
 * @param {string} dateField - The name of the date field to filter on
 * @returns {Array} Filtered array of items in the current financial year
 */
function filterByCurrentFinancialYear(items, dateField = 'date') {
    const currentFY = getCurrentFinancialYear();
    if (!currentFY || items.length === 0) return items;
    
    return items.filter(item => {
        // First try to filter by financial_year_id if it exists
        if (item.financial_year_id) {
            return item.financial_year_id === currentFY.id;
        }
        
        // Otherwise filter by date field
        if (item[dateField]) {
            return isDateInCurrentFinancialYear(item[dateField]);
        }
        
        // If neither exists, include the item
        return true;
    });
}

/**
 * Standardize the topbar across all pages to ensure consistent navigation
 * - Checks if current page has a topbar and replaces it with standard version if needed
 * - Ensures consistent navigation links and styling
 */
function standardizeTopbar() {
    const currentTopbar = document.querySelector('.topbar');
    
    // If no topbar exists, we need to create one
    if (!currentTopbar) {
        const newTopbar = createStandardTopbar();
        document.body.insertBefore(newTopbar, document.body.firstChild);
        return;
    }
    
    // Check if nav-links exist and are properly formatted
    const navLinks = currentTopbar.querySelector('.nav-links');
    
    // If nav-links don't exist or are in the wrong format, replace with standard version
    if (!navLinks || navLinks.tagName !== 'UL') {
        const standardNav = createStandardNavLinks();
        
        // If there's an existing nav element, replace it; otherwise, append to topbar
        const existingNav = currentTopbar.querySelector('nav');
        if (existingNav) {
            existingNav.innerHTML = '';
            existingNav.appendChild(standardNav);
        } else {
            const newNav = document.createElement('nav');
            newNav.appendChild(standardNav);
            
            // Insert after logo, before any other elements
            const logo = currentTopbar.querySelector('.logo');
            if (logo && logo.nextSibling) {
                currentTopbar.insertBefore(newNav, logo.nextSibling);
            } else {
                currentTopbar.appendChild(newNav);
            }
        }
    }
    
    // Ensure theme toggle button exists
    if (!currentTopbar.querySelector('#themeToggleBtn')) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.textContent = 'Toggle Theme';
        currentTopbar.appendChild(themeBtn);
        
        // Add theme toggle functionality
        themeBtn.addEventListener('click', toggleDarkTheme);
    }
}

/**
 * Create a standard topbar element
 * @returns {HTMLElement} - The standard topbar element
 */
function createStandardTopbar() {
    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    
    // Add logo
    const logo = document.createElement('div');
    logo.className = 'logo';
    const span = document.createElement('span');
    span.textContent = 'Business';
    logo.appendChild(span);
    
    // Add navigation
    const nav = document.createElement('nav');
    nav.appendChild(createStandardNavLinks());
    
    // Add theme toggle button
    const themeBtn = document.createElement('button');
    themeBtn.id = 'themeToggleBtn';
    themeBtn.textContent = 'Toggle Theme';
    themeBtn.addEventListener('click', toggleDarkTheme);
    
    // Assemble topbar
    topbar.appendChild(logo);
    topbar.appendChild(nav);
    topbar.appendChild(themeBtn);
    
    return topbar;
}

/**
 * Create standard navigation links
 * @returns {HTMLElement} - UL element with standard nav links
 */
function createStandardNavLinks() {
    const navLinks = document.createElement('ul');
    navLinks.className = 'nav-links';
    
    // Define standard navigation items
    const navItems = [
        { href: '../pages/user-dashboard.html', icon: 'fas fa-tachometer-alt', text: 'Dashboard' },
        { href: '../pages/sales.html', icon: 'fas fa-chart-line', text: 'Sales' },
        { href: '../pages/purchases.html', icon: 'fas fa-shopping-cart', text: 'Purchases' },
        { href: '../pages/stock.html', icon: 'fas fa-boxes', text: 'Stock' },
        { href: '../pages/account.html', icon: 'fas fa-user-circle', text: 'Account' },
        { href: '../pages/products.html', icon: 'fas fa-box', text: 'Products' },
        { href: '../pages/transporters.html', icon: 'fas fa-truck', text: 'Transporters' },
        { href: '../pages/settings.html', icon: 'fas fa-cog', text: 'Settings' }
    ];
    
    // Create list items for each nav item
    navItems.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;
        
        const i = document.createElement('i');
        i.className = item.icon;
        
        a.appendChild(i);
        a.appendChild(document.createTextNode(' ' + item.text));
        
        // Mark current page as active
        if (window.location.pathname.includes(item.href)) {
            a.classList.add('active');
        }
        
        li.appendChild(a);
        navLinks.appendChild(li);
    });
    
    return navLinks;
}

/**
 * Toggle dark theme
 */
function toggleDarkTheme() {
    document.body.classList.toggle('dark-theme');
    // Save preference
    const isDarkTheme = document.body.classList.contains('dark-theme');
    localStorage.setItem('dark-theme', isDarkTheme);
}

/**
 * Fix layout overlapping issues
 * - Checks for bottom bar and applies necessary classes
 * - Ensures proper spacing between elements
 */
function fixLayoutOverlaps() {
    // Check if page has a bottom bar
    const bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) {
        // Find all containers that need the has-bottom-bar class
        const containers = document.querySelectorAll('.draggable-container, .content, .dynamic-container');
        containers.forEach(container => {
            if (!container.classList.contains('has-bottom-bar')) {
                container.classList.add('has-bottom-bar');
            }
        });
    }
    
    // Ensure topbar doesn't overlap content
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const topbarHeight = topbar.offsetHeight;
        document.documentElement.style.setProperty('--topbar-height', `${topbarHeight}px`);
        
        // Update margin for all content containers
        const contentContainers = document.querySelectorAll('.content, .draggable-container, .dynamic-container');
        contentContainers.forEach(container => {
            container.style.marginTop = `${topbarHeight}px`;
        });
    }
}

// Function to format date to YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

// Function to format currency
function formatCurrency(amount) {
    return parseFloat(amount).toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    });
}

// Function to show a temporary success message
function showSuccessMessage(message, duration = 3000) {
    // Remove any existing success message
    const existingMessage = document.querySelector('.success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message element
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.textContent = message;
    
    // Add to document
    document.body.appendChild(messageElement);
    
    // Remove after duration
    setTimeout(() => {
        messageElement.remove();
    }, duration);
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    const isDarkTheme = localStorage.getItem('dark-theme') === 'true';
    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Theme Management Functions
function initializeTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    applyTheme(currentTheme, false);
    
    // Add theme toggle to topbar if it exists
    setupThemeToggleButton();
}

function applyTheme(theme, savePreference = true) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    // Save preference to localStorage if needed
    if (savePreference) {
        localStorage.setItem('theme', theme);
    }

    // Update the theme toggle button in the topbar
    updateThemeToggleButton(theme);
}

function setupThemeToggleButton() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        // Add event listener
        themeToggleBtn.addEventListener('click', toggleTheme);
        
        // Set initial icon
        updateThemeToggleButton(localStorage.getItem('theme') || 'light');
    }
}

function updateThemeToggleButton(theme) {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = theme === 'dark' ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
        
        themeToggleBtn.title = theme === 'dark' ? 
            'Switch to Light Theme' : 
            'Switch to Dark Theme';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTheme);

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.getCurrentFinancialYear = getCurrentFinancialYear;
    window.initializeTheme = initializeTheme;
    window.applyTheme = applyTheme;
    window.toggleTheme = toggleTheme;
}

// Add intersection observer for lazy loading
function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const lazyElement = entry.target;
                if (lazyElement.dataset.src) {
                    // For images
                    lazyElement.src = lazyElement.dataset.src;
                    lazyElement.removeAttribute('data-src');
                } else if (lazyElement.classList.contains('lazy-load-data')) {
                    // For data sections
                    const dataType = lazyElement.dataset.type;
                    const page = parseInt(lazyElement.dataset.page) || 1;
                    fetchMoreData(dataType, page, lazyElement);
                }
                observer.unobserve(lazyElement);
            }
        });
    }, {
        rootMargin: '100px'
    });
    
    // Observe all lazy load elements
    document.querySelectorAll('.lazy-load, .lazy-load-data').forEach(element => {
        observer.observe(element);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', setupLazyLoading); 