document.addEventListener('DOMContentLoaded', () => {
    console.log('Transporters page loaded');

    const addTransporterBtn = document.getElementById('addTransporterBtn');
    const transporterModal = document.getElementById('transporterModal');
    const closeTransporterModal = document.getElementById('closeTransporterModal');
    const saveTransporterBtn = document.getElementById('saveTransporterBtn');
    const cancelTransporterBtn = document.getElementById('cancelTransporterBtn');
    const transportersTable = document.getElementById('transportersTable').getElementsByTagName('tbody')[0];

    // Add custom styles for double-click indicator
    const style = document.createElement('style');
    style.textContent = `
        .transporter-row {
            position: relative;
            transition: all 0.2s ease;
        }
        
        .transporter-row::after {
            content: 'Double-click to view details';
            position: absolute;
            right: 10px;
            top: 0;
            height: 100%;
            display: flex;
            align-items: center;
            color: var(--primary-color);
            font-size: 0.8rem;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        
        .transporter-row:hover::after {
            opacity: 0.7;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .transporter-row:active {
            animation: pulse 0.3s;
        }
    `;
    document.head.appendChild(style);

    let transporters = [];
    let editingTransporter = null;

    // Load existing transporters when page loads
    loadTransporters();

    // Show a tooltip indicating double-click functionality
    function showDoubleClickTip() {
        // Create and style the tooltip
        const tooltip = document.createElement('div');
        tooltip.textContent = '💡 Tip: Double-click any row to view transporter details';
        tooltip.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.5s ease;
            font-size: 14px;
        `;
        document.body.appendChild(tooltip);

        // Fade in the tooltip
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 1000);

        // Fade out and remove the tooltip
        setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                tooltip.remove();
            }, 500);
        }, 6000);
    }

    // Show the double-click tip after transporters are loaded
    setTimeout(showDoubleClickTip, 2000);

    function loadTransporters() {
        fetch('/api/transporters')
            .then(response => response.json())
            .then(data => {
                transporters = data;
                renderTransporters();
            })
            .catch(error => console.error('Error loading transporters:', error));
    }

    addTransporterBtn.addEventListener('click', () => {
        editingTransporter = null;
        clearForm();
        transporterModal.style.display = 'flex';
    });

    closeTransporterModal.addEventListener('click', () => {
        transporterModal.style.display = 'none';
        clearForm();
    });

    cancelTransporterBtn.addEventListener('click', () => {
        transporterModal.style.display = 'none';
        clearForm();
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === transporterModal) {
            transporterModal.style.display = 'none';
            clearForm();
        }
    });

    // Add keyboard support for closing modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && transporterModal.style.display === 'flex') {
            transporterModal.style.display = 'none';
            clearForm();
        }
    });

    saveTransporterBtn.addEventListener('click', () => {
        const name = document.getElementById('transporterName').value;
        const mobile = document.getElementById('transporterMobile').value;
        const address = document.getElementById('transporterAddress').value;
        const details = document.getElementById('transporterDetails').value;

        // Validate required fields
        if (!name.trim()) {
            alert('Please enter transporter name');
            return;
        }

        const transporterData = {
            name,
            mobile,
            address,
            details
        };

        // Show loading state
        saveTransporterBtn.disabled = true;
        saveTransporterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const url = editingTransporter 
            ? `/api/transporters/${editingTransporter.id}`
            : '/api/transporters';
        const method = editingTransporter ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transporterData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(() => {
            loadTransporters(); // Reload all transporters
            clearForm();
            transporterModal.style.display = 'none';
            
            // Show success message using standardized notification
            showSuccessMessage(`Transporter ${editingTransporter ? 'updated' : 'added'} successfully!`);
        })
        .catch(error => {
            console.error('Error saving transporter:', error);
            alert('Error saving transporter. Please try again.');
        })
        .finally(() => {
            // Reset button state
            saveTransporterBtn.disabled = false;
            saveTransporterBtn.innerHTML = 'Save';
        });
    });

    function renderTransporters() {
        transportersTable.innerHTML = '';
        transporters.forEach(transporter => {
            const row = transportersTable.insertRow();
            
            // Add class and styling for double-click functionality
            row.classList.add('transporter-row');
            row.style.cursor = 'pointer';
            row.setAttribute('data-transporter-id', transporter.id);
            row.setAttribute('data-transporter-data', encodeURIComponent(JSON.stringify(transporter)));
            
            // Add double-click event listener to the row
            row.addEventListener('dblclick', function() {
                const id = this.getAttribute('data-transporter-id');
                const data = this.getAttribute('data-transporter-data');
                window.location.href = `transporter-overview.html?id=${id}&data=${data}`;
            });
            
            // Add hover effect to show it's interactive
            row.addEventListener('mouseenter', function() {
                this.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.1)';
                this.style.transition = 'all 0.2s ease';
            });
            
            row.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '';
                this.style.transform = '';
                this.style.boxShadow = '';
            });
            
            // Make name clickable and pass all transporter data in URL
            const nameCell = row.insertCell(0);
            const encodedData = encodeURIComponent(JSON.stringify(transporter));
            nameCell.innerHTML = `<a href="transporter-overview.html?id=${transporter.id}&data=${encodedData}" 
                class="transporter-link" 
                style="color: var(--text-color); text-decoration: none; font-weight: 500;">
                ${transporter.name}
            </a>`;
            
            row.insertCell(1).textContent = transporter.mobile || '-';
            row.insertCell(2).textContent = transporter.address || '-';
            row.insertCell(3).textContent = transporter.details || '-';
            
            const actionsCell = row.insertCell(4);
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="editTransporter(${transporter.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteTransporter(${transporter.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            // Stop propagation of click events on buttons and links
            const actionButtons = actionsCell.querySelectorAll('button');
            actionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });
            
            const transporterLink = row.querySelector('.transporter-link');
            if (transporterLink) {
                transporterLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        });
    }

    window.editTransporter = function(transporterId) {
        const transporter = transporters.find(t => t.id === transporterId);
        if (transporter) {
            editingTransporter = transporter;
            document.getElementById('transporterName').value = transporter.name;
            document.getElementById('transporterMobile').value = transporter.mobile || '';
            document.getElementById('transporterAddress').value = transporter.address || '';
            document.getElementById('transporterDetails').value = transporter.details || '';
            transporterModal.style.display = 'flex';
        }
    };

    window.deleteTransporter = function(transporterId) {
        if (confirm('Are you sure you want to delete this transporter?')) {
            fetch(`/api/transporters/${transporterId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(() => {
                loadTransporters(); // Reload all transporters
                showSuccessMessage('Transporter deleted successfully!');
            })
            .catch(error => console.error('Error deleting transporter:', error));
        }
    };

    function clearForm() {
        document.getElementById('transporterName').value = '';
        document.getElementById('transporterMobile').value = '';
        document.getElementById('transporterAddress').value = '';
        document.getElementById('transporterDetails').value = '';
        editingTransporter = null;
    }

    // Standard success message function
    function showSuccessMessage(message) {
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(successMsg);
        
        // Add animation
        setTimeout(() => successMsg.classList.add('fade-in'), 10);
        
        // Auto remove after delay
        setTimeout(() => {
            successMsg.classList.add('fade-out');
            setTimeout(() => successMsg.remove(), 300);
        }, 3000);
    }
}); 