document.addEventListener('DOMContentLoaded', () => {
    console.log('Purchases page loaded');

    const addPurchaseBtn = document.getElementById('addPurchaseBtn');
    const purchaseModal = document.getElementById('purchaseModal');
    const modalContent = purchaseModal.querySelector('.modal-content');
    const modalHeader = purchaseModal.querySelector('.modal-header');
    const closePurchaseModal = document.getElementById('closePurchaseModal');
    const savePurchaseBtn = document.getElementById('savePurchaseBtn');
    const cancelPurchaseBtn = document.getElementById('cancelPurchaseBtn');
    const purchasesTable = document.getElementById('purchasesTable').getElementsByTagName('tbody')[0];
    const draggableContainer = document.getElementById('draggableContainer');

    let purchases = [];
    let editingPurchase = null;
    let accounts = [];
    let products = [];
    let productEntries = []; // Array to track additional product entries

    // Check if we should open a specific purchase for editing (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const editPurchaseId = urlParams.get('edit');

    // Main container dragging functionality
    let mainIsDragging = false;
    let mainStartX;
    let mainStartY;
    let mainScrollLeft;
    let mainScrollTop;

    draggableContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, a')) return;
        
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
        const walkX = (x - mainStartX);
        const walkY = (y - mainStartY);
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

    // Modal dragging functionality
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

            modalXOffset = modalCurrentX;
            modalYOffset = modalCurrentY;

            setTranslate(modalCurrentX, modalCurrentY, modalContent);
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

    // Load data
    loadPurchases().then(() => {
        // After purchases are loaded, check if we need to open a specific purchase for editing
        if (editPurchaseId) {
            const purchaseIdNum = parseInt(editPurchaseId, 10);
            if (!isNaN(purchaseIdNum)) {
                window.editPurchase(purchaseIdNum);
            }
        }
    });
    setupAccountAutocomplete();
    setupProductAutocomplete();
    setupTransporterAutocomplete();
    setupMultiProductForm(); // Setup multi-product functionality

    function loadPurchases() {
        // Get the current financial year
        const currentFY = getCurrentFinancialYear();
        
        // First load transporters
        return fetch('/api/transporters')
            .then(response => response.json())
            .then(data => {
                // Store transporters data globally
                window.transporters = data;
                
                // Then load purchases with financial year filter
                let url = '/api/purchases';
                if (currentFY) {
                    url = `/api/purchases?financialYearId=${encodeURIComponent(currentFY.id)}`;
                }
                
                return fetch(url);
            })
            .then(response => response.json())
            .then(data => {
                purchases = data;
                renderPurchases();
                
                // Update financial year display if element exists
                const fyDisplay = document.getElementById('currentFinancialYearDisplay');
                if (fyDisplay && currentFY) {
                    fyDisplay.textContent = `Financial Year: ${currentFY.label}`;
                    fyDisplay.style.display = 'block';
                }
                
                return data;
            })
            .catch(error => {
                console.error('Error loading data:', error);
                return [];
            });
    }

    // Add async getNextInvoiceNumber function
    async function getNextInvoiceNumber() {
        // Get the current financial year
        const currentFY = getCurrentFinancialYear();
        
        try {
            // Call the server API to get the next invoice number for this financial year
            const response = await fetch(`/api/next-invoice-number?type=purchases&financialYearId=${currentFY ? currentFY.id : ''}`);
            if (!response.ok) {
                throw new Error('Failed to get next invoice number');
            }
            
            const data = await response.json();
            return data.invoiceNo.toString().padStart(4, '0');
        } catch (error) {
            console.error('Error getting next invoice number:', error);
            
            // Fallback to client-side calculation if server API fails
            if (purchases.length === 0) return '0001';
            
            // Filter purchases by current financial year
            let relevantPurchases = purchases;
            if (currentFY) {
                relevantPurchases = purchases.filter(purchase => 
                    purchase.financial_year_id === currentFY.id || 
                    isDateInCurrentFinancialYear(purchase.date)
                );
            }
            
            const maxInvoice = relevantPurchases.reduce((max, purchase) => {
                const num = parseInt(purchase.invoiceNo);
                return num > max ? num : max;
            }, 0);
            
            return (maxInvoice + 1).toString().padStart(4, '0');
        }
    }

    addPurchaseBtn.addEventListener('click', async () => {
        editingPurchase = null;
        // Clear form first
        clearForm();
        
        // Auto-fill invoice number
        try {
            const nextInvoiceNo = await getNextInvoiceNumber();
            document.getElementById('invoiceNo').value = nextInvoiceNo;
        } catch (error) {
            console.error('Error getting next invoice number:', error);
            document.getElementById('invoiceNo').value = '';
        }
        
        // Auto-fill current date
        setTodayDate();
        
        resetModalPosition();
        purchaseModal.style.display = 'block';
    });

    closePurchaseModal.addEventListener('click', () => {
        purchaseModal.style.display = 'none';
        resetModalPosition();
        clearForm();
    });

    cancelPurchaseBtn.addEventListener('click', () => {
        purchaseModal.style.display = 'none';
        resetModalPosition();
        clearForm();
    });

    savePurchaseBtn.addEventListener('click', () => {
        // Get current financial year
        const currentFY = getCurrentFinancialYear();
        
        // Get common data for all products
        const commonData = {
            invoiceNo: document.getElementById('invoiceNo').value,
            date: document.getElementById('purchaseDate').value,
            accountName: document.getElementById('accountName').value,
            shipToAddress: document.getElementById('shipToAddress').value,
            transporterName: document.getElementById('transporterName').value,
            transporterFare: parseFloat(document.getElementById('transporterFare').value) || 0,
            container: document.getElementById('container').value,
            paymentOption: document.getElementById('paymentOption').value,
            remark: '', // Add remark field if needed
            financial_year_id: currentFY ? currentFY.id : null
        };

        // Validate required fields
        if (!commonData.invoiceNo.trim() || !commonData.date.trim() || !commonData.accountName.trim()) {
            alert('Please fill in all required fields (Invoice No, Date, Account Name)');
            return;
        }
        
        // Check for duplicate invoice number for the same account
        // Skip this check when editing an existing purchase
        if (!editingPurchase) {
            const isDuplicate = purchases.some(p => 
                p.invoiceNo === commonData.invoiceNo && 
                p.accountName.toLowerCase() === commonData.accountName.toLowerCase() &&
                (currentFY ? p.financial_year_id === currentFY.id : true)
            );
            
            if (isDuplicate) {
                alert(`A purchase with invoice number "${commonData.invoiceNo}" for account "${commonData.accountName}" already exists. Please use a different invoice number.`);
                return;
            }
        } else {
            // If editing, make sure we don't have a duplicate if the invoice number or account name was changed
            const originalInvoice = editingPurchase.invoiceNo;
            const originalAccount = editingPurchase.accountName;
            
            if (originalInvoice !== commonData.invoiceNo || originalAccount.toLowerCase() !== commonData.accountName.toLowerCase()) {
                const isDuplicate = purchases.some(p => 
                    p.id !== editingPurchase.id &&
                    p.invoiceNo === commonData.invoiceNo && 
                    p.accountName.toLowerCase() === commonData.accountName.toLowerCase() &&
                    (currentFY ? p.financial_year_id === currentFY.id : true)
                );
                
                if (isDuplicate) {
                    alert(`A purchase with invoice number "${commonData.invoiceNo}" for account "${commonData.accountName}" already exists. Please use a different invoice number or account.`);
                    return;
                }
            }
        }

        // Get product-specific data
        const productData = [];
        
        // Get data from the first (main) product
        const mainProduct = {
            productName: document.getElementById('productName').value,
            supplyQty: parseInt(document.getElementById('supplyQty').value) || 0,
            receivedQty: parseInt(document.getElementById('receivedQty').value) || 0
        };
        
        // Validate main product
        if (!mainProduct.productName.trim()) {
            alert('Please enter a product name');
            return;
        }
        
        productData.push(mainProduct);
        
        // Get data from additional product entries
        productEntries.forEach(entry => {
            const entryId = entry.id;
            const productNameField = document.getElementById(`productName_${entryId}`);
            const supplyQtyField = document.getElementById(`supplyQty_${entryId}`);
            const receivedQtyField = document.getElementById(`receivedQty_${entryId}`);
            
            if (productNameField && productNameField.value.trim() !== '') {
                productData.push({
                    productName: productNameField.value,
                    supplyQty: parseInt(supplyQtyField.value) || 0,
                    receivedQty: parseInt(receivedQtyField.value) || 0
                });
            }
        });

        // Show loading state
        savePurchaseBtn.disabled = true;
        savePurchaseBtn.textContent = 'Saving...';

        // Check if editing or creating new
        if (editingPurchase) {
            // Find all existing purchases with the same invoice number
            const relatedPurchases = purchases.filter(p => p.invoiceNo === editingPurchase.invoiceNo);
            
            // For multi-product existing purchases, we need to:
            // 1. Update the first product
            // 2. Delete any additional products that aren't needed anymore
            // 3. Create new products if there are more products now than before
            
            // First, update the main product
            const firstProductData = {
                ...commonData,
                ...productData[0]
            };
            
            fetch(`/api/purchases/${editingPurchase.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(firstProductData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(async () => {
                // If there were additional purchases but we now have fewer products,
                // delete the extra ones (keep as many as we need)
                const additionalExistingPurchases = relatedPurchases.filter(p => p.id !== editingPurchase.id);
                
                // Delete any excess purchases
                if (additionalExistingPurchases.length > (productData.length - 1)) {
                    const purchasesToDelete = additionalExistingPurchases.slice(productData.length - 1);
                    
                    for (const purchaseToDelete of purchasesToDelete) {
                        await fetch(`/api/purchases/${purchaseToDelete.id}`, {
                            method: 'DELETE'
                        });
                    }
                }
                
                // Update existing additional purchases and create new ones if needed
                if (productData.length > 1) {
                    for (let i = 1; i < productData.length; i++) {
                        const additionalProductData = {
                            ...commonData,
                            ...productData[i],
                            // Set transporterFare to 0 for additional products to avoid double counting
                            transporterFare: 0
                        };

                        // If we have an existing purchase to update
                        if (i - 1 < additionalExistingPurchases.length) {
                            // Update existing purchase
                            await fetch(`/api/purchases/${additionalExistingPurchases[i - 1].id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(additionalProductData)
                            });
                        } else {
                            // Create new purchase for this product
                            await fetch('/api/purchases', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(additionalProductData)
                            });
                        }
                    }
                }
                
                loadPurchases(); // Reload all purchases
                clearForm();
                purchaseModal.style.display = 'none';
                
                // Show success message
                showSuccessMessage(`Purchase ${editingPurchase ? 'updated' : 'added'} successfully!`);
            })
            .catch(error => {
                console.error('Error saving purchase:', error);
                alert('Error saving purchase. Please try again.');
            })
            .finally(() => {
                // Reset button state
                savePurchaseBtn.disabled = false;
                savePurchaseBtn.textContent = 'Save';
            });
        } else {
            // Create new purchases for all products
            Promise.all(productData.map((product, index) => {
                // For all products after the first one, set transporterFare to 0 to avoid double counting
                const purchaseData = {
                    ...commonData,
                    ...product,
                    transporterFare: index === 0 ? commonData.transporterFare : 0
                };
                
                return fetch('/api/purchases', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(purchaseData)
                });
            }))
            .then(() => {
                loadPurchases(); // Reload all purchases
                clearForm();
                purchaseModal.style.display = 'none';
                
                // Show success message
                showSuccessMessage("Purchase added successfully!");
            })
            .catch(error => {
                console.error('Error saving purchase:', error);
                alert('Error saving multi-product purchase. Please try again.');
            })
            .finally(() => {
                // Reset button state
                savePurchaseBtn.disabled = false;
                savePurchaseBtn.textContent = 'Save';
            });
        }
    });

    function renderPurchases() {
        purchasesTable.innerHTML = '';
        
        // Group purchases by invoice number
        const purchasesByInvoice = {};
        purchases.forEach(purchase => {
            if (!purchasesByInvoice[purchase.invoiceNo]) {
                purchasesByInvoice[purchase.invoiceNo] = [];
            }
            purchasesByInvoice[purchase.invoiceNo].push(purchase);
        });
        
        // Render each invoice group
        Object.values(purchasesByInvoice).forEach(invoiceGroup => {
            // Sort by ID to maintain original order
            invoiceGroup.sort((a, b) => a.id - b.id);
            
            // Render each purchase in the group
            invoiceGroup.forEach((purchase, index) => {
                const row = purchasesTable.insertRow();
                const isFirstRow = index === 0;
                
                // Set classes for styling based on whether it's a multi-product purchase
                if (invoiceGroup.length > 1) {
                    if (isFirstRow) {
                        row.classList.add('multi-product-row', 'first-product-row');
                    } else {
                        row.classList.add('multi-product-row', 'additional-product-row');
                    }
                }
                
                // Add data attribute to identify purchases from the same invoice
                row.dataset.invoiceNo = purchase.invoiceNo;
                
                // Insert cells with appropriate styling for multi-product rows
                const cells = [
                    { 
                        content: purchase.invoiceNo, 
                        dimIfAdditional: true,
                        style: isFirstRow ? 'font-weight: 500; color: var(--primary-color);' : 'color: #999;'
                    },
                    { 
                        content: purchase.date, 
                        dimIfAdditional: true,
                        style: !isFirstRow ? 'color: #999; font-style: italic;' : ''
                    },
                    { 
                        content: purchase.accountName, 
                        dimIfAdditional: true,
                        style: !isFirstRow ? 'color: #999; font-style: italic;' : ''
                    },
                    { 
                        content: purchase.shipToAddress || '-', 
                        dimIfAdditional: true,
                        style: !isFirstRow ? 'color: #999; font-style: italic;' : ''
                    },
                    { content: purchase.productName, dimIfAdditional: false }, // Product fields don't dim
                    { content: purchase.supplyQty || '0', dimIfAdditional: false },
                    { content: purchase.receivedQty || '0', dimIfAdditional: false },
                    // Find transporter details
                    { 
                        content: window.transporters ? 
                            `<div style="color: ${isFirstRow ? '#333' : '#999'};">
                                <div>${purchase.transporterName || '-'}</div>
                                <div style="font-size: 12px; color: ${isFirstRow ? '#666' : '#aaa'};">
                                    ${window.transporters.find(t => t.name === purchase.transporterName)?.mobile || ''}
                                </div>
                            </div>` : (purchase.transporterName || '-'),
                        dimIfAdditional: true 
                    },
                    // Only show fare on first row
                    { 
                        content: isFirstRow ? `₹${purchase.transporterFare || 0}` : '-', 
                        dimIfAdditional: false,
                        style: isFirstRow ? 'color: #333;' : 'color: #999; font-style: italic;'
                    },
                    { 
                        content: purchase.container || '-', 
                        dimIfAdditional: true,
                        style: !isFirstRow ? 'color: #999; font-style: italic;' : ''
                    },
                    { 
                        content: purchase.paymentOption || 'Cash', 
                        dimIfAdditional: true,
                        style: !isFirstRow ? 'color: #999; font-style: italic;' : ''
                    }
                ];
                
                // Add each cell to the row
                cells.forEach((cellData, idx) => {
                    const cell = row.insertCell();
                    cell.innerHTML = cellData.content;
                    
                    // Apply dimming style for additional product rows
                    if (!isFirstRow && cellData.dimIfAdditional) {
                        cell.classList.add('dimmed-cell');
                    }
                    
                    // Apply custom style if provided
                    if (cellData.style) {
                        cell.style = cellData.style;
                    }
                });
                
                // Add action buttons
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = `
                    <button class="edit-btn" onclick="editPurchase(${purchase.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="deletePurchase(${purchase.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            });
        });
        
        // Add CSS for multi-product rows if not already added
        addMultiProductStyles();
    }

    // Add CSS for multi-product rows
    function addMultiProductStyles() {
        if (!document.getElementById('multi-product-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'multi-product-styles';
            styleSheet.innerHTML = `
                /* Visual indicator for grouped products */
                .first-product-row td:first-child {
                    position: relative;
                }
                
                .first-product-row td:first-child::before {
                    content: '\\f07e';
                    font-family: 'Font Awesome 5 Free';
                    font-weight: 900;
                    position: absolute;
                    left: -10px;
                    color: var(--primary-color);
                    font-size: 12px;
                }
                
                /* Hover effect for groups */
                tr[data-invoice-no]:hover {
                    background-color: rgba(0,0,0,0.05);
                }
                
                /* Styling for dimmed cells */
                .dimmed-cell {
                    color: rgba(0, 0, 0, 0.5);
                    font-style: italic;
                }
                
                /* Styling for multi-product rows */
                .multi-product-row.first-product-row {
                    border-bottom: none;
                }
                
                .multi-product-row.additional-product-row {
                    border-top: 1px dashed rgba(0, 0, 0, 0.1);
                }
                
                /* Hide duplicate info visually */
                .multi-product-row.additional-product-row td.dimmed-cell {
                    color: #999;
                }
                
                /* Enhance hover effects for grouped rows */
                tr[data-invoice-no] {
                    transition: background-color 0.2s ease;
                }
                
                /* Highlight all rows with same invoice number on hover */
                tr[data-invoice-no]:hover + tr[data-invoice-no],
                tr[data-invoice-no]:hover ~ tr[data-invoice-no] {
                    background-color: rgba(0,0,0,0.03);
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    function clearForm() {
        document.getElementById('invoiceNo').value = '';
        document.getElementById('purchaseDate').value = '';
        document.getElementById('accountName').value = '';
        document.getElementById('shipToAddress').value = '';
        document.getElementById('productName').value = '';
        document.getElementById('supplyQty').value = '';
        document.getElementById('receivedQty').value = '';
        document.getElementById('transporterName').value = '';
        document.getElementById('transporterFare').value = '';
        document.getElementById('container').value = '';
        document.getElementById('paymentOption').value = 'cash';
        
        // Clear additional product entries
        const productEntriesContainer = document.getElementById('additionalProductsContainer');
        if (productEntriesContainer) {
            productEntriesContainer.innerHTML = '';
        }
        productEntries = [];
        
        editingPurchase = null;
        
        // Set today's date automatically
        setTodayDate();
    }
    
    // Helper function to set today's date in the date field
    function setTodayDate() {
        const today = new Date();
        const dateInput = document.getElementById('purchaseDate');
        
        // Set using both methods for maximum compatibility
        dateInput.valueAsDate = today;
        
        // Also set as formatted string in YYYY-MM-DD format
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
    
    // Helper function to format any date in YYYY-MM-DD format
    function formatDateYYYYMMDD(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return date; // Return original if invalid
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    window.editPurchase = function(purchaseId) {
        // Find the purchase to edit
        const targetPurchase = purchases.find(p => p.id === purchaseId);
        if (!targetPurchase) return;
        
        // Find all purchases with the same invoice number
        const relatedPurchases = purchases.filter(p => p.invoiceNo === targetPurchase.invoiceNo);
        
        // Sort by ID to maintain original order
        relatedPurchases.sort((a, b) => a.id - b.id);
        
        // Clear any existing product entries
        const productEntriesContainer = document.getElementById('additionalProductsContainer');
        if (productEntriesContainer) {
            productEntriesContainer.innerHTML = '';
        }
        productEntries = [];
        
        // Set the main purchase as the one we're editing (first purchase in the invoice)
        editingPurchase = relatedPurchases[0];
        
        // Populate form with common data from the first purchase
        document.getElementById('invoiceNo').value = editingPurchase.invoiceNo;
        
        // Set the date with proper formatting
        const purchaseDateInput = document.getElementById('purchaseDate');
        if (editingPurchase.date) {
            try {
                // Try to parse the date
                const dateObj = new Date(editingPurchase.date);
                
                // If it's a valid date, format it correctly
                if (!isNaN(dateObj.getTime())) {
                    purchaseDateInput.valueAsDate = dateObj;
                    purchaseDateInput.value = formatDateYYYYMMDD(dateObj);
                } else {
                    // Try parsing with different formats
                    const parts = editingPurchase.date.split(/[-/]/);
                    if (parts.length === 3) {
                        // Try different date formats (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY)
                        let validDate = null;
                        
                        // Format 1: YYYY-MM-DD
                        if (parts[0].length === 4) {
                            validDate = new Date(parts[0], parts[1] - 1, parts[2]);
                        } 
                        // Format 2: MM/DD/YYYY
                        else if (!validDate || isNaN(validDate.getTime())) {
                            validDate = new Date(parts[2], parts[0] - 1, parts[1]);
                        }
                        // Format 3: DD/MM/YYYY
                        if (!validDate || isNaN(validDate.getTime())) {
                            validDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                        
                        if (validDate && !isNaN(validDate.getTime())) {
                            purchaseDateInput.valueAsDate = validDate;
                            purchaseDateInput.value = formatDateYYYYMMDD(validDate);
                        } else {
                            // If all parsing fails, use today's date
                            setTodayDate();
                        }
                    } else {
                        // If no clear format, default to today
                        setTodayDate();
                    }
                }
            } catch (e) {
                console.error('Error parsing date:', e);
                // Default to today if there's an error
                setTodayDate();
            }
        } else {
            // Default to today if no date
            setTodayDate();
        }
        
        document.getElementById('accountName').value = editingPurchase.accountName;
        document.getElementById('shipToAddress').value = editingPurchase.shipToAddress || '';
        document.getElementById('transporterName').value = editingPurchase.transporterName || '';
        document.getElementById('transporterFare').value = editingPurchase.transporterFare || '';
        document.getElementById('container').value = editingPurchase.container || '';
        document.getElementById('paymentOption').value = editingPurchase.paymentOption || 'cash';
        
        // Populate the main product fields with data from the clicked purchase
        document.getElementById('productName').value = targetPurchase.productName;
        document.getElementById('supplyQty').value = targetPurchase.supplyQty || '';
        document.getElementById('receivedQty').value = targetPurchase.receivedQty || '';
        
        // If there are additional purchases with the same invoice, add them as additional products
        if (relatedPurchases.length > 1) {
            for (let i = 0; i < relatedPurchases.length; i++) {
                // Skip the purchase we're already displaying as the main product
                if (relatedPurchases[i].id === targetPurchase.id) continue;
                
                addProductEntry({
                    productName: relatedPurchases[i].productName,
                    supplyQty: relatedPurchases[i].supplyQty || '',
                    receivedQty: relatedPurchases[i].receivedQty || ''
                });
            }
        }
        
        resetModalPosition();
        purchaseModal.style.display = 'flex';
    };

    window.deletePurchase = function(purchaseId) {
        const purchaseToDelete = purchases.find(p => p.id === purchaseId);
        if (!purchaseToDelete) return;
        
        // Find if there are other purchases with the same invoice
        const relatedPurchases = purchases.filter(p => p.invoiceNo === purchaseToDelete.invoiceNo);
        
        if (relatedPurchases.length > 1) {
            // If it's a multi-product purchase, ask if they want to delete just this product or the entire invoice
            const deleteOptions = confirm(
                `This purchase has multiple products under invoice #${purchaseToDelete.invoiceNo}.\n\n` +
                'Click "OK" to delete only this product.\n' +
                'Click "Cancel" then confirm to delete the entire invoice with all products.'
            );
            
            if (deleteOptions) {
                // Delete just this product
                deleteAndReloadPurchase(purchaseId);
            } else {
                // Confirm deletion of the entire invoice
                if (confirm(`Are you sure you want to delete the entire invoice #${purchaseToDelete.invoiceNo} with all its products?`)) {
                    // Delete all products with this invoice number
                    Promise.all(relatedPurchases.map(purchase => 
                        fetch(`/api/purchases/${purchase.id}`, { method: 'DELETE' })
                    ))
                    .then(() => {
                        loadPurchases(); // Reload all purchases
                        showSuccessMessage(`Invoice #${purchaseToDelete.invoiceNo} deleted successfully`);
                    })
                    .catch(error => {
                        console.error('Error deleting invoice:', error);
                        showErrorMessage("Failed to delete invoice. Please try again.");
                    });
                }
            }
        } else {
            // Regular single product purchase - confirm and delete
            if (confirm('Are you sure you want to delete this purchase?')) {
                deleteAndReloadPurchase(purchaseId);
            }
        }
    };

    function deleteAndReloadPurchase(purchaseId) {
        fetch(`/api/purchases/${purchaseId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(() => {
            loadPurchases(); // Reload all purchases
            showSuccessMessage("Purchase deleted successfully!");
        })
        .catch(error => {
            console.error('Error deleting purchase:', error);
            showErrorMessage("Failed to delete purchase. Please try again.");
        });
    }

    // Setup the multi-product form functionality
    function setupMultiProductForm() {
        // Get the Add Product button and the container for additional products
        const addProductButton = document.getElementById('addProductButton');
        const additionalProductsContainer = document.getElementById('additionalProductsContainer');
        
        if (!addProductButton || !additionalProductsContainer) return;
        
        // Add event listener to the Add Product button
        addProductButton.addEventListener('click', () => {
            addProductEntry();
        });
    }

    // Function to add a new product entry to the form
    function addProductEntry(productData = null) {
        const container = document.getElementById('additionalProductsContainer');
        if (!container) return;
        
        const entryId = Date.now(); // Use timestamp as unique ID
        
        const productEntry = document.createElement('div');
        productEntry.className = 'product-entry';
        productEntry.dataset.entryId = entryId;
        
        productEntry.innerHTML = `
            <button type="button" class="remove-product" data-entry-id="${entryId}">
                <i class="fas fa-times"></i>
            </button>
            <div>
                <label for="productName_${entryId}">Product Name</label>
                <input type="text" id="productName_${entryId}" class="product-name-input" 
                    value="${productData ? productData.productName : ''}" required>
            </div>
            <div>
                <label for="supplyQty_${entryId}">Supply Qty</label>
                <input type="number" id="supplyQty_${entryId}" 
                    value="${productData ? productData.supplyQty : ''}" required>
            </div>
            <div>
                <label for="receivedQty_${entryId}">Received Qty</label>
                <input type="number" id="receivedQty_${entryId}" 
                    value="${productData ? productData.receivedQty : ''}">
            </div>
        `;
        
        container.appendChild(productEntry);
        
        // Add to tracking array
        productEntries.push({ id: entryId });
        
        // Setup product autocomplete for this entry
        const productInput = document.getElementById(`productName_${entryId}`);
        if (productInput) {
            productInput.addEventListener('click', () => {
                // Show product popup for this specific input
                showProductPopup(productInput);
            });
        }
        
        // Setup remove button handler
        const removeButton = productEntry.querySelector('.remove-product');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                container.removeChild(productEntry);
                // Remove from tracking array
                productEntries = productEntries.filter(entry => entry.id !== entryId);
            });
        }
    }

    // Function to show product popup for a specific input
    function showProductPopup(inputElement) {
        // Reuse product popup code, but target the specific input
        const productPopup = document.querySelector('.product-popup');
        const overlay = document.querySelector('.product-popup + div');
        
        if (!productPopup || !overlay) return;
        
        // Store the current target input to update when a product is selected
        productPopup.dataset.targetInput = inputElement.id;
        
        // Ensure popup appears on top by setting higher z-index
        productPopup.style.zIndex = "9999";
        overlay.style.zIndex = "9998";
        
        overlay.style.display = 'block';
        productPopup.style.display = 'block';
        
        // Focus search
        const searchInput = productPopup.querySelector('input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
            
            // Trigger input event to load products
            const event = new Event('input');
            searchInput.dispatchEvent(event);
        }
    }

    // Modify product selection handling to work with dynamic product inputs
    document.addEventListener('click', function(e) {
        // Find if the click was on a product item
        const productItem = e.target.closest('.product-item');
        
        if (productItem && productItem.querySelector('div:first-child')) {
            const popup = document.querySelector('.product-popup');
            
            if (popup && popup.dataset.targetInput) {
                // Get the target input ID from the popup data attribute
                const targetInputId = popup.dataset.targetInput;
                const targetInput = document.getElementById(targetInputId);
                
                if (targetInput) {
                    // Get product name from the clicked item
                    const productName = productItem.querySelector('div:first-child div:first-child').textContent;
                    targetInput.value = productName;
                    
                    // Hide popup
                    const overlay = document.querySelector('.product-popup + div');
                    if (overlay) overlay.style.display = 'none';
                    popup.style.display = 'none';
                }
            }
        }
    });

    // Show success message
    function showSuccessMessage(message) {
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.textContent = message;
        document.body.appendChild(successMsg);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(successMsg)) {
                document.body.removeChild(successMsg);
            }
        }, 3000);
    }

    // Show error message
    function showErrorMessage(message) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(145deg, #ff4444, #cc0000);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 1000;
            animation: fadeOut 3s forwards;
            box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
        `;
        errorMsg.textContent = message;
        document.body.appendChild(errorMsg);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(errorMsg)) {
                document.body.removeChild(errorMsg);
            }
        }, 3000);
    }

    function setupAccountAutocomplete() {
        const accountInput = document.getElementById('accountName');
        const accountPopup = document.createElement('div');
        accountPopup.className = 'account-popup';
        accountPopup.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            max-height: 80vh;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            padding: 16px;
        `;

        // Create popup header
        const popupHeader = document.createElement('div');
        popupHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
        `;
        
        const popupTitle = document.createElement('h3');
        popupTitle.textContent = 'Select Account';
        popupTitle.style.margin = '0';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            border: none;
            background: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0 8px;
            color: #666;
        `;

        popupHeader.appendChild(popupTitle);
        popupHeader.appendChild(closeButton);

        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.style.marginBottom = '16px';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search accounts...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
        `;
        
        searchContainer.appendChild(searchInput);

        // Create accounts container
        const accountsContainer = document.createElement('div');
        accountsContainer.style.cssText = `
            max-height: calc(80vh - 120px);
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 4px;
        `;

        // Add components to popup
        accountPopup.appendChild(popupHeader);
        accountPopup.appendChild(searchContainer);
        accountPopup.appendChild(accountsContainer);

        // Add popup to body
        document.body.appendChild(accountPopup);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9998;
        `;
        document.body.appendChild(overlay);

        function showPopup() {
            overlay.style.display = 'block';
            accountPopup.style.display = 'block';
            searchInput.value = '';
            searchInput.focus();
            loadAndDisplayAccounts();
        }

        function hidePopup() {
            overlay.style.display = 'none';
            accountPopup.style.display = 'none';
        }

        function loadAndDisplayAccounts(searchText = '') {
            fetch('/api/accounts')
                .then(response => response.json())
                .then(data => {
                    accounts = data;
                    updateAccountList(searchText);
                })
                .catch(error => console.error('Error loading accounts:', error));
        }

        function updateAccountList(searchText = '') {
            accountsContainer.innerHTML = '';
            let matchingAccounts = accounts;

            if (searchText) {
                matchingAccounts = accounts.filter(account => 
                    account.name.toLowerCase().includes(searchText.toLowerCase()) ||
                    (account.mobile && account.mobile.includes(searchText)) ||
                    (account.email && account.email.toLowerCase().includes(searchText.toLowerCase()))
                );
            }

            if (matchingAccounts.length > 0) {
                matchingAccounts.forEach(account => {
                    const accountRow = document.createElement('div');
                    accountRow.className = 'account-item';
                    accountRow.style.cssText = `
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    `;

                    const accountInfo = document.createElement('div');
                    
                    const accountName = document.createElement('div');
                    accountName.textContent = account.name;
                    accountName.style.fontWeight = 'bold';
                    
                    const accountDetails = document.createElement('div');
                    accountDetails.style.cssText = `
                        font-size: 0.9em;
                        color: #666;
                        margin-top: 4px;
                    `;

                    let details = [];
                    if (account.mobile) details.push(account.mobile);
                    if (account.email) details.push(account.email);
                    accountDetails.textContent = details.join(' • ') || 'No contact information';

                    const accountAddress = document.createElement('div');
                    accountAddress.style.cssText = `
                        font-size: 0.9em;
                        color: #666;
                        margin-top: 4px;
                    `;
                    accountAddress.textContent = account.address || 'No address';

                    accountInfo.appendChild(accountName);
                    accountInfo.appendChild(accountDetails);
                    accountInfo.appendChild(accountAddress);
                    accountRow.appendChild(accountInfo);

                    accountRow.addEventListener('mouseover', () => {
                        accountRow.style.backgroundColor = '#f0f0f0';
                    });
                    
                    accountRow.addEventListener('mouseout', () => {
                        accountRow.style.backgroundColor = 'white';
                    });

                    accountRow.addEventListener('click', () => {
                        accountInput.value = account.name;
                        document.getElementById('shipToAddress').value = account.address || '';
                        hidePopup();
                    });

                    accountsContainer.appendChild(accountRow);
                });
            } else {
                const noResults = document.createElement('div');
                noResults.style.cssText = `
                    padding: 16px;
                    text-align: center;
                    color: #666;
                    font-style: italic;
                `;
                noResults.textContent = 'No accounts found';
                accountsContainer.appendChild(noResults);
            }
        }

        // Event Listeners
        accountInput.addEventListener('click', (e) => {
            e.preventDefault();
            showPopup();
        });

        closeButton.addEventListener('click', hidePopup);
        overlay.addEventListener('click', hidePopup);

        searchInput.addEventListener('input', (e) => {
            updateAccountList(e.target.value);
        });

        // Close popup on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hidePopup();
            }
        });
    }

    function setupProductAutocomplete() {
        const productInput = document.getElementById('productName');
        const productPopup = document.createElement('div');
        productPopup.className = 'product-popup';
        productPopup.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            max-height: 80vh;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            padding: 16px;
        `;

        // Create popup header
        const popupHeader = document.createElement('div');
        popupHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
        `;
        
        const popupTitle = document.createElement('h3');
        popupTitle.textContent = 'Select Product';
        popupTitle.style.margin = '0';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            border: none;
            background: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0 8px;
            color: #666;
        `;

        popupHeader.appendChild(popupTitle);
        popupHeader.appendChild(closeButton);

        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.style.marginBottom = '16px';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search products...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
        `;
        
        searchContainer.appendChild(searchInput);

        // Create products container
        const productsContainer = document.createElement('div');
        productsContainer.style.cssText = `
            max-height: calc(80vh - 120px);
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 4px;
        `;

        // Add components to popup
        productPopup.appendChild(popupHeader);
        productPopup.appendChild(searchContainer);
        productPopup.appendChild(productsContainer);

        // Add popup to body
        document.body.appendChild(productPopup);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9998;
        `;
        document.body.appendChild(overlay);

        function showPopup() {
            overlay.style.display = 'block';
            productPopup.style.display = 'block';
            searchInput.value = '';
            searchInput.focus();
            loadAndDisplayProducts();
        }

        function hidePopup() {
            overlay.style.display = 'none';
            productPopup.style.display = 'none';
        }

        // Load and display products
        function loadAndDisplayProducts(searchText = '') {
            fetch('/api/products')
                .then(response => response.json())
                .then(data => {
                    products = data;
                    updateProductList(searchText);
                })
                .catch(error => console.error('Error loading products:', error));
        }

        function updateProductList(searchText = '') {
            productsContainer.innerHTML = '';
            let matchingProducts = products;

            if (searchText) {
                matchingProducts = products.filter(product => 
                    product.name.toLowerCase().includes(searchText.toLowerCase())
                );
            }

            if (matchingProducts.length > 0) {
                matchingProducts.forEach(product => {
                    const productRow = document.createElement('div');
                    productRow.className = 'product-item';
                    productRow.style.cssText = `
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    `;

                    const productInfo = document.createElement('div');
                    productInfo.style.cssText = `
                        flex-grow: 1;
                    `;
                    
                    const productName = document.createElement('div');
                    productName.textContent = product.name;
                    productName.style.fontWeight = 'bold';
                    
                    const productDescription = document.createElement('div');
                    productDescription.textContent = product.description || 'No description';
                    productDescription.style.cssText = `
                        font-size: 0.9em;
                        color: #666;
                    `;

                    productInfo.appendChild(productName);
                    productInfo.appendChild(productDescription);
                    productRow.appendChild(productInfo);

                    productRow.addEventListener('mouseover', () => {
                        productRow.style.backgroundColor = '#f0f0f0';
                    });
                    
                    productRow.addEventListener('mouseout', () => {
                        productRow.style.backgroundColor = 'white';
                    });

                    productRow.addEventListener('click', () => {
                        productInput.value = product.name;
                        hidePopup();
                    });

                    productsContainer.appendChild(productRow);
                });
            } else {
                const noResults = document.createElement('div');
                noResults.style.cssText = `
                    padding: 16px;
                    text-align: center;
                    color: #666;
                    font-style: italic;
                `;
                noResults.textContent = 'No products found';
                productsContainer.appendChild(noResults);
            }
        }

        // Event Listeners
        productInput.addEventListener('click', (e) => {
            e.preventDefault();
            showPopup();
        });

        closeButton.addEventListener('click', hidePopup);
        overlay.addEventListener('click', hidePopup);

        searchInput.addEventListener('input', (e) => {
            updateProductList(e.target.value);
        });

        // Close popup on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hidePopup();
            }
        });
    }

    function setupTransporterAutocomplete() {
        const transporterInput = document.getElementById('transporterName');
        const transporterPopup = document.createElement('div');
        transporterPopup.className = 'transporter-popup';
        transporterPopup.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            max-height: 80vh;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            padding: 16px;
        `;

        // Create popup header
        const popupHeader = document.createElement('div');
        popupHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
        `;
        
        const popupTitle = document.createElement('h3');
        popupTitle.textContent = 'Select Transporter';
        popupTitle.style.margin = '0';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            border: none;
            background: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0 8px;
            color: #666;
        `;

        popupHeader.appendChild(popupTitle);
        popupHeader.appendChild(closeButton);

        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.style.marginBottom = '16px';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search transporters...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
        `;
        
        searchContainer.appendChild(searchInput);

        // Create transporters container
        const transportersContainer = document.createElement('div');
        transportersContainer.style.cssText = `
            max-height: calc(80vh - 120px);
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 4px;
        `;

        // Add components to popup
        transporterPopup.appendChild(popupHeader);
        transporterPopup.appendChild(searchContainer);
        transporterPopup.appendChild(transportersContainer);

        // Add popup to body
        document.body.appendChild(transporterPopup);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9998;
        `;
        document.body.appendChild(overlay);

        function showPopup() {
            overlay.style.display = 'block';
            transporterPopup.style.display = 'block';
            searchInput.value = '';
            searchInput.focus();
            loadAndDisplayTransporters();
        }

        function hidePopup() {
            overlay.style.display = 'none';
            transporterPopup.style.display = 'none';
        }

        function loadAndDisplayTransporters(searchText = '') {
            fetch('/api/transporters')
                .then(response => response.json())
                .then(data => {
                    updateTransporterList(data, searchText);
                })
                .catch(error => console.error('Error loading transporters:', error));
        }

        function updateTransporterList(transporters, searchText = '') {
            transportersContainer.innerHTML = '';
            let matchingTransporters = transporters;

            if (searchText) {
                matchingTransporters = transporters.filter(transporter => 
                    transporter.name.toLowerCase().includes(searchText.toLowerCase()) ||
                    (transporter.mobile && transporter.mobile.includes(searchText))
                );
            }

            if (matchingTransporters.length > 0) {
                matchingTransporters.forEach(transporter => {
                    const transporterRow = document.createElement('div');
                    transporterRow.className = 'transporter-item';
                    transporterRow.style.cssText = `
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    `;

                    const transporterInfo = document.createElement('div');
                    
                    const transporterName = document.createElement('div');
                    transporterName.textContent = transporter.name;
                    transporterName.style.fontWeight = 'bold';
                    
                    const transporterDetails = document.createElement('div');
                    transporterDetails.style.cssText = `
                        font-size: 0.9em;
                        color: #666;
                        margin-top: 4px;
                    `;

                    let details = [];
                    if (transporter.mobile) details.push(transporter.mobile);
                    transporterDetails.textContent = details.join(' • ') || 'No contact information';

                    const transporterAddress = document.createElement('div');
                    transporterAddress.style.cssText = `
                        font-size: 0.9em;
                        color: #666;
                        margin-top: 4px;
                    `;
                    transporterAddress.textContent = transporter.address || 'No address';

                    transporterInfo.appendChild(transporterName);
                    transporterInfo.appendChild(transporterDetails);
                    transporterInfo.appendChild(transporterAddress);
                    transporterRow.appendChild(transporterInfo);

                    transporterRow.addEventListener('mouseover', () => {
                        transporterRow.style.backgroundColor = '#f0f0f0';
                    });
                    
                    transporterRow.addEventListener('mouseout', () => {
                        transporterRow.style.backgroundColor = 'white';
                    });

                    transporterRow.addEventListener('click', () => {
                        transporterInput.value = transporter.name;
                        hidePopup();
                    });

                    transportersContainer.appendChild(transporterRow);
                });
            } else {
                const noResults = document.createElement('div');
                noResults.style.cssText = `
                    padding: 16px;
                    text-align: center;
                    color: #666;
                    font-style: italic;
                `;
                noResults.textContent = 'No transporters found';
                transportersContainer.appendChild(noResults);
            }
        }

        // Event Listeners
        transporterInput.addEventListener('click', (e) => {
            e.preventDefault();
            showPopup();
        });

        closeButton.addEventListener('click', hidePopup);
        overlay.addEventListener('click', hidePopup);

        searchInput.addEventListener('input', (e) => {
            loadAndDisplayTransporters(e.target.value);
        });

        // Close popup on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hidePopup();
            }
        });
    }
});