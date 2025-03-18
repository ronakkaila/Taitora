document.addEventListener('DOMContentLoaded', () => {
    const backupBtn = document.getElementById('backupBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreFileInput = document.getElementById('restoreFileInput');
    const statusMessage = document.getElementById('statusMessage');
    const lightThemeBtn = document.getElementById('lightThemeBtn');
    const darkThemeBtn = document.getElementById('darkThemeBtn');
    const backupUsername = document.getElementById('backupUsername');
    const currentFinancialYearSelect = document.getElementById('currentFinancialYear');
    const createNewFinancialYearBtn = document.getElementById('createNewFinancialYearBtn');
    const financialYearStatusMessage = document.getElementById('financialYearStatusMessage');

    // Set to store user data globally
    let user = { username: '' };

    // Initialize with the current theme
    initializeThemeButtons();

    // Initialize user data
    getBackupUsername();

    // Financial Year Management
    initializeFinancialYears();

    // Theme preview functionality
    const lightThemePreview = document.getElementById('lightThemePreview');
    const darkThemePreview = document.getElementById('darkThemePreview');

    if (lightThemePreview) {
        lightThemePreview.addEventListener('click', () => {
            window.applyTheme('light');
            updateThemeButtonStates('light');
            showStatus('Light theme applied!', 'success');
        });
    }

    if (darkThemePreview) {
        darkThemePreview.addEventListener('click', () => {
            window.applyTheme('dark');
            updateThemeButtonStates('dark');
            showStatus('Dark theme applied!', 'success');
        });
    }

    function initializeFinancialYears() {
        // Get or initialize financial years from localStorage
        let financialYears = JSON.parse(localStorage.getItem('financialYears') || '[]');
        let currentFinancialYear = localStorage.getItem('currentFinancialYear');
        
        // If no financial years exist, create the first one
        if (financialYears.length === 0) {
            const today = new Date();
            const currentYear = today.getFullYear();
            const month = today.getMonth() + 1; // JavaScript months are 0-indexed
            
            // Determine the financial year based on current date
            // If we're between January and March, we're in the previous year's financial year
            const startYear = month >= 4 ? currentYear : currentYear - 1;
            const endYear = startYear + 1;
            
            const newFinancialYear = {
                id: `FY${startYear}-${endYear}`,
                label: `FY ${startYear}-${endYear}`,
                startDate: `${startYear}-04-01`,
                endDate: `${endYear}-03-31`
            };
            
            financialYears.push(newFinancialYear);
            currentFinancialYear = newFinancialYear.id;
            
            // Save to localStorage
            localStorage.setItem('financialYears', JSON.stringify(financialYears));
            localStorage.setItem('currentFinancialYear', currentFinancialYear);
        }
        
        // Populate the financial year dropdown
        populateFinancialYearDropdown(financialYears, currentFinancialYear);
    }
    
    function populateFinancialYearDropdown(financialYears, selectedYear) {
        // Clear existing options
        currentFinancialYearSelect.innerHTML = '';
        
        // Add options for each financial year
        financialYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year.id;
            option.textContent = year.label;
            currentFinancialYearSelect.appendChild(option);
        });
        
        // Set the selected year
        if (selectedYear) {
            currentFinancialYearSelect.value = selectedYear;
        }
    }
    
    // Handle financial year change
    currentFinancialYearSelect.addEventListener('change', function() {
        const selectedFinancialYear = this.value;
        localStorage.setItem('currentFinancialYear', selectedFinancialYear);
        showFinancialYearStatus(`Financial year switched to ${this.options[this.selectedIndex].text}. Refreshing...`, 'success');
        
        // Reload the page to reflect the new financial year
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });
    
    // Create new financial year
    createNewFinancialYearBtn.addEventListener('click', function() {
        // Get existing financial years
        const financialYears = JSON.parse(localStorage.getItem('financialYears') || '[]');
        
        // Determine the next financial year based on the latest one
        let startYear, endYear;
        
        if (financialYears.length > 0) {
            // Get the latest financial year
            const latestYear = financialYears[financialYears.length - 1];
            const latestEndYear = parseInt(latestYear.endDate.split('-')[0]);
            
            startYear = latestEndYear;
            endYear = startYear + 1;
        } else {
            // If no financial years exist (shouldn't happen due to initialization)
            const today = new Date();
            startYear = today.getFullYear();
            endYear = startYear + 1;
        }
        
        // Ask for confirmation
        if (!confirm(`Are you sure you want to start a new financial year (${startYear}-${endYear})? This will:\n\n1. Save your current closing stock as opening stock for the new year\n2. Reset invoice numbers to start from 1\n3. Create a new financial period`)) {
            return;
        }
        
        // Create the new financial year
        const newFinancialYear = {
            id: `FY${startYear}-${endYear}`,
            label: `FY ${startYear}-${endYear}`,
            startDate: `${startYear}-04-01`,
            endDate: `${endYear}-03-31`
        };
        
        // Perform year-end processing
        processYearEnd(newFinancialYear).then(success => {
            if (success) {
                // Add the new financial year and set it as current
                financialYears.push(newFinancialYear);
                localStorage.setItem('financialYears', JSON.stringify(financialYears));
                localStorage.setItem('currentFinancialYear', newFinancialYear.id);
                
                // Update the dropdown
                populateFinancialYearDropdown(financialYears, newFinancialYear.id);
                
                showFinancialYearStatus(`New financial year ${newFinancialYear.label} created successfully. Refreshing...`, 'success');
                
                // Reload the page to reflect the new financial year
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        }).catch(error => {
            showFinancialYearStatus(`Error creating new financial year: ${error.message}`, 'error');
        });
    });
    
    async function processYearEnd(newFinancialYear) {
        try {
            showFinancialYearStatus('Processing year-end operations...', 'info');
            
            // 1. Get current stock data to use as opening stock for new year
            const stockResponse = await fetch('/api/stock');
            if (!stockResponse.ok) {
                throw new Error(`Failed to fetch stock data: ${stockResponse.statusText}`);
            }
            const stockData = await stockResponse.json();
            
            // 2. Make API call to process year end
            const response = await fetch('/api/process-year-end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    newFinancialYear: newFinancialYear,
                    closingStock: stockData
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process year end');
            }
            
            return true;
        } catch (error) {
            console.error('Year-end processing error:', error);
            throw error;
        }
    }
    
    function showFinancialYearStatus(message, type) {
        financialYearStatusMessage.textContent = message;
        financialYearStatusMessage.className = `status-message ${type}`;
        financialYearStatusMessage.style.display = 'block';
        
        if (type !== 'info') {
            setTimeout(() => {
                financialYearStatusMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Create a forced restart modal for after restore
    function createRestartModal() {
        // Create the modal container if it doesn't exist
        let modal = document.getElementById('restartModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'restartModal';
            modal.className = 'restart-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.flexDirection = 'column';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'restart-modal-content';
            modalContent.style.backgroundColor = '#fff';
            modalContent.style.padding = '30px';
            modalContent.style.borderRadius = '5px';
            modalContent.style.textAlign = 'center';
            modalContent.style.maxWidth = '500px';
            modalContent.style.width = '90%';
            
            const heading = document.createElement('h2');
            heading.textContent = 'Application Restart Required';
            heading.style.marginBottom = '20px';
            heading.style.color = '#333';
            
            const message = document.createElement('p');
            message.textContent = 'The database has been successfully restored. You must restart the application to continue.';
            message.style.marginBottom = '30px';
            message.style.fontSize = '16px';
            message.style.lineHeight = '1.5';
            
            const restartButton = document.createElement('button');
            restartButton.textContent = 'Restart Application';
            restartButton.className = 'btn btn-primary';
            restartButton.style.padding = '12px 24px';
            restartButton.style.fontSize = '16px';
            restartButton.style.cursor = 'pointer';
            
            restartButton.addEventListener('click', () => {
                window.location.href = '/';
            });
            
            modalContent.appendChild(heading);
            modalContent.appendChild(message);
            modalContent.appendChild(restartButton);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
        
        // Prevent closing the modal by other means
        window.onbeforeunload = function(e) {
            // Don't prevent navigation to '/' (our restart destination)
            if (e.currentTarget.location.pathname !== '/') {
                return 'The application needs to restart to apply the restored database. Please use the Restart button.';
            }
        };
        
        return modal;
    }

    // Backup functionality
    backupBtn.addEventListener('click', () => {
        if (!user.username) {
            showStatus('Error: Unable to determine username. Please try logging in again.', 'error');
            return;
        }
        
        showStatus(`Creating backup for user "${user.username}", please wait...`, 'info');
        
        fetch('/api/backup')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error (${response.status}): ${response.statusText}`);
                    });
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                const date = new Date().toISOString().split('T')[0];
                a.href = url;
                a.download = `backup_${user.username}_${date}.db`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showStatus(`Backup created successfully for user "${user.username}"!`, 'success');
            })
            .catch(error => {
                console.error('Error creating backup:', error);
                showStatus(`Error creating backup: ${error.message}. Please try again.`, 'error');
            });
    });

    // Restore functionality
    restoreBtn.addEventListener('click', () => {
        if (!user.username) {
            showStatus('Error: Unable to determine username. Please try logging in again.', 'error');
            return;
        }
        
        restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check if the filename contains the username
        const username = user.username || '';
        const filename = file.name.toLowerCase();
        const expectedPrefix = `backup_${username.toLowerCase()}`;
        
        // Warn if the backup might not be for this user
        if (username && !filename.includes(username.toLowerCase())) {
            if (!confirm(`Warning: This backup file (${file.name}) does not appear to be for user "${username}". Restoring it may overwrite your data with someone else's. Are you sure you want to proceed?`)) {
                event.target.value = '';
                return;
            }
        }

        // Double-confirm before proceeding with restore
        if (!confirm(`WARNING: You are about to restore data for user "${username}". This will overwrite your current data and the application will need to restart. Are you sure you want to continue?`)) {
            event.target.value = '';
            return;
        }

        showStatus(`Restoring database for user "${username}", please wait...`, 'info');

        const formData = new FormData();
        formData.append('backup', file);

        fetch('/api/restore', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `Server error (${response.status}): ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showStatus(`Database restored successfully for user "${username}"! Application restart required.`, 'success');
                
                // Show the mandatory restart modal
                createRestartModal();
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error restoring backup:', error);
            showStatus(`Error restoring backup: ${error.message}. Please try again.`, 'error');
        });

        // Clear the input
        event.target.value = '';
    });

    // Theme functionality
    lightThemeBtn.addEventListener('click', () => {
        window.applyTheme('light');
        updateThemeButtonStates('light');
        showStatus('Light theme applied!', 'success');
    });

    darkThemeBtn.addEventListener('click', () => {
        window.applyTheme('dark');
        updateThemeButtonStates('dark');
        showStatus('Dark theme applied!', 'success');
    });

    // Initialize theme buttons to show current theme
    function initializeThemeButtons() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        updateThemeButtonStates(currentTheme);
    }

    // Update the visual state of theme buttons
    function updateThemeButtonStates(currentTheme) {
        if (currentTheme === 'dark') {
            darkThemeBtn.classList.add('btn-primary');
            darkThemeBtn.classList.remove('btn-secondary');
            lightThemeBtn.classList.add('btn-secondary');
            lightThemeBtn.classList.remove('btn-primary');
        } else {
            lightThemeBtn.classList.add('btn-primary');
            lightThemeBtn.classList.remove('btn-secondary');
            darkThemeBtn.classList.add('btn-secondary');
            darkThemeBtn.classList.remove('btn-primary');
        }
    }

    function getBackupUsername() {
        fetch('/api/user')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch user data');
                }
                return response.json();
            })
            .then(userData => {
                if (userData && userData.username) {
                    user = userData; // Store user data globally
                    backupUsername.textContent = userData.username;
                    
                    // Update any text content that should show the username
                    const usernameDisplayElements = document.querySelectorAll('.backup-username-display');
                    usernameDisplayElements.forEach(el => {
                        el.textContent = userData.username;
                    });
                    
                    // Update backup/restore buttons to include username
                    if (backupBtn) {
                        backupBtn.title = `Create a backup for user "${userData.username}"`;
                    }
                    if (restoreBtn) {
                        restoreBtn.title = `Restore a backup for user "${userData.username}"`;
                    }
                } else {
                    backupUsername.textContent = 'Unknown User';
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                backupUsername.textContent = 'Error loading username';
            });
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        if (type !== 'info') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }
}); 