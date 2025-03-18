document.addEventListener('DOMContentLoaded', () => {
    console.log('Sales page loaded');

    const addSaleBtn = document.getElementById('addSaleBtn');
    const saleModal = document.getElementById('saleModal');
    const modalContent = saleModal.querySelector('.modal-content');
    const modalHeader = saleModal.querySelector('.modal-header');
    const closeSaleModal = document.getElementById('closeSaleModal');
    const saveSaleBtn = document.getElementById('saveSaleBtn');
    const cancelSaleBtn = document.getElementById('cancelSaleBtn');
    const salesTable = document.getElementById('salesTable').getElementsByTagName('tbody')[0];
    const draggableContainer = document.getElementById('draggableContainer');

    let sales = [];
    let editingSale = null;
    let accounts = [];
    let products = [];
    let productEntries = []; // Array to keep track of product entries
    let selectedInvoices = []; // Array to track selected invoices for invoice generation

    // Check if we should open a specific sale for editing (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const editSaleId = urlParams.get('edit');

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

    // Load existing sales, accounts and products when page loads
    loadSales().then(() => {
        // After sales are loaded, check if we need to open a specific sale for editing
        if (editSaleId) {
            const saleIdNum = parseInt(editSaleId, 10);
            if (!isNaN(saleIdNum)) {
                editSale(saleIdNum);
            }
        } else {
            // If no specific sale to edit, show the add sales form automatically
            openAddSalesForm();
        }
    });
    setupAccountAutocomplete();
    setupProductAutocomplete();
    setupTransporterAutocomplete();
    setupMultiProductForm(); // Setup multi-product functionality

    function loadSales() {
        // Get the current financial year
        const currentFY = getCurrentFinancialYear();
        let url = '/api/sales';
        
        // Add financial year filter if available
        if (currentFY) {
            url = `/api/sales?financialYearId=${encodeURIComponent(currentFY.id)}`;
        }
        
        return fetch(url)
            .then(response => response.json())
            .then(data => {
                sales = data;
                renderSales();
                
                // Update financial year display if element exists
                const fyDisplay = document.getElementById('currentFinancialYearDisplay');
                if (fyDisplay && currentFY) {
                    fyDisplay.textContent = `Financial Year: ${currentFY.label}`;
                    fyDisplay.style.display = 'block';
                }
                
                return data;
            })
            .catch(error => {
                console.error('Error loading sales:', error);
                return [];
            });
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

    async function getNextInvoiceNumber() {
        // Get the current financial year
        const currentFY = getCurrentFinancialYear();
        
        try {
            // Call the server API to get the next invoice number for this financial year
            const response = await fetch(`/api/next-invoice-number?type=sales&financialYearId=${currentFY ? currentFY.id : ''}`);
            if (!response.ok) {
                throw new Error('Failed to get next invoice number');
            }
            
            const data = await response.json();
            return data.invoiceNo.toString().padStart(4, '0');
        } catch (error) {
            console.error('Error getting next invoice number:', error);
            
            // Fallback to client-side calculation if server API fails
        if (sales.length === 0) return '0001';
        
            // Filter sales by current financial year
            let relevantSales = sales;
            if (currentFY) {
                relevantSales = sales.filter(sale => 
                    sale.financial_year_id === currentFY.id || 
                    isDateInCurrentFinancialYear(sale.date)
                );
            }
            
            const maxInvoice = relevantSales.reduce((max, sale) => {
            const num = parseInt(sale.invoiceNo);
            return num > max ? num : max;
        }, 0);
        
        return (maxInvoice + 1).toString().padStart(4, '0');
        }
    }

    addSaleBtn.addEventListener('click', async () => {
        editingSale = null;
        
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
        
        // Set today's date
        setTodayDate();
        
        resetModalPosition(); // Reset modal position
        saleModal.style.display = 'flex';
    });

    closeSaleModal.addEventListener('click', () => {
        saleModal.style.display = 'none';
        clearForm();
    });

    cancelSaleBtn.addEventListener('click', () => {
        saleModal.style.display = 'none';
        clearForm();
    });

    function renderSales() {
        salesTable.innerHTML = '';
        
        // Group sales by invoice number
        const salesByInvoice = {};
        sales.forEach(sale => {
            if (!salesByInvoice[sale.invoiceNo]) {
                salesByInvoice[sale.invoiceNo] = [];
            }
            salesByInvoice[sale.invoiceNo].push(sale);
        });
        
        // Render each invoice group
        Object.values(salesByInvoice).forEach(invoiceGroup => {
            // Sort by ID to maintain original order
            invoiceGroup.sort((a, b) => a.id - b.id);
            
            // Render each sale in the group
            invoiceGroup.forEach((sale, index) => {
            const row = salesTable.insertRow();
                const isFirstRow = index === 0;
                
                // Set classes for styling based on whether it's a multi-product sale
                if (invoiceGroup.length > 1) {
                    if (isFirstRow) {
                        row.classList.add('multi-product-row', 'first-product-row');
                    } else {
                        row.classList.add('multi-product-row', 'additional-product-row');
                    }
                }
                
                // Add data attribute to identify sales from the same invoice
                row.dataset.invoiceNo = sale.invoiceNo;
                
                // If this invoice is selected, add a class to highlight it
                if (selectedInvoices.includes(sale.invoiceNo)) {
                    row.classList.add('selected-invoice');
                }
                
                // Insert cells with appropriate styling for multi-product rows
                const cells = [
                    { 
                        content: `<span class="invoice-number-cell">${sale.invoiceNo}</span>`, 
                        dimIfAdditional: true,
                        isInvoiceCell: true 
                    },
                    { content: sale.date, dimIfAdditional: true },
                    { content: sale.accountName, dimIfAdditional: true },
                    { content: sale.productName, dimIfAdditional: false }, // Product fields don't dim
                    { content: sale.supplyQty || 0, dimIfAdditional: false },
                    { content: sale.receivedQty || 0, dimIfAdditional: false },
                    { content: sale.transporterName || '', dimIfAdditional: true },
                    { content: isFirstRow ? `₹${sale.transporterFare || 0}` : '', dimIfAdditional: false }, // Only show fare on first row
                    { 
                        content: `<span class="payment-badge ${sale.paymentOption}">${sale.paymentOption}</span>`, 
                        dimIfAdditional: true 
                    },
                    { content: sale.container || '', dimIfAdditional: true },
                    { 
                        content: `<span class="remark-text" title="${sale.remark || ''}">${sale.remark || ''}</span>`, 
                        dimIfAdditional: true 
                    }
                ];
                
                // Add each cell to the row
                cells.forEach((cellData, cellIndex) => {
                    const cell = row.insertCell();
                    cell.innerHTML = cellData.content;
                    
                    // Apply dimming style for additional product rows
                    if (!isFirstRow && cellData.dimIfAdditional) {
                        cell.classList.add('dimmed-cell');
                    }
                    
                    // Make invoice number cells clickable
                    if (cellData.isInvoiceCell && isFirstRow) {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', () => {
                            toggleInvoiceSelection(sale.invoiceNo);
                        });
                    }
                });
                
                // Add action buttons
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = `
                    <button onclick="editSale(${sale.id})" class="edit-btn">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteSale(${sale.id})" class="delete-btn">
                        <i class="fas fa-trash"></i>
                    </button>
            `;
        });
        });
        
        // Add CSS to the page for multi-product row styling
        addMultiProductStyles();
    }
    
    // Function to toggle selection of an invoice
    function toggleInvoiceSelection(invoiceNo) {
        // Check if this invoice is already selected
        const isAlreadySelected = selectedInvoices.includes(invoiceNo);
        
        // Clear all existing selections first
        document.querySelectorAll('.selected-invoice').forEach(row => {
            row.classList.remove('selected-invoice');
        });
        
        // Clear the selectedInvoices array
        selectedInvoices = [];
        
        // If the invoice wasn't already selected, select it
        // If it was already selected, this will deselect it (toggle behavior)
        if (!isAlreadySelected) {
            selectedInvoices.push(invoiceNo);
            
            // Add class to all rows with this invoice number
            document.querySelectorAll(`tr[data-invoice-no="${invoiceNo}"]`).forEach(row => {
                row.classList.add('selected-invoice');
            });
        }
        
        // Update the generate invoice button status
        updateGenerateInvoiceButton();
    }
    
    // Update the generate invoice button status
    function updateGenerateInvoiceButton() {
        const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
        if (!generateInvoiceBtn) return;
        
        if (selectedInvoices.length > 0) {
            generateInvoiceBtn.classList.add('active');
            generateInvoiceBtn.setAttribute('title', 'Generate invoice for the selected invoice');
        } else {
            generateInvoiceBtn.classList.remove('active');
            generateInvoiceBtn.setAttribute('title', 'Select an invoice first by clicking on an invoice number');
        }
    }
    
    // Setup the generate invoice button event listener
    const invoiceBtn = document.getElementById('generateInvoiceBtn');
    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', function() {
            if (selectedInvoices.length === 0) {
                showInfoMessage("Please select an invoice by clicking on the invoice number in the table.");
                return;
            }
            
            generateInvoiceForSelected();
        });
    } else {
        console.error('Generate Invoice button not found in the DOM');
    }
    
    // Function to generate and show an invoice for the selected invoice
    function generateInvoiceForSelected() {
        if (selectedInvoices.length === 0) {
            showErrorMessage("No invoice selected for generation.");
            return;
        }
        
        // Get the selected invoice number
        const invoiceNo = selectedInvoices[0];
        
        // Get all sales with this invoice number
        const invoiceSales = sales.filter(sale => sale.invoiceNo === invoiceNo);
        
        if (invoiceSales.length === 0) {
            showErrorMessage("Failed to generate invoice: No data found for the selected invoice.");
            return;
        }
        
        // Create invoice data structure
        const invoiceData = {
            invoiceNo: invoiceNo,
            date: invoiceSales[0].date,
            accountName: invoiceSales[0].accountName,
            accountAddress: invoiceSales[0].shipToAddress || 'N/A',
            transporterName: invoiceSales[0].transporterName || 'N/A',
            transporterFare: invoiceSales[0].transporterFare || 0,
            paymentMethod: invoiceSales[0].paymentOption || 'cash',
            container: invoiceSales[0].container || 'N/A',
            remark: invoiceSales[0].remark || '',
            products: invoiceSales.map(sale => ({
                name: sale.productName,
                quantity: sale.supplyQty || 0,
                receivedQty: sale.receivedQty || 0,
                // Calculate price - can be adjusted based on business logic
                price: (sale.supplyQty || 0) * 100
            }))
        };
        
        // Create and show invoice in a new window for printing/PDF
        showInvoiceForPrinting(invoiceData);
    }
    
    // Function to create and show invoice for printing
    function showInvoiceForPrinting(invoiceData) {
        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'height=600,width=800');
        
        // Calculate total amount for the invoice
        let totalAmount = 0;
        invoiceData.products.forEach(product => {
            totalAmount += product.price;
        });
        // Add transport fare to total
        totalAmount += invoiceData.transporterFare;
        
        // Get today's date formatted
        const today = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Create HTML content for the invoice
        let invoiceContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice #${invoiceData.invoiceNo}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                    }
                    .invoice-container {
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 30px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 40px;
                    }
                    .company-details {
                        flex: 1;
                    }
                    .company-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #3a7e3d;
                        margin-bottom: 5px;
                    }
                    .invoice-title {
                        text-align: right;
                        font-size: 28px;
                        font-weight: bold;
                        color: #333;
                        margin-bottom: 10px;
                    }
                    .invoice-number {
                        text-align: right;
                        font-size: 16px;
                        margin-bottom: 5px;
                    }
                    .invoice-date {
                        text-align: right;
                        font-size: 16px;
                    }
                    .billing-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .billing-to, .billing-details {
                        flex: 1;
                    }
                    .billing-to h3, .billing-details h3 {
                        margin-top: 0;
                        margin-bottom: 10px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                    }
                    .invoice-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                    }
                    .invoice-table th, .invoice-table td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    .invoice-table th {
                        background-color: #f8f8f8;
                        font-weight: bold;
                    }
                    .invoice-table .amount {
                        text-align: right;
                    }
                    .invoice-total {
                        text-align: right;
                        margin-top: 30px;
                        font-size: 18px;
                    }
                    .invoice-total .total-amount {
                        font-weight: bold;
                        font-size: 20px;
                        color: #3a7e3d;
                    }
                    .invoice-notes {
                        margin-top: 40px;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }
                    .invoice-notes h3 {
                        margin-top: 0;
                        margin-bottom: 10px;
                    }
                    .invoice-remarks {
                        margin-top: 20px;
                        padding: 15px;
                        background-color: #f9f9f9;
                        border-radius: 5px;
                    }
                    .print-button {
                        background-color: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 20px 2px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .pdf-button {
                        background-color: #ff9800;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 20px 2px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .close-button {
                        background-color: #f44336;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 20px 2px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .button-container {
                        text-align: center;
                    }
                    @media print {
                        .button-container {
                            display: none;
                        }
                        body {
                            padding: 0;
                        }
                        .invoice-container {
                            box-shadow: none;
                            border: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="button-container">
                    <button class="print-button" onclick="window.print();">Print Invoice</button>
                    <button class="pdf-button" onclick="window.print();">Save as PDF</button>
                    <button class="close-button" onclick="window.close();">Close</button>
                </div>
                <div class="invoice-container">
                    <div class="invoice-header">
                        <div class="company-details">
                            <div class="company-name">Your Company Name</div>
                            <div>123 Business Street, City</div>
                            <div>Phone: +91 1234567890</div>
                            <div>Email: info@yourcompany.com</div>
                            <div>GSTIN: 12ABCDE1234F1Z5</div>
                        </div>
                        <div>
                            <div class="invoice-title">INVOICE</div>
                            <div class="invoice-number">Invoice #: ${invoiceData.invoiceNo}</div>
                            <div class="invoice-date">Date: ${invoiceData.date}</div>
                        </div>
                    </div>
                    
                    <div class="billing-info">
                        <div class="billing-to">
                            <h3>Bill To:</h3>
                            <div><strong>${invoiceData.accountName}</strong></div>
                            <div>${invoiceData.accountAddress}</div>
                        </div>
                        <div class="billing-details">
                            <h3>Transport Details:</h3>
                            <div><strong>Transporter:</strong> ${invoiceData.transporterName}</div>
                            <div><strong>Container:</strong> ${invoiceData.container}</div>
                            <div><strong>Payment Method:</strong> ${invoiceData.paymentMethod.toUpperCase()}</div>
                        </div>
                    </div>
                    
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantity</th>
                                <th>Received</th>
                                <th>Unit Price</th>
                                <th class="amount">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
        
        // Add rows for each product in this invoice
        invoiceData.products.forEach(product => {
            const unitPrice = product.price / product.quantity;
            invoiceContent += `
                <tr>
                    <td>${product.name}</td>
                    <td>${product.quantity}</td>
                    <td>${product.receivedQty}</td>
                    <td>₹${unitPrice.toFixed(2)}</td>
                    <td class="amount">₹${product.price.toFixed(2)}</td>
                </tr>
            `;
        });
        
        // Add transporter fare if applicable
        if (invoiceData.transporterFare > 0) {
            invoiceContent += `
                <tr>
                    <td>Transport Charges (${invoiceData.transporterName})</td>
                    <td>1</td>
                    <td>1</td>
                    <td>₹${invoiceData.transporterFare.toFixed(2)}</td>
                    <td class="amount">₹${invoiceData.transporterFare.toFixed(2)}</td>
                </tr>
            `;
        }
        
        // Add total for this invoice
        invoiceContent += `
                <tr>
                    <td colspan="4" style="text-align:right;"><strong>Total:</strong></td>
                    <td class="amount"><strong>₹${totalAmount.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>
        `;
        
        // Add remarks if present
        if (invoiceData.remark) {
            invoiceContent += `
                <div class="invoice-remarks">
                    <h3>Remarks:</h3>
                    <p>${invoiceData.remark}</p>
                </div>
            `;
        }
        
        // Add the invoice notes and closing tags
        invoiceContent += `
                <div class="invoice-notes">
                    <h3>Notes:</h3>
                    <p>Thank you for your business! Payment is due within 30 days.</p>
                    <p>For any questions concerning this invoice, please contact our customer service.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Write the content to the new window
        printWindow.document.write(invoiceContent);
        printWindow.document.close();
        
        // Reset selection after generating invoice
        selectedInvoices = [];
        renderSales();
    }
    
    // Show info message
    function showInfoMessage(message) {
        // Make sure the styles are loaded
        addMessageStyles();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message info';
        messageContainer.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
            <button class="close-message"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(messageContainer);
        
        // Add close button handler
        messageContainer.querySelector('.close-message').addEventListener('click', () => {
            document.body.removeChild(messageContainer);
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(messageContainer)) {
                document.body.removeChild(messageContainer);
            }
        }, 5000);
    }
    
    // Show error message
    function showErrorMessage(message) {
        // Make sure the styles are loaded
        addMessageStyles();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message error';
        messageContainer.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button class="close-message"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(messageContainer);
        
        // Add close button handler
        messageContainer.querySelector('.close-message').addEventListener('click', () => {
            document.body.removeChild(messageContainer);
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(messageContainer)) {
                document.body.removeChild(messageContainer);
            }
        }, 5000);
    }

    function clearForm() {
        document.getElementById('invoiceNo').value = '';
        document.getElementById('saleDate').value = '';
        document.getElementById('accountName').value = '';
        document.getElementById('shipToAddress').value = '';
        document.getElementById('productName').value = '';
        document.getElementById('supplyQty').value = '';
        document.getElementById('receivedQty').value = '';
        document.getElementById('transporterName').value = '';
        document.getElementById('transporterFare').value = '';
        document.getElementById('paymentOption').value = 'cash';
        document.getElementById('container').value = '';
        document.getElementById('remark').value = '';
        
        // Clear additional product entries
        const productEntriesContainer = document.getElementById('additionalProductsContainer');
        if (productEntriesContainer) {
            productEntriesContainer.innerHTML = '';
        }
        productEntries = [];
        
        editingSale = null;
        
        // Set today's date automatically
        setTodayDate();
    }

    // Helper function to set today's date in the date field
    function setTodayDate() {
        const today = new Date();
        const dateInput = document.getElementById('saleDate');
        
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

    function editSale(saleId) {
        // Find the sale to edit
        const targetSale = sales.find(s => s.id === saleId);
        if (!targetSale) return;
        
        // Find all sales with the same invoice number
        const relatedSales = sales.filter(s => s.invoiceNo === targetSale.invoiceNo);
        
        // Sort by ID to maintain original order
        relatedSales.sort((a, b) => a.id - b.id);
        
        // Clear any existing product entries
        const productEntriesContainer = document.getElementById('additionalProductsContainer');
        if (productEntriesContainer) {
            productEntriesContainer.innerHTML = '';
        }
        productEntries = [];
        
        // Set the main sale as the one we're editing (usually the first one)
        editingSale = relatedSales[0];
        
        // Populate form with common data from the first sale
        document.getElementById('invoiceNo').value = editingSale.invoiceNo;
        
        // Set the date with proper formatting
        const saleDateInput = document.getElementById('saleDate');
        if (editingSale.date) {
            try {
                // Try to parse the date
                const dateObj = new Date(editingSale.date);
                
                // If it's a valid date, format it correctly
                if (!isNaN(dateObj.getTime())) {
                    saleDateInput.valueAsDate = dateObj;
                    saleDateInput.value = formatDateYYYYMMDD(dateObj);
                } else {
                    // Try parsing with different formats
                    const parts = editingSale.date.split(/[-/]/);
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
                            saleDateInput.valueAsDate = validDate;
                            saleDateInput.value = formatDateYYYYMMDD(validDate);
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
        
        document.getElementById('accountName').value = editingSale.accountName;
        document.getElementById('shipToAddress').value = editingSale.shipToAddress || '';
        document.getElementById('transporterName').value = editingSale.transporterName || '';
        document.getElementById('transporterFare').value = editingSale.transporterFare || '';
        document.getElementById('paymentOption').value = editingSale.paymentOption || 'cash';
        document.getElementById('container').value = editingSale.container || '';
        document.getElementById('remark').value = editingSale.remark || '';
        
        // Populate the main product fields with data from the clicked sale
        document.getElementById('productName').value = targetSale.productName;
        document.getElementById('supplyQty').value = targetSale.supplyQty || '';
        document.getElementById('receivedQty').value = targetSale.receivedQty || '';
        
        // If there are additional sales with the same invoice, add them as additional products
        if (relatedSales.length > 1) {
            for (let i = 0; i < relatedSales.length; i++) {
                // Skip the sale we're editing as main product
                if (relatedSales[i].id === targetSale.id) continue;
                
                addProductEntry({
                    productName: relatedSales[i].productName,
                    supplyQty: relatedSales[i].supplyQty || '',
                    receivedQty: relatedSales[i].receivedQty || ''
                });
            }
        }
        
        resetModalPosition();
        saleModal.style.display = 'block';
    }

    // Make the editSale function globally accessible
    window.editSale = editSale;

    // Modify the saveSaleBtn.addEventListener to handle multiple products
    saveSaleBtn.addEventListener('click', () => {
        // Get current financial year
        const currentFY = getCurrentFinancialYear();
        
        // Get common data for all products
        const commonData = {
            invoiceNo: document.getElementById('invoiceNo').value,
            date: document.getElementById('saleDate').value,
            accountName: document.getElementById('accountName').value,
            shipToAddress: document.getElementById('shipToAddress').value,
            transporterName: document.getElementById('transporterName').value,
            transporterFare: parseFloat(document.getElementById('transporterFare').value) || 0,
            paymentOption: document.getElementById('paymentOption').value,
            container: document.getElementById('container').value,
            remark: document.getElementById('remark').value,
            financial_year_id: currentFY ? currentFY.id : null
        };

        // Get product-specific data
        const productData = [];
        
        // Get data from the first (main) product
        productData.push({
            productName: document.getElementById('productName').value,
            supplyQty: parseInt(document.getElementById('supplyQty').value) || 0,
            receivedQty: parseInt(document.getElementById('receivedQty').value) || 0
        });
        
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

        // Check if editing an existing sale
        if (editingSale) {
            // When editing, we'll update the first product in the existing sale
            // and create new records for additional products if applicable
            
            // Update the first product
            const firstProductData = {
                ...commonData,
                ...productData[0]
            };
            
            // Update the first product
            fetch(`/api/sales/${editingSale.id}`, {
                method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
                body: JSON.stringify(firstProductData)
        })
        .then(response => response.json())
            .then(async () => {
                // For each additional product, create a new sale record
                if (productData.length > 1) {
                    for (let i = 1; i < productData.length; i++) {
                        const additionalProductData = {
                            ...commonData,
                            ...productData[i],
                            // Set transporterFare to 0 for additional products to avoid double counting
                            transporterFare: 0
                        };

                        await fetch('/api/sales', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(additionalProductData)
                        });
                    }
                }
                
            loadSales();
            saleModal.style.display = 'none';
            clearForm();
                showSuccessMessage("Sale updated successfully!");
            })
            .catch(error => {
                console.error('Error updating sale:', error);
                showErrorMessage("Failed to update sale. Please try again.");
            });
        } else {
            // Create new sales records
            Promise.all(productData.map((product, index) => {
                // For all products after the first one, set transporterFare to 0 to avoid double counting
                const saleData = {
                    ...commonData,
                    ...product,
                    transporterFare: index === 0 ? commonData.transporterFare : 0
                };

                return fetch('/api/sales', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(saleData)
                });
            }))
            .then(() => {
                loadSales();
                saleModal.style.display = 'none';
                clearForm();
                showSuccessMessage("Sale created successfully!");
            })
            .catch(error => {
                console.error('Error saving multi-product sale:', error);
                showErrorMessage("Failed to create sale. Please try again.");
            });
        }
    });

    window.deleteSale = function(saleId) {
        const saleToDelete = sales.find(s => s.id === saleId);
        if (!saleToDelete) return;
        
        // Find if there are other sales with the same invoice
        const relatedSales = sales.filter(s => s.invoiceNo === saleToDelete.invoiceNo);
        
        if (relatedSales.length > 1) {
            // If it's a multi-product sale, ask if they want to delete just this product or the entire invoice
            const deleteOptions = confirm(
                `This sale has multiple products under invoice #${saleToDelete.invoiceNo}.\n\n` +
                'Click "OK" to delete only this product.\n' +
                'Click "Cancel" then confirm to delete the entire invoice with all products.'
            );
            
            if (deleteOptions) {
                // Delete just this product
                deleteAndReloadSale(saleId);
            } else {
                // Confirm deletion of the entire invoice
                if (confirm(`Are you sure you want to delete the entire invoice #${saleToDelete.invoiceNo} with all its products?`)) {
                    // Delete all products with this invoice number
                    Promise.all(relatedSales.map(sale => 
                        fetch(`/api/sales/${sale.id}`, { method: 'DELETE' })
                    ))
                    .then(() => {
                        loadSales(); // Reload all sales
                        showSuccessMessage(`Invoice #${saleToDelete.invoiceNo} deleted successfully`);
                    })
                    .catch(error => {
                        console.error('Error deleting invoice:', error);
                        showErrorMessage("Failed to delete invoice. Please try again.");
                    });
                }
            }
        } else {
            // Regular single product sale - confirm and delete
        if (confirm('Are you sure you want to delete this sale?')) {
                deleteAndReloadSale(saleId);
            }
        }
    };
    
    function deleteAndReloadSale(saleId) {
            fetch(`/api/sales/${saleId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(() => {
                loadSales(); // Reload all sales
            showSuccessMessage("Sale deleted successfully!");
        })
        .catch(error => {
            console.error('Error deleting sale:', error);
            showErrorMessage("Failed to delete sale. Please try again.");
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
        // Make sure the styles are loaded
        addMessageStyles();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message success';
        messageContainer.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
            <button class="close-message"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(messageContainer);
        
        // Add close button handler
        messageContainer.querySelector('.close-message').addEventListener('click', () => {
            document.body.removeChild(messageContainer);
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(messageContainer)) {
                document.body.removeChild(messageContainer);
            }
        }, 5000);
    }

    // Add CSS for multi-product rows and selected invoices
    function addMultiProductStyles() {
        if (!document.getElementById('multi-product-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'multi-product-styles';
            styleSheet.innerHTML = `
                .multi-product-row {
                    position: relative;
                }
                
                .multi-product-row.first-product-row {
                    border-bottom: none;
                }
                
                .multi-product-row.additional-product-row {
                    border-top: 1px dashed rgba(0, 0, 0, 0.1);
                }
                
                /* Style for dimmed cells in additional product rows */
                .dimmed-cell {
                    color: rgba(0, 0, 0, 0.5);
                    font-style: italic;
                }
                
                /* Add a vertical line to connect related sales */
                .multi-product-row:not(:last-child) {
                    position: relative;
                }
                
                .multi-product-row:not(:last-child)::after {
                    content: '';
                    position: absolute;
                    left: 20px;
                    bottom: -1px;
                    width: 1px;
                    height: 1px;
                    background-color: #aaa;
                }
                
                /* Highlight rows from the same invoice on hover */
                .multi-product-row:hover {
                    background-color: rgba(0, 0, 0, 0.05);
                }
                
                /* Show visual indicator for grouped products */
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
                
                /* Styles for clickable invoice numbers */
                .invoice-number-cell {
                    position: relative;
                    cursor: pointer;
                    font-weight: 500;
                    color: var(--primary-color);
                    padding: 2px 6px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .invoice-number-cell:hover {
                    background-color: rgba(var(--primary-color-rgb), 0.1);
                }
                
                /* Style for selected invoices */
                .selected-invoice {
                    background-color: rgba(var(--primary-color-rgb), 0.05) !important;
                }
                
                .selected-invoice .invoice-number-cell {
                    background-color: var(--primary-color);
                    color: white;
                }
                
                /* Active state for generate invoice button */
                #generateInvoiceBtn.active {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(233, 162, 38, 0.4);
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    // Enhance message styles to include info messages
    function addMessageStyles() {
        const messageStyleExists = document.querySelector('style#message-styles');
        if (messageStyleExists) {
            // If the message styles already exist, add the info style
            if (!messageStyleExists.innerHTML.includes('.message.info')) {
                const additionalStyles = `
                    .message.info {
                        background-color: #e3f2fd;
                        color: #1565c0;
                        border-left: 4px solid #1565c0;
                    }
                `;
                messageStyleExists.innerHTML += additionalStyles;
            }
        } else {
            // If message styles don't exist yet, create them with all styles including info
            const messageStyles = document.createElement('style');
            messageStyles.id = 'message-styles';
            messageStyles.innerHTML = `
                .message {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    z-index: 9999;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                .message.success {
                    background-color: #e7f6e7;
                    color: #2e7d32;
                    border-left: 4px solid #2e7d32;
                }
                .message.error {
                    background-color: #ffebee;
                    color: #c62828;
                    border-left: 4px solid #c62828;
                }
                .message.info {
                    background-color: #e3f2fd;
                    color: #1565c0;
                    border-left: 4px solid #1565c0;
                }
                .message .close-message {
                    margin-left: auto;
                    background: none;
                    border: none;
                    cursor: pointer;
                    opacity: 0.7;
                    color: inherit;
                }
                .message .close-message:hover {
                    opacity: 1;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(messageStyles);
        }
    }
    
    // Make sure to initialize the styles
    document.addEventListener('DOMContentLoaded', function() {
        addMultiProductStyles();
        addMessageStyles();
    });

    // Function to open the Add Sales form
    function openAddSalesForm() {
        // Clear any existing data
        editingSale = null;
        clearForm();
        
        // Auto-fill invoice number
        getNextInvoiceNumber().then(nextInvoiceNo => {
            document.getElementById('invoiceNo').value = nextInvoiceNo;
        }).catch(error => {
            console.error('Error getting next invoice number:', error);
            document.getElementById('invoiceNo').value = '';
        });
        
        // Set today's date
        setTodayDate();
        
        // Reset and show modal
        resetModalPosition();
        saleModal.style.display = 'flex';
    }
});