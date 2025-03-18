/**
 * Responsive behavior enhancements for mobile and touch devices
 */
document.addEventListener('DOMContentLoaded', function() {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Apply a class to the body for touch-specific CSS
    if (isTouch) {
        document.body.classList.add('touch-device');
    }
    
    if (isMobile) {
        document.body.classList.add('mobile-device');
    }
    
    // Handle responsive tables
    makeTablesResponsive();
    
    // Handle mobile menu toggle
    setupMobileMenu();
    
    // Enhance draggable containers for touch devices
    enhanceDraggableContainers();
    
    // Optimize modals for mobile
    enhanceModalsForMobile();
    
    // Fix element overlapping issues
    fixOverlappingElements();
    
    // Improve color contrast
    improveColorContrast();
    
    // Handle long company names
    handleLongCompanyNames();
});

/**
 * Adds horizontal scrolling to tables
 */
function makeTablesResponsive() {
    // Find tables not already in a .table-responsive container
    const tables = document.querySelectorAll('table:not(.table-responsive table)');
    
    tables.forEach(table => {
        // Only wrap if not already wrapped
        if (!table.closest('.table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

/**
 * Setup mobile menu toggle functionality
 */
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('show');
            
            // Add overlay when menu is shown
            let overlay = document.querySelector('.mobile-overlay');
            if (navLinks.classList.contains('show')) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'mobile-overlay';
                    document.body.appendChild(overlay);
                    
                    // Close menu when overlay is clicked
                    overlay.addEventListener('click', function() {
                        navLinks.classList.remove('show');
                        overlay.remove();
                    });
                }
            } else if (overlay) {
                overlay.remove();
            }
        });
    }
}

/**
 * Make draggable containers work better on touch devices
 */
function enhanceDraggableContainers() {
    const containers = document.querySelectorAll('.draggable-container');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    containers.forEach(container => {
        if (isTouch) {
            // Disable dragging on mobile/touch devices - use native scrolling instead
            const existingMouseDown = container.onmousedown;
            if (existingMouseDown) {
                container.onmousedown = null;
            }
            
            // Better touch experience
            container.style.overflowY = 'auto';
            container.style.overflowX = 'auto';
            container.style.WebkitOverflowScrolling = 'touch';
        }
    });
}

/**
 * Enhance modals for better mobile experience
 */
function enhanceModalsForMobile() {
    const modalContents = document.querySelectorAll('.modal-content');
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    
    if (isMobile) {
        modalContents.forEach(modal => {
            // Fix for iOS Safari modal position issues
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.maxHeight = '80vh';
            modal.style.overflowY = 'auto';
            modal.style.WebkitOverflowScrolling = 'touch';
        });
    }
    
    // Add event listeners for modals to prevent body scrolling when modal is open
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('shown', () => {
            document.body.style.overflow = 'hidden';
        });
        
        modal.addEventListener('hidden', () => {
            document.body.style.overflow = '';
        });
    });
}

/**
 * Fix overlapping elements in the UI
 * - Ensures topbar doesn't overlap content
 * - Ensures bottom bar doesn't overlay content
 * - Fixes any other common overlapping issues
 */
function fixOverlappingElements() {
    // Check if page has a bottom bar
    const bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) {
        // Add the has-bottom-bar class to the draggable container
        const container = document.querySelector('.draggable-container');
        if (container && !container.classList.contains('has-bottom-bar')) {
            container.classList.add('has-bottom-bar');
        }
    }
    
    // Ensure content doesn't overlap with topbar
    const topbar = document.querySelector('.topbar');
    const content = document.querySelector('.content');
    const draggableContainer = document.querySelector('.draggable-container');
    
    if (topbar && content) {
        const topbarHeight = topbar.offsetHeight;
        // Set CSS variable for topbar height
        document.documentElement.style.setProperty('--topbar-height', `${topbarHeight}px`);
        
        // Update margin-top of content to match topbar height
        content.style.marginTop = `${topbarHeight}px`;
    }
    
    if (topbar && draggableContainer) {
        const topbarHeight = topbar.offsetHeight;
        // Update margin-top of draggable container to match topbar height
        draggableContainer.style.marginTop = `${topbarHeight}px`;
    }
    
    // Fix any secondary navbars that might overlap content
    const secondaryNavs = document.querySelectorAll('.secondary-nav, .sub-nav');
    secondaryNavs.forEach(nav => {
        if (nav && content) {
            const navBottom = nav.offsetTop + nav.offsetHeight;
            content.style.paddingTop = `${navBottom}px`;
        }
    });
}

/**
 * Improve color contrast throughout the UI
 * - Fixes cases where text color and background color are too similar
 * - Applies better contrast in dark mode
 */
function improveColorContrast() {
    const isDarkMode = document.body.classList.contains('dark-theme');
    
    // Fix common areas with contrast issues
    if (isDarkMode) {
        // Improve contrast for dark mode
        document.querySelectorAll('.card, .stat-card, .table, th, td').forEach(el => {
            // Get current background
            const bgColor = window.getComputedStyle(el).backgroundColor;
            
            // If background is very dark, ensure text is light
            if (bgColor.includes('rgba(0, 0, 0') || 
                bgColor.includes('rgb(0, 0, 0') || 
                bgColor.includes('rgb(27, 27, 27') || 
                bgColor.includes('rgb(42, 42, 42')) {
                el.style.color = '#f0f0f0'; // Light text for dark backgrounds
            }
        });
        
        // Fix buttons in dark mode
        document.querySelectorAll('button, .btn').forEach(btn => {
            const bgColor = window.getComputedStyle(btn).backgroundColor;
            const textColor = window.getComputedStyle(btn).color;
            
            // Check if button has dark text on dark background
            if ((bgColor.includes('rgb(42, 42, 42') || bgColor.includes('rgb(27, 27, 27')) && 
                textColor.includes('rgb(51, 51, 51')) {
                btn.style.color = '#f0f0f0'; // Fix dark text on dark background
            }
        });
    } else {
        // Improve contrast for light mode
        document.querySelectorAll('.card, .stat-card').forEach(el => {
            const bgColor = window.getComputedStyle(el).backgroundColor;
            
            // If background is very light, ensure text is dark
            if (bgColor.includes('rgba(255, 255, 255') || 
                bgColor.includes('rgb(255, 255, 255') || 
                bgColor.includes('rgb(245, 247, 250')) {
                el.style.color = '#333333'; // Dark text for light backgrounds
            }
        });
    }
    
    // Fix any elements with --text-color variable that might not be defined
    document.querySelectorAll('[style*="--text-color"]').forEach(el => {
        if (isDarkMode) {
            el.style.color = '#f0f0f0'; // Light text for dark mode
        } else {
            el.style.color = '#333333'; // Dark text for light mode
        }
    });
}

/**
 * Handle long company names in the topbar
 * - Ensures company names don't overflow the topbar
 * - Adds title attribute for hover tooltip with full name
 */
function handleLongCompanyNames() {
    const companyNameElem = document.querySelector('.topbar .logo span');
    if (companyNameElem) {
        const fullName = companyNameElem.textContent;
        
        // Add title attribute for hover tooltip with full name
        companyNameElem.setAttribute('title', fullName);
        
        // Check if the text is overflowing
        const isOverflowing = companyNameElem.scrollWidth > companyNameElem.clientWidth;
        
        // If overflowing on mobile, try to shorten it
        if (isOverflowing && window.innerWidth <= 768) {
            // Get available width
            const availableWidth = companyNameElem.clientWidth;
            const charWidth = availableWidth / (fullName.length * 0.7); // Approximate character width
            
            // If name is too long, truncate it
            if (fullName.length > 15) {
                const shortName = fullName.substring(0, 12) + '...';
                companyNameElem.setAttribute('data-full-name', fullName);
                companyNameElem.textContent = shortName;
            }
        }
    }
} 