document.addEventListener('DOMContentLoaded', () => {
    console.log('Account page loaded');

    const addAccountBtn = document.getElementById('addAccountBtn');
    const accountModal = document.getElementById('accountModal');
    const modalContent = accountModal.querySelector('.modal-content');
    const modalHeader = accountModal.querySelector('.modal-header');
    const closeAccountModal = document.getElementById('closeAccountModal');
    const saveAccountBtn = document.getElementById('saveAccountBtn');
    const cancelAccountBtn = document.getElementById('cancelAccountBtn');
    const accountTable = document.getElementById('accountTable').getElementsByTagName('tbody')[0];
    const draggableContainer = document.getElementById('draggableContainer');

    // Add custom styles for double-click indicator
    const style = document.createElement('style');
    style.textContent = `
        .account-row {
            position: relative;
            transition: all 0.2s ease;
        }
        
        .account-row::after {
            content: 'Double-click to view stock';
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
        
        .account-row:hover::after {
            opacity: 0.7;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .account-row:active {
            animation: pulse 0.3s;
        }
    `;
    document.head.appendChild(style);

    let accounts = [];
    let editingAccount = null;

    // Enhanced dragging functionality for main container
    let mainIsDragging = false;
    let mainStartX;
    let mainStartY;
    let mainScrollLeft;
    let mainScrollTop;

    draggableContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, a, .modal, .table-container')) return;
        
        mainIsDragging = true;
        draggableContainer.classList.add('dragging');
        mainStartX = e.pageX - draggableContainer.offsetLeft;
        mainStartY = e.pageY - draggableContainer.offsetTop;
        mainScrollLeft = draggableContainer.scrollLeft;
        mainScrollTop = draggableContainer.scrollTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (!mainIsDragging) return;

        e.preventDefault();
        const x = e.pageX - draggableContainer.offsetLeft;
        const y = e.pageY - draggableContainer.offsetTop;
        const walkX = (x - mainStartX) * 2; // Increased sensitivity
        const walkY = (y - mainStartY) * 2;
        draggableContainer.scrollLeft = mainScrollLeft - walkX;
        draggableContainer.scrollTop = mainScrollTop - walkY;
    });

    document.addEventListener('mouseup', () => {
        mainIsDragging = false;
        draggableContainer.classList.remove('dragging');
    });

    // Prevent drag on interactive elements
    const interactiveElements = draggableContainer.querySelectorAll('button, input, select, a');
    interactiveElements.forEach(element => {
        element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    });

    // Enhanced modal dragging functionality
    let modalIsDragging = false;
    let modalCurrentX;
    let modalCurrentY;
    let modalInitialX;
    let modalInitialY;
    let modalXOffset = 0;
    let modalYOffset = 0;

    modalHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('button')) return;
        
        modalInitialX = e.clientX - modalXOffset;
        modalInitialY = e.clientY - modalYOffset;

        if (e.target === modalHeader || e.target.parentNode === modalHeader) {
            modalIsDragging = true;
            modalContent.classList.add('dragging');
        }
    }

    function drag(e) {
        if (modalIsDragging) {
            e.preventDefault();
            modalCurrentX = e.clientX - modalInitialX;
            modalCurrentY = e.clientY - modalInitialY;

            // Add bounds checking
            const bounds = {
                left: 0,
                top: 0,
                right: window.innerWidth - modalContent.offsetWidth,
                bottom: window.innerHeight - modalContent.offsetHeight
            };

            modalXOffset = Math.min(Math.max(modalCurrentX, bounds.left), bounds.right);
            modalYOffset = Math.min(Math.max(modalCurrentY, bounds.top), bounds.bottom);

            setTranslate(modalXOffset, modalYOffset, modalContent);
        }
    }

    function dragEnd(e) {
        modalInitialX = modalCurrentX;
        modalInitialY = modalCurrentY;
        modalIsDragging = false;
        modalContent.classList.remove('dragging');
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    // Reset modal position when opening
    function resetModalPosition() {
        modalXOffset = 0;
        modalYOffset = 0;
        modalContent.style.transform = 'translate(0px, 0px)';
    }

    // Load existing accounts when page loads
    loadAccounts();

    // Show a tooltip indicating double-click functionality
    function showDoubleClickTip() {
        // Create and style the tooltip
        const tooltip = document.createElement('div');
        tooltip.textContent = '💡 Tip: Double-click any row to view customer stock details';
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

    // Show the double-click tip after accounts are loaded
    setTimeout(showDoubleClickTip, 2000);

    function loadAccounts() {
        fetch('/api/accounts')
            .then(response => response.json())
            .then(data => {
                accounts = data;
                renderAccounts();
            })
            .catch(error => console.error('Error loading accounts:', error));
    }

    addAccountBtn.addEventListener('click', () => {
        editingAccount = null;
        accountModal.style.display = 'block';
        resetModalPosition();
    });

    closeAccountModal.addEventListener('click', () => {
        accountModal.style.display = 'none';
        resetModalPosition();
        clearForm();
    });

    cancelAccountBtn.addEventListener('click', () => {
        accountModal.style.display = 'none';
        resetModalPosition();
        clearForm();
    });

    saveAccountBtn.addEventListener('click', () => {
        const name = document.getElementById('customerName').value;
        const address = document.getElementById('customerAddress').value;
        const mobile = document.getElementById('customerMobile').value;
        const email = document.getElementById('customerEmail').value;

        if (!name.trim()) {
            alert('Please enter customer name');
            return;
        }
        
        // Check for duplicate account name
        const isDuplicate = editingAccount 
            ? accounts.some(a => a.id !== editingAccount.id && a.name.toLowerCase() === name.toLowerCase())
            : accounts.some(a => a.name.toLowerCase() === name.toLowerCase());
            
        if (isDuplicate) {
            alert(`An account with the name "${name}" already exists. Please use a different name.`);
            return;
        }

        const accountData = { name, address, mobile, email };
        
        if (editingAccount) {
            // Update existing account
            fetch(`/api/accounts/${editingAccount.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            })
            .then(response => response.json())
            .then(() => {
                loadAccounts(); // Reload all accounts
                clearForm();
                accountModal.style.display = 'none';
            })
            .catch(error => console.error('Error updating account:', error));
        } else {
            // Create new account
            fetch('/api/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            })
            .then(response => response.json())
            .then(() => {
                loadAccounts(); // Reload all accounts
                clearForm();
                accountModal.style.display = 'none';
            })
            .catch(error => console.error('Error saving account:', error));
        }
    });

    function renderAccounts() {
        accountTable.innerHTML = '';
        accounts.forEach(account => {
            const row = accountTable.insertRow();
            
            // Make the entire row double-clickable
            row.classList.add('account-row');
            row.style.cursor = 'pointer';
            row.setAttribute('data-customer-name', account.name);
            
            row.addEventListener('dblclick', function() {
                window.location.href = `/pages/customer-stock.html?name=${encodeURIComponent(account.name)}`;
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
            
            // Add cells to the row
            row.insertCell(0).innerHTML = `<a href="/pages/customer-stock.html?name=${encodeURIComponent(account.name)}" class="customer-link" style="color: blue; text-decoration: underline; cursor: pointer;">${account.name}</a>`;
            row.insertCell(1).textContent = account.address;
            row.insertCell(2).textContent = account.mobile;
            row.insertCell(3).textContent = account.email;
            const actionsCell = row.insertCell(4);
            actionsCell.innerHTML = `
                <button onclick="editAccount(${account.id})">Edit</button>
                <button onclick="deleteAccount(${account.id})">Delete</button>
            `;
            
            // Stop propagation of click events on buttons and links to prevent row click
            const actionButtons = actionsCell.querySelectorAll('button');
            actionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });
            
            const customerLink = row.querySelector('.customer-link');
            if (customerLink) {
                customerLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        });
    }

    window.editAccount = function(accountId) {
        const account = accounts.find(a => a.id === accountId);
        if (account) {
            editingAccount = account;
            document.getElementById('customerName').value = account.name;
            document.getElementById('customerAddress').value = account.address || '';
            document.getElementById('customerMobile').value = account.mobile || '';
            document.getElementById('customerEmail').value = account.email || '';
            accountModal.style.display = 'block';
        }
    };

    window.deleteAccount = function(accountId) {
        if (confirm('Are you sure you want to delete this account?')) {
            fetch(`/api/accounts/${accountId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(() => {
                loadAccounts(); // Reload all accounts
            })
            .catch(error => console.error('Error deleting account:', error));
        }
    };

    function clearForm() {
        document.getElementById('customerName').value = '';
        document.getElementById('customerAddress').value = '';
        document.getElementById('customerMobile').value = '';
        document.getElementById('customerEmail').value = '';
        editingAccount = null;
    }
});