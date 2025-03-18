// Main JavaScript file for application-wide functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme based on saved preference
    initializeTheme();
    
    // Add event listener to theme toggle button if it exists
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Theme Functions
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);
        
        // Update toggle button UI if it exists
        updateThemeToggleButton(savedTheme);
    }
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }
    
    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Save to localStorage
        localStorage.setItem('theme', newTheme);
        
        // Apply the theme
        applyTheme(newTheme);
        
        // Update toggle button
        updateThemeToggleButton(newTheme);
    }
    
    function updateThemeToggleButton(theme) {
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            // Update button icon based on current theme
            themeToggleBtn.innerHTML = theme === 'dark' ? 
                '<i class="fas fa-sun"></i>' : 
                '<i class="fas fa-moon"></i>';
                
            // Update button tooltip
            themeToggleBtn.title = theme === 'dark' ? 
                'Switch to Light Mode' : 
                'Switch to Dark Mode';
        }
    }
}); 