document.addEventListener('DOMContentLoaded', async () => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const customerName = decodeURIComponent(urlParams.get('name') || '');
    const customerInfo = document.getElementById('customerOverview');
    const salesTable = document.getElementById('salesHistory').getElementsByTagName('tbody')[0];
    
    // Store all sales data for filtering and calculations
    let filteredSales = [];

    // Add global compact styling for the page
    const compactStyles = document.createElement('style');
    compactStyles.textContent = `
        /* Compact styling for the entire page */
        body {
            line-height: 1.3;
            padding-bottom: 40px; /* Add padding to the bottom of the body to prevent content from being hidden behind the bottom bar */
        }
        
        .draggable-container {
            padding: 8px;
        }
        
        .content {
            margin-top: 8px;
            padding-bottom: 10px; /* Add padding to the bottom of the content */
        }
        
        /* Customer overview styling */
        .customer-overview {
            margin-bottom: 8px;
        }
        
        /* Filter section styling */
        .filter-section {
            margin-bottom: 8px;
            padding: 8px;
            background-color: var(--background-secondary);
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .filter-section h3 {
            margin-top: 0;
            margin-bottom: 6px;
            font-size: 0.95em;
        }
        
        .filter-group {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 6px;
        }
        
        .filter-group label {
            font-size: 0.8em;
            margin-right: 4px;
        }
        
        .filter-group select,
        .filter-group input {
            padding: 3px 6px;
            border-radius: 3px;
            border: 1px solid var(--border-color);
            font-size: 0.85em;
        }
        
        .filter-buttons {
            display: flex;
            gap: 6px;
        }
        
        .filter-buttons button {
            padding: 3px 6px;
            font-size: 0.85em;
            border-radius: 3px;
            border: none;
            cursor: pointer;
        }
        
        /* Success message styling */
        .success-message {
            padding: 6px 10px;
            font-size: 0.85em;
            border-radius: 3px;
        }
        
        /* Stock display styling */
        .bottom-bar {
            padding: 6px 12px;
            height: 30px; /* Set a fixed height for the bottom bar */
        }
        
        .product-stock-item {
            padding: 4px 8px;
            font-size: 0.8em;
        }
        
        /* Table styling */
        .table-container {
            margin-top: 10px;
            padding: 8px;
        }
        
        .table-container h2 {
            font-size: 1.1em;
            margin-bottom: 8px;
        }
        
        /* Animation durations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-8px); }
        }

        /* Fix for top bar overlap */
        .header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: var(--background-primary);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Main content area with proper spacing */
        .main-content {
            margin-top: 10px;
            margin-bottom: 40px; /* Add margin to prevent overlap with bottom bar */
        }
    `;
    document.head.appendChild(compactStyles);

    if (!customerName) {
        customerInfo.innerHTML = '<p class="error">No customer name provided</p>';
        return;
    }

    // Set page title with customer name
    document.title = `${customerName}'s Stock Details`;

    // Load both customer details and product list
    Promise.all([
        fetchCustomerData(customerName),
        fetchProducts()
    ])
    .then(([customer, products]) => {
        renderCustomerAndProductsSection(customer, products);
        // Other existing functionality will remain...
    })
    .catch(error => {
        console.error('Error loading data:', error);
        customerInfo.innerHTML = `<p class="error">Error loading data: ${error.message}</p>`;
    });

    // Fetch customer data
    function fetchCustomerData(name) {
        return fetch(`/api/accounts?name=${encodeURIComponent(name)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch customer data');
            }
            return response.json();
        })
        .then(customers => {
                if (customers && customers.length > 0) {
                    return customers[0]; // Get the first matching customer
                } else {
                    throw new Error('Customer not found');
                }
            });
    }

    // Fetch all products
    function fetchProducts() {
        return fetch('/api/products')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch products');
                }
                return response.json();
            });
    }

    // Render the customer details and products section
    function renderCustomerAndProductsSection(customer, products) {
        // Clear the customer info container
        customerInfo.innerHTML = '';
        
        // Fetch existing rates for this customer
        fetch(`/api/customer-rates?customer_name=${encodeURIComponent(customerName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch product rates');
            }
            return response.json();
        })
        .then(ratesData => {
            // Create a map of product rates for easy lookup
            const ratesMap = {};
            ratesData.forEach(rate => {
                ratesMap[rate.product_name] = rate.rate;
            });
            
            // Continue with rendering the UI with rates data
            renderUI(customer, products, ratesMap);
        })
        .catch(error => {
            console.error('Error fetching rates:', error);
            // Continue rendering the UI without rates data
            renderUI(customer, products, {});
        });
        
        function renderUI(customer, products, ratesMap) {
            // Create the main container with two-column layout
            const topSectionContainer = document.createElement('div');
            topSectionContainer.className = 'top-section-container';
            topSectionContainer.style.display = 'grid';
            topSectionContainer.style.gridTemplateColumns = '1fr 1fr';
            topSectionContainer.style.gap = '6px';
            topSectionContainer.style.marginBottom = '12px';
            
            // Create left column for customer details
            const customerDetailsColumn = document.createElement('div');
            customerDetailsColumn.className = 'customer-details-column';
            customerDetailsColumn.style.padding = '8px';
            customerDetailsColumn.style.backgroundColor = 'var(--background-secondary)';
            customerDetailsColumn.style.borderRadius = '6px';
            customerDetailsColumn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            // Create customer info header
            const customerHeader = document.createElement('div');
            customerHeader.className = 'customer-header';
            customerHeader.innerHTML = `
                <h2 class="customer-name" style="margin-top: 0; margin-bottom: 2px; color: var(--primary-color); font-size: 1.1em;">${customer.name}</h2>
                <p class="customer-id" style="color: var(--text-secondary); margin: 0; font-size: 0.8em;">ID: ${customer.id}</p>
            `;
            
            // Create customer details content
            const customerDetails = document.createElement('div');
            customerDetails.className = 'customer-details';
            customerDetails.innerHTML = `
                <div class="customer-info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 5px; margin-top: 6px;">
                    ${customer.address ? `
                    <div class="info-item" style="display: flex; align-items: center; gap: 5px; padding: 5px; background: var(--background-primary); border-radius: 4px;">
                        <i class="fas fa-map-marker-alt" style="font-size: 0.9em;"></i>
                        <div style="font-size: 0.85em;">
                            <strong>Address</strong><br>
                            ${customer.address}
                        </div>
                    </div>` : ''}
                    
                    ${customer.mobile ? `
                    <div class="info-item" style="display: flex; align-items: center; gap: 5px; padding: 5px; background: var(--background-primary); border-radius: 4px;">
                        <i class="fas fa-phone" style="font-size: 0.9em;"></i>
                        <div style="font-size: 0.85em;">
                            <strong>Phone</strong><br>
                            ${customer.mobile}
                        </div>
                    </div>` : ''}
                    
                    ${customer.email ? `
                    <div class="info-item" style="display: flex; align-items: center; gap: 5px; padding: 5px; background: var(--background-primary); border-radius: 4px;">
                        <i class="fas fa-envelope" style="font-size: 0.9em;"></i>
                        <div style="font-size: 0.85em;">
                            <strong>Email</strong><br>
                            ${customer.email}
                        </div>
                    </div>` : ''}
                    
                    ${customer.details ? `
                    <div class="info-item" style="display: flex; align-items: flex-start; gap: 5px; padding: 5px; background: var(--background-primary); border-radius: 4px; grid-column: 1 / -1;">
                        <i class="fas fa-info-circle" style="margin-top: 2px; font-size: 0.9em;"></i>
                        <div style="font-size: 0.85em;">
                            <strong>Additional Information</strong><br>
                            ${customer.details}
                        </div>
                    </div>` : ''}
                </div>
            `;
            
            // Create right column for products
            const productsColumn = document.createElement('div');
            productsColumn.className = 'products-column';
            productsColumn.style.padding = '8px';
            productsColumn.style.backgroundColor = 'var(--background-secondary)';
            productsColumn.style.borderRadius = '6px';
            productsColumn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            // Create products header
            const productsHeader = document.createElement('div');
            productsHeader.className = 'products-header';
            productsHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <div>
                        <h2 style="margin: 0; color: var(--primary-color); font-size: 1.1em; font-weight: 600;">Available Products</h2>
                        <p style="margin: 1px 0 0 0; color: var(--text-secondary); font-size: 0.8em;">Set rates for this customer</p>
                    </div>
                    <button id="saveAllRatesBtn" class="btn btn-primary btn-sm">
                        <i class="fas fa-tags"></i> Rates
                    </button>
                </div>
                <div style="position: relative; margin-bottom: 5px;">
                    <input 
                        type="text" 
                        id="productSearchInput" 
                        placeholder="Search products..." 
                        style="
                            width: 100%;
                            padding: 6px 6px 6px 30px;
                            border: 1px solid var(--border-color);
                            border-radius: 4px;
                            background: var(--background-primary);
                            color: var(--text-primary);
                            font-size: 0.85em;
                        "
                    >
                    <i class="fas fa-search" style="
                        position: absolute;
                        left: 8px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: var(--text-secondary);
                        font-size: 0.8em;
                    "></i>
                </div>
            `;

            // Create products list
            const productsList = document.createElement('div');
            productsList.className = 'products-list';
            productsList.style.display = 'grid';
            productsList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
            productsList.style.gap = '10px';
            productsList.style.maxHeight = '420px';
            productsList.style.overflowY = 'auto';
            productsList.style.paddingRight = '3px';
            productsList.style.marginTop = '10px';
            
            // Add products to the list
            if (products && products.length > 0) {
                products.forEach(product => {
                    const existingRate = ratesMap[product.name] || '';
                    
                    const productItem = document.createElement('div');
                    productItem.className = 'product-item';
                    productItem.setAttribute('data-product-name', product.name.toLowerCase());
                    productItem.style.padding = '10px';
                    productItem.style.backgroundColor = 'var(--background-primary)';
                    productItem.style.borderRadius = '6px';
                    productItem.style.border = '1px solid var(--border-color)';
                    productItem.style.transition = 'all 0.2s ease';
                    productItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    
                    productItem.innerHTML = `
                        <h4 style="margin-top: 0; margin-bottom: 4px; font-size: 0.95em; color: var(--primary-color);">${product.name}</h4>
                        <p style="margin: 0; font-size: 0.75em; color: var(--text-secondary); margin-bottom: 6px; height: 24px; overflow: hidden; line-height: 1.2;">
                            ${product.description || 'No description available'}
                        </p>
                        <div style="margin-bottom: 0;">
                            <label style="display: block; font-size: 0.75em; color: var(--text-primary); margin-bottom: 2px; font-weight: 500;">
                                Rate:
                            </label>
                            <div style="display: flex; align-items: center; gap: 3px;">
                                <div class="rate-display" style="
                                    flex: 1;
                                    padding: 6px 8px;
                                    border: 1px solid var(--border-color);
                                    border-radius: 4px;
                                    font-size: 0.85em;
                                    background: var(--background-secondary);
                                    color: ${existingRate ? 'var(--accent-color)' : 'var(--text-secondary)'};
                                    font-weight: 500;
                                ">
                                    ${existingRate ? '₹' + parseFloat(existingRate).toFixed(2) : 'No rate set'}
                                </div>
                            </div>
                        </div>
                    `;
                    
                    productsList.appendChild(productItem);
                });
                
                // Add hover effects for product items
                setTimeout(() => {
                    document.querySelectorAll('.product-item').forEach(item => {
                        item.addEventListener('mouseenter', function() {
                            this.style.transform = 'translateY(-2px)';
                            this.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)';
                        });
                        
                        item.addEventListener('mouseleave', function() {
                            this.style.transform = 'translateY(0)';
                            this.style.boxShadow = 'none';
                        });
                    });

                    // Add auto-save functionality for rate inputs
                    document.querySelectorAll('.product-rate-input').forEach(input => {
                        // Focus/blur effects
                        input.addEventListener('focus', function() {
                            this.style.borderColor = 'var(--accent-color)';
                            this.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb), 0.2)';
                        });
                        
                        input.addEventListener('blur', function() {
                            this.style.borderColor = 'var(--border-color)';
                            this.style.boxShadow = 'none';
                        });
                        
                        // Enter key to save
                        input.addEventListener('keyup', function(e) {
                            if (e.key === 'Enter') {
                                const saveAllBtn = document.getElementById('saveAllRatesBtn');
                                if (saveAllBtn) {
                                    saveAllBtn.click();
                                }
                            }
                        });
                    });
                    
                    // Add search functionality
                    const searchInput = document.getElementById('productSearchInput');
                    if (searchInput) {
                        searchInput.addEventListener('input', function() {
                            const searchTerm = this.value.toLowerCase();
                            document.querySelectorAll('.product-item').forEach(item => {
                                const productName = item.getAttribute('data-product-name');
                                if (productName.includes(searchTerm)) {
                                    item.style.display = '';
                                } else {
                                    item.style.display = 'none';
                                }
                            });
                        });
                    }
                    
                    // Add set rate button functionality
                    document.querySelectorAll('.set-rate-btn').forEach(button => {
                        button.addEventListener('click', function() {
                            const productName = this.getAttribute('data-product');
                            const rateInput = document.querySelector(`.product-rate-input[data-product="${productName}"]`);
                            
                            if (rateInput) {
                                const rate = parseFloat(rateInput.value) || 0;
                                saveRate(productName, rate);
                            }
                        });
                        
                        // Add hover effect
                        button.addEventListener('mouseenter', function() {
                            this.style.transform = 'translateY(-2px)';
                            this.style.backgroundColor = '#0056b3'; // Darker shade on hover
                        });
                        
                        button.addEventListener('mouseleave', function() {
                            this.style.transform = 'translateY(0)';
                            this.style.backgroundColor = 'var(--accent-color)';
                        });
                    });
                    
                    // Add save all rates button functionality
                    const saveAllRatesBtn = document.getElementById('saveAllRatesBtn');
                    if (saveAllRatesBtn) {
                        saveAllRatesBtn.addEventListener('click', saveAllRates);
                        
                        // Add hover effect
                        saveAllRatesBtn.addEventListener('mouseenter', function() {
                            this.style.transform = 'translateY(-2px)';
                            this.style.backgroundColor = '#0056b3'; // Darker shade on hover
                        });
                        
                        saveAllRatesBtn.addEventListener('mouseleave', function() {
                            this.style.transform = 'translateY(0)';
                            this.style.backgroundColor = 'var(--accent-color)';
                        });
                    }
                }, 500);
            } else {
                productsList.innerHTML = '<p>No products available</p>';
            }
            
            // Assemble the left column
            customerDetailsColumn.appendChild(customerHeader);
            customerDetailsColumn.appendChild(customerDetails);
            
            // Assemble the right column
            productsColumn.appendChild(productsHeader);
            productsColumn.appendChild(productsList);
            
            // Add both columns to the top section container
            topSectionContainer.appendChild(customerDetailsColumn);
            topSectionContainer.appendChild(productsColumn);
            
            // Add the top section to the customer info container
            customerInfo.appendChild(topSectionContainer);
            
            // Let's also add a separator before the rates section
            const separator = document.createElement('hr');
            separator.style.margin = '30px 0';
            separator.style.border = 'none';
            separator.style.borderTop = '1px solid var(--border-color)';
            customerInfo.appendChild(separator);
            
            // Now we'll add the rates section below
            loadProductRates();
        }
    }

    // Add filter section above the sales history table
    const salesHistoryContainer = document.getElementById('salesHistory').parentElement;
    const filterSection = document.createElement('div');
    filterSection.className = 'filter-section';
    filterSection.innerHTML = `
        <div class="filter-controls">
            <div class="filter-group">
                <label>Date Range:</label>
                <input type="date" id="startDate" class="filter-input">
                <span>to</span>
                <input type="date" id="endDate" class="filter-input">
            </div>
            <div class="filter-group">
                <label>Product:</label>
                <select id="productFilter" class="filter-input">
                    <option value="">All Products</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Transporter:</label>
                <select id="transporterFilter" class="filter-input">
                    <option value="">All Transporters</option>
                </select>
            </div>
            <button id="applyFilters" class="filter-btn">Apply Filters</button>
            <button id="resetFilters" class="filter-btn reset">Reset</button>
        </div>
    `;
    
    salesHistoryContainer.insertBefore(filterSection, document.getElementById('salesHistory'));

    // Add styles for filters
    const filterStyles = document.createElement('style');
    filterStyles.textContent = `
        .filter-section {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .filter-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: flex-end;
        }
        .filter-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .filter-group label {
            font-weight: 500;
            color: #666;
        }
        .filter-input {
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .filter-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        #applyFilters {
            background: var(--primary-color);
            color: white;
        }
        #applyFilters:hover {
            background: var(--primary-dark);
        }
        #resetFilters {
            background: #f0f0f0;
            color: #666;
        }
        #resetFilters:hover {
            background: #e0e0e0;
        }
    `;
    document.head.appendChild(filterStyles);

    let allSales = []; // Store all sales data

    // Add financial year display
    const currentFY = getCurrentFinancialYear();
    if (currentFY) {
        const fyDisplay = document.createElement('div');
        fyDisplay.id = 'currentFinancialYearDisplay';
        fyDisplay.textContent = `Financial Year: ${currentFY.label}`;
        fyDisplay.style.cssText = `
            background-color: var(--accent-color);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-weight: bold;
            margin-bottom: 15px;
            font-size: 14px;
            display: inline-block;
        `;
        document.querySelector('.customer-info-container').prepend(fyDisplay);
    }

    // Fetch all sales data and filter for this customer
    // Add financial year filtering
    const financialYearParam = currentFY ? `?financialYearId=${encodeURIComponent(currentFY.id)}` : '';
    
    fetch(`/api/sales${financialYearParam}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch sales data');
            }
            return response.json();
        })
        .then(data => {
            // Filter sales for this customer
            allSales = data.filter(sale => sale.accountName === customerName);
            filteredSales = [...allSales];

            // Initialize filters
            initializeFilters();
            
            // Calculate and update stock
            updateStockDisplay();
            
            // Render sales table
            renderSalesTable();
        })
        .catch(error => {
            console.error('Error loading sales data:', error);
            const errorRow = salesTable.insertRow();
            const cell = errorRow.insertCell(0);
            cell.colSpan = 10;
            cell.className = 'error';
            cell.textContent = 'Error loading sales data';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
        });

    function initializeFilters() {
        const productFilter = document.getElementById('productFilter');
        const transporterFilter = document.getElementById('transporterFilter');

        // Get unique products
        const products = [...new Set(allSales.map(sale => sale.productName))];
        products.forEach(product => {
            if (product) {
                const option = document.createElement('option');
                option.value = product;
                option.textContent = product;
                productFilter.appendChild(option);
            }
        });

        // Get unique transporters
        const transporters = [...new Set(allSales.map(sale => sale.transporterName))];
        transporters.forEach(transporter => {
            if (transporter) {
                const option = document.createElement('option');
                option.value = transporter;
                option.textContent = transporter;
                transporterFilter.appendChild(option);
            }
        });

        // Set initial date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }

    function applyFilters() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const product = document.getElementById('productFilter').value;
        const transporter = document.getElementById('transporterFilter').value;

        filteredSales = allSales.filter(sale => {
            const saleDate = new Date(sale.date);
            const matchesDateRange = (!startDate || saleDate >= new Date(startDate)) &&
                                   (!endDate || saleDate <= new Date(endDate));
            const matchesProduct = !product || sale.productName === product;
            const matchesTransporter = !transporter || sale.transporterName === transporter;

            return matchesDateRange && matchesProduct && matchesTransporter;
        });

        updateStockDisplay();
        renderSalesTable();
    }

    function resetFilters() {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('productFilter').value = '';
        document.getElementById('transporterFilter').value = '';

        filteredSales = [...allSales];
        updateStockDisplay();
        renderSalesTable();
    }

    function updateStockDisplay() {
        const stockItemsContainer = document.querySelector('.stock-items-container') || createBottomBar();
        stockItemsContainer.innerHTML = '';
        
        // Calculate customer stock from sales history
        const customerStockMap = {};
        
        // Process each sale entry to calculate net stock (Supply - Received)
        filteredSales.forEach(sale => {
            // Handle multi-product sales
            if (sale.products && Array.isArray(sale.products) && sale.products.length > 0) {
                // For multi-product sales
                sale.products.forEach(product => {
                    if (product.productName && product.productName !== 'N/A') {
                        if (!customerStockMap[product.productName]) {
                            customerStockMap[product.productName] = {
                                supplied: 0,
                                received: 0,
                                net: 0
                            };
                        }
                        
                        const supplyQty = parseInt(product.supplyQty) || 0;
                        const receivedQty = parseInt(product.receivedQty) || 0;
                        
                        customerStockMap[product.productName].supplied += supplyQty;
                        customerStockMap[product.productName].received += receivedQty;
                        customerStockMap[product.productName].net = customerStockMap[product.productName].supplied - customerStockMap[product.productName].received;
                    }
                });
            } else if (sale.productName && sale.productName !== 'N/A') {
                // For single-product sales
                if (!customerStockMap[sale.productName]) {
                    customerStockMap[sale.productName] = {
                        supplied: 0,
                        received: 0,
                        net: 0
                    };
                }
                
                const supplyQty = parseInt(sale.supplyQty) || 0;
                const receivedQty = parseInt(sale.receivedQty) || 0;
                
                customerStockMap[sale.productName].supplied += supplyQty;
                customerStockMap[sale.productName].received += receivedQty;
                customerStockMap[sale.productName].net = customerStockMap[sale.productName].supplied - customerStockMap[sale.productName].received;
            }
        });
        
        // Display customer stock information on the right side of the bottom bar
        if (Object.keys(customerStockMap).length > 0) {
            // Add a label/title for the stock section
            const stockLabel = document.createElement('div');
            stockLabel.className = 'stock-label';
            stockLabel.style.marginRight = '8px';
            stockLabel.style.fontSize = '0.85em';
            stockLabel.style.fontWeight = '500';
            stockLabel.style.color = 'var(--text-secondary)';
            stockLabel.textContent = 'Customer Stock:';
            stockItemsContainer.appendChild(stockLabel);
            
            // Add each product's stock information
            Object.entries(customerStockMap).forEach(([productName, stockData]) => {
                const stockItem = document.createElement('div');
                stockItem.className = 'product-stock-item';
                
                // Set background color based on stock status
                let backgroundColor = 'var(--background-primary)';
                let textColor = 'var(--text-primary)';
                
                if (stockData.net > 0) {
                    // Positive stock - customer has cylinders
                    backgroundColor = 'rgba(76, 175, 80, 0.1)';
                    textColor = '#2e7d32';
                } else if (stockData.net < 0) {
                    // Negative stock - customer owes cylinders
                    backgroundColor = 'rgba(244, 67, 54, 0.1)';
                    textColor = '#c62828';
                }
                
                stockItem.style.backgroundColor = backgroundColor;
                stockItem.style.color = textColor;
                stockItem.style.borderRadius = '3px';
                stockItem.style.padding = '4px 8px';
                stockItem.style.fontSize = '0.8em';
                stockItem.style.fontWeight = '500';
                stockItem.style.display = 'flex';
                stockItem.style.flexDirection = 'column';
                stockItem.style.border = '1px solid ' + (stockData.net !== 0 ? backgroundColor : 'var(--border-color)');
                
                // Create main stock display
                const mainStock = document.createElement('div');
                mainStock.innerHTML = `<strong>${productName}:</strong> ${stockData.net} units`;
                stockItem.appendChild(mainStock);
                
                // Create tooltip with detailed information
                const tooltip = document.createElement('div');
                tooltip.className = 'stock-tooltip';
                tooltip.style.display = 'none';
                tooltip.style.position = 'absolute';
                tooltip.style.bottom = '40px';
                tooltip.style.right = '0';
                tooltip.style.backgroundColor = 'var(--background-secondary)';
                tooltip.style.boxShadow = '0 3px 8px rgba(0,0,0,0.2)';
                tooltip.style.padding = '8px 12px';
                tooltip.style.borderRadius = '6px';
                tooltip.style.fontSize = '0.85em';
                tooltip.style.zIndex = '1000';
                tooltip.style.minWidth = '180px';
                tooltip.style.color = 'var(--text-primary)';
                tooltip.style.border = '1px solid var(--border-color)';
                
                tooltip.innerHTML = `
                    <div style="margin-bottom: 5px; font-weight: 600;">${productName} Details:</div>
                    <div style="display: grid; grid-template-columns: auto auto; gap: 5px; align-items: center;">
                        <div>Total Supplied:</div>
                        <div style="text-align: right; font-weight: 500;">${stockData.supplied} units</div>
                        <div>Total Received:</div>
                        <div style="text-align: right; font-weight: 500;">${stockData.received} units</div>
                        <div style="font-weight: 600;">Net Balance:</div>
                        <div style="text-align: right; font-weight: 600; color: ${textColor};">${stockData.net} units</div>
                    </div>
                `;
                
                stockItem.appendChild(tooltip);
                
                // Add hover event to show tooltip
                stockItem.addEventListener('mouseenter', function() {
                    tooltip.style.display = 'block';
                    this.style.zIndex = '1001';
                });
                
                stockItem.addEventListener('mouseleave', function() {
                    tooltip.style.display = 'none';
                    this.style.zIndex = '1';
                });
                
                stockItemsContainer.appendChild(stockItem);
            });
        } else {
            const noStockItem = document.createElement('div');
            noStockItem.className = 'product-stock-item';
            noStockItem.style.backgroundColor = 'var(--background-primary)';
            noStockItem.style.borderRadius = '3px';
            noStockItem.style.padding = '4px 8px';
            noStockItem.style.fontSize = '0.8em';
            noStockItem.textContent = 'No stock records found';
            stockItemsContainer.appendChild(noStockItem);
        }
    }

    function renderSalesTable() {
        const salesTable = document.getElementById('salesHistory').getElementsByTagName('tbody')[0];
        salesTable.innerHTML = '';

        if (filteredSales.length > 0) {
            filteredSales.forEach(sale => {
                const row = salesTable.insertRow();
                
                // Make invoice number clickable
                const invoiceCell = row.insertCell(0);
                const invoiceLink = document.createElement('a');
                invoiceLink.href = `sales.html?edit=${sale.id}`;
                invoiceLink.textContent = sale.invoiceNo;
                invoiceLink.style.color = 'var(--primary-color)';
                invoiceLink.style.textDecoration = 'underline';
                invoiceLink.style.cursor = 'pointer';
                invoiceCell.appendChild(invoiceLink);
                
                row.insertCell(1).textContent = new Date(sale.date).toLocaleDateString();
                row.insertCell(2).textContent = sale.shipToAddress || 'N/A';
                row.insertCell(3).textContent = sale.productName || 'N/A';
                row.insertCell(4).textContent = sale.supplyQty || '0';
                row.insertCell(5).textContent = sale.receivedQty || '0';
                row.insertCell(6).textContent = sale.transporterName || 'N/A';
                row.insertCell(7).textContent = sale.transporterFare || '0';
                row.insertCell(8).textContent = sale.container || 'N/A';
                row.insertCell(9).textContent = sale.remark || 'N/A';
            });
        } else {
            const emptyRow = salesTable.insertRow();
            const cell = emptyRow.insertCell(0);
            cell.colSpan = 10;
            cell.textContent = 'No sales records found for the selected filters';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            cell.style.color = '#666';
        }
    }

    // Add event listeners for filters
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);

    // Bottom bar functionality
    const pdfBtn = document.getElementById('pdfBtn');
    const printBtn = document.getElementById('printBtn');
    const whatsappBtn = document.getElementById('whatsappBtn');

    // PDF Generation and Print functionality
    function generatePrintableContent() {
        // Create a temporary div to hold the printable content
        const printDiv = document.createElement('div');
        printDiv.className = 'print-only';
        const currentDate = new Date().toLocaleDateString();
        
        // Get customer details from DOM
        const customerNameDisplay = document.querySelector('.customer-name');
        const customerIdDisplay = document.querySelector('.customer-id');
        const customerAddress = document.querySelector('.info-item .fa-map-marker-alt')?.closest('.info-item')?.querySelector('div')?.innerHTML.split('<br>')[1]?.trim() || '';
        const customerPhone = document.querySelector('.info-item .fa-phone')?.closest('.info-item')?.querySelector('div')?.innerHTML.split('<br>')[1]?.trim() || '';
        const customerEmail = document.querySelector('.info-item .fa-envelope')?.closest('.info-item')?.querySelector('div')?.innerHTML.split('<br>')[1]?.trim() || '';
        
        // Collect product rates from Available Products container
        const productRates = {};
        document.querySelectorAll('.product-item').forEach(item => {
            const productName = item.querySelector('h4').textContent;
            const rateDisplay = item.querySelector('.rate-display').textContent;
            let rate = 0;
            
            if (rateDisplay.includes('₹')) {
                rate = parseFloat(rateDisplay.replace('₹', ''));
            }
            
            productRates[productName] = rate;
        });
        
        // Collect sales data to calculate product consumption
        const salesRows = Array.from(document.querySelectorAll('#salesHistory tbody tr'));
        const productConsumption = {};
        let totalTransportFare = 0;
        
        salesRows.forEach(row => {
            const productName = row.cells[3].textContent;
            const supplyQty = parseInt(row.cells[4].textContent) || 0;
            const transportFare = parseFloat(row.cells[7].textContent) || 0;
            
            if (productName && productName !== 'N/A') {
                if (!productConsumption[productName]) {
                    productConsumption[productName] = {
                        quantity: 0,
                        rate: productRates[productName] || 0,
                        total: 0
                    };
                }
                
                productConsumption[productName].quantity += supplyQty;
                productConsumption[productName].total = productConsumption[productName].quantity * productConsumption[productName].rate;
            }
            
            totalTransportFare += transportFare;
        });
        
        // Calculate grand total
        let productsTotal = 0;
        Object.values(productConsumption).forEach(item => {
            productsTotal += item.total;
        });
        
        const grandTotal = productsTotal + totalTransportFare;
        
        // Get product stock data
        const stockItems = Array.from(document.querySelectorAll('.product-stock-item')).map(item => item.outerHTML).join('');
        
        // Create the invoice layout
        printDiv.innerHTML = `
            <div class="print-content">
                <div class="header">
                    <div class="document-title">CUSTOMER INVOICE</div>
                    <div class="invoice-info">
                        <div class="invoice-date">
                            <strong>Date:</strong> ${currentDate}
                        </div>
                    </div>
                </div>

                <div class="customer-section">
                    <h3>Customer Information</h3>
                    <div class="customer-details">
                        <div class="customer-info-field"><strong>Name:</strong> ${customerNameDisplay ? customerNameDisplay.textContent : customerName}</div>
                        <div class="customer-info-field"><strong>ID:</strong> ${customerIdDisplay ? customerIdDisplay.textContent.replace('ID: ', '') : ''}</div>
                        ${customerAddress ? `<div class="customer-info-field"><strong>Address:</strong> ${customerAddress}</div>` : ''}
                        ${customerPhone ? `<div class="customer-info-field"><strong>Phone:</strong> ${customerPhone}</div>` : ''}
                        ${customerEmail ? `<div class="customer-info-field"><strong>Email:</strong> ${customerEmail}</div>` : ''}
                    </div>
                </div>
                
                <div class="stock-section">
                    <h3>Current Stock</h3>
                    <div class="stock-badges">
                        ${stockItems}
                    </div>
                </div>

                <div class="sales-section">
                    <h3>Sales History</h3>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>Invoice No</th>
                                <th>Date</th>
                                <th>Ship To Address</th>
                                <th>Product Name</th>
                                <th>Supply Qty</th>
                                <th>Received Qty</th>
                                <th>Transporter</th>
                                <th>Transport Fare</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salesRows.map(row => `
                                <tr>
                                    <td>${row.cells[0].textContent}</td>
                                    <td>${row.cells[1].textContent}</td>
                                    <td>${row.cells[2].textContent}</td>
                                    <td>${row.cells[3].textContent}</td>
                                    <td>${row.cells[4].textContent}</td>
                                    <td>${row.cells[5].textContent}</td>
                                    <td>${row.cells[6].textContent}</td>
                                    <td>${row.cells[7].textContent}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="summary-section">
                    <h3>Product Consumption Summary</h3>
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Quantity</th>
                                <th>Rate (₹)</th>
                                <th>Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(productConsumption).map(([productName, data]) => `
                                <tr>
                                    <td>${productName}</td>
                                    <td>${data.quantity}</td>
                                    <td>${data.rate.toFixed(2)}</td>
                                    <td>${data.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr class="transport-row">
                                <td colspan="3"><strong>Total Transport Fare</strong></td>
                                <td>${totalTransportFare.toFixed(2)}</td>
                            </tr>
                            <tr class="grand-total-row">
                                <td colspan="3"><strong>Grand Total</strong></td>
                                <td>${grandTotal.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="footer">
                    <div class="footer-note">Thank you for your business!</div>
                    <div class="generated-on">Generated on: ${currentDate}</div>
                </div>
            </div>
        `;

        // Add the print styles
        const style = document.createElement('style');
        style.textContent = `
            @media print {
                body * {
                    visibility: hidden;
                }
                .print-only, .print-only * {
                    visibility: visible;
                }
                .print-only {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                }
                .print-content {
                    padding: 20px;
                    font-family: Arial, sans-serif;
                    color: #333;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #ddd;
                }
                .document-title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2c3e50;
                }
                .invoice-info {
                    text-align: right;
                    margin-bottom: 0;
                }
                .invoice-date {
                    font-size: 14px;
                }
                h3 {
                    margin-top: 20px;
                    margin-bottom: 10px;
                    color: #2c3e50;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }
                .customer-section {
                    margin-bottom: 20px;
                }
                .customer-details {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .customer-info-field {
                    font-size: 14px;
                    line-height: 1.5;
                }
                .stock-section {
                    margin-bottom: 20px;
                }
                .stock-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 10px;
                }
                .product-stock-item {
                    display: inline-block;
                    padding: 6px 10px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    font-size: 13px;
                }
                .sales-section, .summary-section {
                    margin-bottom: 30px;
                }
                .print-table, .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    margin-top: 10px;
                }
                .print-table th, .print-table td,
                .summary-table th, .summary-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                .print-table th, .summary-table th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }
                .print-table tr:nth-child(even),
                .summary-table tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .transport-row {
                    background-color: #f0f0f0 !important;
                }
                .grand-total-row {
                    background-color: #e9f0f7 !important;
                    font-weight: bold;
                    font-size: 14px;
                }
                .grand-total-row td {
                    border-top: 2px solid #2c3e50;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #ddd;
                    display: flex;
                    justify-content: space-between;
                }
                .footer-note {
                    font-weight: bold;
                    font-size: 14px;
                }
                .generated-on {
                    font-size: 12px;
                    color: #7f8c8d;
                }
                @page {
                    margin: 1.5cm;
                    size: portrait;
                }
            }
        `;

        // Add elements to body
        document.body.appendChild(style);
        document.body.appendChild(printDiv);
        
        // Return the elements for cleanup
        return { style, printDiv };
    }

    // Update PDF and Print button click handlers
    pdfBtn.addEventListener('click', () => {
        const { style, printDiv } = generatePrintableContent();
        window.print();
        // Cleanup after printing
        document.body.removeChild(style);
        document.body.removeChild(printDiv);
    });

    printBtn.addEventListener('click', () => {
        const { style, printDiv } = generatePrintableContent();
        window.print();
        // Cleanup after printing
        document.body.removeChild(style);
        document.body.removeChild(printDiv);
    });

    // WhatsApp Share
    whatsappBtn.addEventListener('click', () => {
        const customerName = document.title.replace("'s Stock Details", '');
        const message = `Stock details for ${customerName}:\n${window.location.href}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    });

    // Add print styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            .topbar, .bottom-bar, #themeToggleBtn {
                display: none !important;
            }
            .draggable-container {
                padding-bottom: 0 !important;
            }
            body {
                background: white !important;
            }
            .customer-overview, .table-container {
                box-shadow: none !important;
                background: white !important;
            }
            .stock-table th {
                background-color: #f5f5f5 !important;
                color: black !important;
            }
            .stock-table td, .stock-table th {
                border-color: #ddd !important;
            }
            @page {
                margin: 2cm;
            }
        }
    `;
    document.head.appendChild(style);

    // Function to load product rates
    function loadProductRates() {
        // Create a popup container for product rates that will be shown when Save All button is clicked
        const popupContainer = document.createElement('div');
        popupContainer.className = 'popup-container';
        popupContainer.id = 'ratesPopup';
        popupContainer.style.display = 'none';
        
        // Create the popup content
        const popupContent = document.createElement('div');
        popupContent.className = 'popup-content';
        
        // Create popup header
        const popupHeader = document.createElement('div');
        popupHeader.className = 'popup-header';
        popupHeader.innerHTML = `
            <div>
                <h2>Product Rates for ${customerName}</h2>
                <p>Set rates for all available products</p>
            </div>
            <button id="closePopupBtn" class="popup-close-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Create search and controls section
        const popupControls = document.createElement('div');
        popupControls.className = 'popup-controls';
        popupControls.innerHTML = `
            <div class="search-container" style="flex: 1; max-width: 300px; position: relative;">
                <input type="text" id="popupRateSearchInput" placeholder="Search products..." style="
                    width: 100%;
                    padding: 8px 8px 8px 35px;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    background: var(--background-primary);
                    color: var(--text-primary);
                    font-weight: 500;
                ">
                <i class="fas fa-search" style="
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-secondary);
                "></i>
            </div>
            <button id="popupSaveAllRatesBtn" class="btn btn-primary">
                <i class="fas fa-save"></i> Save All Rates
            </button>
        `;
        
        // Create product rates list container
        const popupRatesList = document.createElement('div');
        popupRatesList.id = 'popupProductRatesList';
        popupRatesList.className = 'popup-body';
        
        // Show loading indicator
        popupRatesList.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: var(--accent-color);"></i><p style="margin-top: 10px; color: var(--text-secondary);">Loading all product rates...</p></div>';
        
        // Assemble the popup
        popupContent.appendChild(popupHeader);
        popupContent.appendChild(popupControls);
        popupContent.appendChild(popupRatesList);
        popupContainer.appendChild(popupContent);
        
        // Add the popup to the body
        document.body.appendChild(popupContainer);
        
        // Add event listener for close button
        document.getElementById('closePopupBtn').addEventListener('click', () => {
            popupContainer.style.display = 'none';
        });
        
        // Add event listener for clicking outside the popup to close it
        popupContainer.addEventListener('click', (e) => {
            if (e.target === popupContainer) {
                popupContainer.style.display = 'none';
            }
        });
        
        // Add event listener for Save All Rates button in the popup
        document.getElementById('popupSaveAllRatesBtn').addEventListener('click', saveAllRates);
        
        // Add event listener for the Save All button in the products section
        // This will show the popup when clicked
        const saveAllRatesBtn = document.getElementById('saveAllRatesBtn');
        if (saveAllRatesBtn) {
            saveAllRatesBtn.removeEventListener('click', saveAllRates);
            saveAllRatesBtn.addEventListener('click', () => {
                // Show the popup
                popupContainer.style.display = 'flex';
                
                // Load rates data if not already loaded
                if (popupRatesList.innerHTML === '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: var(--accent-color);"></i><p style="margin-top: 10px; color: var(--text-secondary);">Loading all product rates...</p></div>') {
                    loadRatesData();
                }
            });
        }
        
        // Function to load rates data
        function loadRatesData() {
            popupRatesList.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: var(--accent-color);"></i><p style="margin-top: 10px; color: var(--text-secondary);">Loading all product rates...</p></div>';
            
            // First, get all products
            fetch('/api/products')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch products');
                    }
                    return response.json();
                })
                .then(products => {
                    // Then get existing rates for this customer
                    return fetch(`/api/customer-rates?customer_name=${encodeURIComponent(customerName)}`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to fetch product rates');
                            }
                            return response.json();
                        })
                        .then(rates => {
                            // Create a map of existing rates
                            const ratesMap = {};
                            rates.forEach(rate => {
                                ratesMap[rate.product_name] = rate.rate;
                            });
                            
                            // Create default rates for all products that don't have rates
                            const allRates = products.map(product => ({
                                customer_name: customerName,
                                product_name: product.name,
                                rate: ratesMap[product.product_name] || ratesMap[product.name] || 0,
                                product_description: product.description || '',
                                empty_rate: 0
                            }));
                            
                            return allRates;
                        });
                })
                .then(rates => {
                    // Create a grid container for the rates
                    const ratesGrid = document.createElement('div');
                    ratesGrid.className = 'rates-grid';
                    ratesGrid.style.display = 'grid';
                    ratesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                    ratesGrid.style.gap = '15px';
                    
                    // Add each rate as a card in the grid
                    rates.forEach(rate => {
                        const rateCard = document.createElement('div');
                        rateCard.className = 'rate-card';
                        rateCard.setAttribute('data-product', rate.product_name);
                        rateCard.style.backgroundColor = 'var(--background-primary)';
                        rateCard.style.borderRadius = '8px';
                        rateCard.style.padding = '15px';
                        rateCard.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        rateCard.style.transition = 'all 0.3s ease';
                        rateCard.style.border = '1px solid var(--border-color)';
                        
                        rateCard.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <h3 style="margin: 0; color: var(--primary-color); font-weight: 600;">${rate.product_name}</h3>
                                <span class="rate-indicator" style="
                                    padding: 4px 8px;
                                    background: ${parseFloat(rate.rate) > 0 ? 'rgba(var(--accent-rgb), 0.15)' : '#f1f1f1'};
                                    color: ${parseFloat(rate.rate) > 0 ? 'var(--accent-color)' : 'var(--text-secondary)'};
                                    border-radius: 4px;
                                    font-size: 0.85em;
                                    font-weight: bold;
                                ">
                                    ${parseFloat(rate.rate) > 0 ? '₹' + parseFloat(rate.rate).toFixed(2) : 'No Rate Set'}
                                </span>
                            </div>
                            ${rate.product_description ? `
                            <p style="margin: 0 0 15px 0; font-size: 0.8em; color: var(--text-secondary);">
                                ${rate.product_description}
                            </p>` : ''}
                            <div style="margin-bottom: 15px;">
                                <label for="popup-rate-${rate.product_name}" style="display: block; margin-bottom: 5px; color: var(--text-primary); font-weight: 500;">
                                    Full Cylinder Rate:
                                </label>
                                <div style="display: flex; align-items: center;">
                                    <span style="margin-right: 10px; color: var(--text-primary); font-weight: 500;">₹</span>
                                <input type="number" 
                                        id="popup-rate-${rate.product_name}" 
                                       class="popup-rate-input" 
                                        value="${rate.rate || 0}" 
                                        style="
                                            flex: 1;
                                            padding: 8px;
                                            border: 1px solid var(--border-color);
                                            border-radius: 4px;
                                            background: var(--background-secondary);
                                            color: var(--text-primary);
                                            transition: all 0.2s ease;
                                            font-weight: 500;
                                        "
                                       min="0"
                                       step="0.01"
                                    >
                                </div>
                            </div>
                            <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                                <button class="popup-save-rate-btn btn btn-sm btn-primary" 
                                    data-product="${rate.product_name}">
                                    <i class="fas fa-save"></i> Save
                                </button>
                            </div>
                        `;
                        
                        ratesGrid.appendChild(rateCard);
                    });
                    
                    // Clear the loading indicator and add the rates grid
                    popupRatesList.innerHTML = '';
                    popupRatesList.appendChild(ratesGrid);
                    
                    // Add search functionality
                    const searchInput = document.getElementById('popupRateSearchInput');
                    if (searchInput) {
                        searchInput.addEventListener('input', function() {
                            const searchTerm = this.value.toLowerCase();
                            document.querySelectorAll('.rate-card').forEach(card => {
                                const productName = card.getAttribute('data-product').toLowerCase();
                                if (productName.includes(searchTerm)) {
                                    card.style.display = 'block';
                                } else {
                                    card.style.display = 'none';
                                }
                            });
                        });
                    }
                    
                    // Add hover effects to the rate cards
                    document.querySelectorAll('.rate-card').forEach(card => {
                        card.addEventListener('mouseenter', function() {
                            this.style.transform = 'translateY(-5px)';
                            this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                        });
                        
                        card.addEventListener('mouseleave', function() {
                            this.style.transform = 'translateY(0)';
                            this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        });
                    });
                    
                    // Add event listeners for input changes to update the rate indicator
                    document.querySelectorAll('.popup-rate-input').forEach(input => {
                        input.addEventListener('input', function() {
                            const card = this.closest('.rate-card');
                            const indicator = card.querySelector('.rate-indicator');
                            const rate = parseFloat(this.value) || 0;
                            
                            indicator.textContent = rate > 0 ? '₹' + rate.toFixed(2) : 'No Rate Set';
                            indicator.style.background = rate > 0 ? 'rgba(var(--accent-rgb), 0.15)' : '#f1f1f1';
                            indicator.style.color = rate > 0 ? 'var(--accent-color)' : 'var(--text-secondary)';
                        });
                        
                        // Add highlight effect on focus
                        input.addEventListener('focus', function() {
                            this.style.borderColor = 'var(--accent-color)';
                            this.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb), 0.2)';
                        });
                        
                        input.addEventListener('blur', function() {
                            this.style.borderColor = 'var(--border-color)';
                            this.style.boxShadow = 'none';
                        });
                    });
                    
                    // Add event listeners for save buttons
                    document.querySelectorAll('.popup-save-rate-btn').forEach(button => {
                        button.addEventListener('click', function() {
                            const productName = this.getAttribute('data-product');
                            const rateInput = document.getElementById(`popup-rate-${productName}`);
                            
                            if (rateInput) {
                                const rate = parseFloat(rateInput.value) || 0;
                                saveRate(productName, rate, false, this); // Pass the button for UI feedback
                            }
                        });
                    });
                })
                .catch(error => {
                    handleProductRatesError(error, popupRatesList);
                });
        }
        
        // Load sales history, initialize filters, and update stock display
        loadSalesHistory(customerName);
        initializeFilters();
        updateStockDisplay();
    }

    // Function to save individual rate
    function saveRate(productName, rate, silent = false, button = null) {
        // Get the save button for this product
        const saveButton = button || document.querySelector(`.popup-save-rate-btn[data-product="${productName}"]`);
        let originalBtnHTML = '';
        
        if (saveButton && !silent) {
            // Show saving indicator
            originalBtnHTML = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveButton.disabled = true;
        }
        
        fetch('/api/customer-rates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_name: customerName,
                product_name: productName,
                rate: rate
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save rate');
            }
            return response.json();
        })
        .then(data => {
            console.log('Rate saved successfully:', data);
            
            if (saveButton && !silent) {
                // Show success indicator
                saveButton.innerHTML = '<i class="fas fa-check"></i> Saved';
                saveButton.style.backgroundColor = '#4CAF50';
                
                // Update the main container with the new rate
                updateSingleRateInMainContainer(productName, rate);
                
                // Show success message
                const successMessage = document.createElement('div');
                successMessage.style.cssText = `
                    position: fixed;
                    bottom: 15px;
                    right: 15px;
                    background-color: #e5ffe5;
                    color: #44aa44;
                    padding: 5px 10px;
                    border-radius: 3px;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                    animation: fadeIn 0.3s;
                    font-size: 0.85em;
                `;
                successMessage.innerHTML = `<i class="fas fa-check-circle"></i> Rate saved`;
                document.body.appendChild(successMessage);
                
                // Remove message after 1.5 seconds
                setTimeout(() => {
                    if (successMessage.parentNode) {
                        successMessage.style.opacity = '0';
                        successMessage.style.transform = 'translateY(-8px)';
                        successMessage.style.transition = 'all 0.3s ease';
                        
                        setTimeout(() => {
                            if (successMessage.parentNode) {
                                document.body.removeChild(successMessage);
                            }
                        }, 300);
                    }
                    
                    // Reset button
                    setTimeout(() => {
                        saveButton.innerHTML = originalBtnHTML;
                        saveButton.disabled = false;
                        saveButton.style.backgroundColor = 'var(--accent-color)';
                    }, 500);
                }, 1500);
            }
        })
        .catch(error => {
            console.error('Error saving rate:', error);
            
            if (saveButton && !silent) {
                // Show error indicator
                saveButton.innerHTML = '<i class="fas fa-times"></i> Failed';
                saveButton.style.backgroundColor = '#f44336';
                
                // Show error message
                const errorMessage = document.createElement('div');
                errorMessage.style.cssText = `
                    position: fixed;
                    bottom: 15px;
                    right: 15px;
                    background-color: #ffe5e5;
                    color: #f44336;
                    padding: 5px 10px;
                    border-radius: 3px;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                    animation: fadeIn 0.3s;
                    font-size: 0.85em;
                `;
                errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to save rate`;
                document.body.appendChild(errorMessage);
                
                // Remove message after 2 seconds
                setTimeout(() => {
                    if (errorMessage.parentNode) {
                        errorMessage.style.opacity = '0';
                        errorMessage.style.transform = 'translateY(-8px)';
                        errorMessage.style.transition = 'all 0.3s ease';
                        
                        setTimeout(() => {
                            if (errorMessage.parentNode) {
                                document.body.removeChild(errorMessage);
                            }
                        }, 300);
                    }
                    
                    // Reset button
                    setTimeout(() => {
                        saveButton.innerHTML = originalBtnHTML;
                        saveButton.disabled = false;
                        saveButton.style.backgroundColor = 'var(--accent-color)';
                    }, 500);
                }, 2000);
            }
        });
    }
    
    // Function to save all rates at once
    function saveAllRates() {
        const saveAllBtn = document.getElementById('popupSaveAllRatesBtn') || document.getElementById('saveAllRatesBtn');
        const originalBtnHTML = saveAllBtn.innerHTML;
        saveAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveAllBtn.disabled = true;
        
        const rates = [];
        document.querySelectorAll('.popup-rate-input').forEach(input => {
            const productName = input.id.replace('popup-rate-', '');
            const rate = parseFloat(input.value) || 0;
            
            rates.push({
                customer_name: customerName,
                product_name: productName,
                rate: rate
            });
        });
        
        fetch('/api/customer-rates/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rates)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save rates');
            }
            return response.json();
        })
        .then(data => {
            console.log('All rates saved successfully:', data);
            
            // Show success indicator
            saveAllBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
            saveAllBtn.style.backgroundColor = '#4CAF50';
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.style.cssText = `
                position: fixed;
                bottom: 15px;
                right: 15px;
                background-color: #e5ffe5;
                color: #44aa44;
                padding: 5px 10px;
                border-radius: 3px;
                box-shadow: 0 1px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: fadeIn 0.3s;
                font-size: 0.85em;
            `;
            successMessage.innerHTML = `<i class="fas fa-check-circle"></i> All rates saved`;
            document.body.appendChild(successMessage);
            
            // Update the rates in the main product container
            updateProductRatesInMainContainer(rates);
            
            // Hide the popup after saving
            setTimeout(() => {
                const popupContainer = document.getElementById('ratesPopup');
                if (popupContainer) {
                    popupContainer.style.display = 'none';
                }
            }, 1500);
            
            // Remove message after 1.5 seconds
            setTimeout(() => {
                if (successMessage.parentNode) {
                    successMessage.style.opacity = '0';
                    successMessage.style.transform = 'translateY(-8px)';
                    successMessage.style.transition = 'all 0.3s ease';
                    
                    setTimeout(() => {
                        if (successMessage.parentNode) {
                            document.body.removeChild(successMessage);
                        }
                    }, 300);
                }
                
                // Reset button
                setTimeout(() => {
                    saveAllBtn.innerHTML = originalBtnHTML;
                    saveAllBtn.disabled = false;
                    saveAllBtn.style.backgroundColor = 'var(--accent-color)';
                }, 500);
            }, 1500);
        })
        .catch(error => {
            console.error('Error saving all rates:', error);
            
            // Show error indicator
            saveAllBtn.innerHTML = '<i class="fas fa-times"></i> Failed';
            saveAllBtn.style.backgroundColor = '#f44336';
            
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = `
                position: fixed;
                bottom: 15px;
                right: 15px;
                background-color: #ffe5e5;
                color: #f44336;
                padding: 5px 10px;
                border-radius: 3px;
                box-shadow: 0 1px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: fadeIn 0.3s;
                font-size: 0.85em;
            `;
            errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to save rates`;
            document.body.appendChild(errorMessage);
            
            // Remove message after 2 seconds
            setTimeout(() => {
                if (errorMessage.parentNode) {
                    errorMessage.style.opacity = '0';
                    errorMessage.style.transform = 'translateY(-8px)';
                    errorMessage.style.transition = 'all 0.3s ease';
                    
                    setTimeout(() => {
                        if (errorMessage.parentNode) {
                            document.body.removeChild(errorMessage);
                        }
                    }, 300);
                }
                
                // Reset button
                setTimeout(() => {
                    saveAllBtn.innerHTML = originalBtnHTML;
                    saveAllBtn.disabled = false;
                    saveAllBtn.style.backgroundColor = 'var(--accent-color)';
                }, 500);
            }, 2000);
        });
    }

    // Function to update the rates in the main product container
    function updateProductRatesInMainContainer(rates) {
        // Create a map of rates for easy lookup
        const ratesMap = {};
        rates.forEach(rate => {
            ratesMap[rate.product_name] = rate.rate;
        });
        
        // Update the rates in the product items
        document.querySelectorAll('.product-item').forEach(item => {
            const productName = item.querySelector('h4').textContent;
            const rateDisplay = item.querySelector('.rate-display');
            
            if (rateDisplay && ratesMap.hasOwnProperty(productName)) {
                const rate = parseFloat(ratesMap[productName]) || 0;
                rateDisplay.textContent = rate > 0 ? '₹' + rate.toFixed(2) : 'No rate set';
                
                // Highlight the updated rate with a brief animation
                rateDisplay.style.transition = 'background-color 0.3s ease';
                rateDisplay.style.backgroundColor = 'rgba(var(--accent-rgb), 0.15)';
                
                setTimeout(() => {
                    rateDisplay.style.backgroundColor = 'var(--background-secondary)';
                }, 1000);
            }
        });
    }

    // Function to update a single rate in the main container
    function updateSingleRateInMainContainer(productName, rate) {
        document.querySelectorAll('.product-item').forEach(item => {
            const itemProductName = item.querySelector('h4').textContent;
            if (itemProductName === productName) {
                const rateDisplay = item.querySelector('.rate-display');
                if (rateDisplay) {
                    const rateValue = parseFloat(rate) || 0;
                    rateDisplay.textContent = rateValue > 0 ? '₹' + rateValue.toFixed(2) : 'No rate set';
                    
                    // Highlight the updated rate with a brief animation
                    rateDisplay.style.transition = 'background-color 0.3s ease';
                    rateDisplay.style.backgroundColor = 'rgba(var(--accent-rgb), 0.15)';
                    
                    setTimeout(() => {
                        rateDisplay.style.backgroundColor = 'var(--background-secondary)';
                    }, 1000);
                }
            }
        });
    }

    // Improved error handling for the product rates fetch error
    function handleProductRatesError(error, container = null) {
        console.error('Error loading product rates:', error);
        const targetContainer = container || document.getElementById('productRatesList');
        if (targetContainer) {
            targetContainer.innerHTML = `
                <div class="error">
                    <strong>Error loading product rates:</strong> ${error.message}
                    <button id="retryRatesBtn" class="btn btn-sm btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
            
            // Add retry button functionality
            document.getElementById('retryRatesBtn')?.addEventListener('click', () => {
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: var(--accent-color);"></i><p style="margin-top: 10px; color: var(--text-secondary);">Loading all product rates...</p></div>';
                    loadRatesData();
                } else {
                    loadProductRates();
                }
            });
        }
    }

    // Create the bottom bar for stock display
    function createBottomBar() {
        // Remove any existing bottom bar first
        const existingBottomBar = document.querySelector('.bottom-bar');
        if (existingBottomBar) {
            existingBottomBar.remove();
        }

        const bottomBar = document.createElement('div');
        bottomBar.className = 'bottom-bar';
        bottomBar.style.position = 'fixed';
        bottomBar.style.bottom = '0';
        bottomBar.style.left = '0';
        bottomBar.style.width = '100%';
        bottomBar.style.backgroundColor = 'var(--background-secondary)';
        bottomBar.style.borderTop = '1px solid var(--border-color)';
        bottomBar.style.padding = '6px 12px';
        bottomBar.style.display = 'flex';
        bottomBar.style.justifyContent = 'space-between';
        bottomBar.style.alignItems = 'center';
        bottomBar.style.gap = '6px';
        bottomBar.style.zIndex = '100';
        bottomBar.style.boxSizing = 'border-box'; // Ensure padding is included in the height
        
        // Create left side container for action buttons
        const actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.className = 'action-buttons-container btn-group';
        
        // Create PDF Button
        const pdfBtn = document.createElement('button');
        pdfBtn.id = 'pdfBtn';
        pdfBtn.className = 'btn btn-danger btn-sm';
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
        
        // Create Print Button
        const printBtn = document.createElement('button');
        printBtn.id = 'printBtn';
        printBtn.className = 'btn btn-success btn-sm';
        printBtn.innerHTML = '<i class="fas fa-print"></i> Print';
        
        // Create WhatsApp Button
        const whatsappBtn = document.createElement('button');
        whatsappBtn.id = 'whatsappBtn';
        whatsappBtn.className = 'btn btn-sm';
        whatsappBtn.style.backgroundColor = '#25D366';
        whatsappBtn.style.color = 'white';
        whatsappBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Share';
        
        // Add buttons to action container
        actionButtonsContainer.appendChild(pdfBtn);
        actionButtonsContainer.appendChild(printBtn);
        actionButtonsContainer.appendChild(whatsappBtn);
        
        // Create right side container for stock items
        const stockItemsContainer = document.createElement('div');
        stockItemsContainer.className = 'stock-items-container';
        stockItemsContainer.style.display = 'flex';
        stockItemsContainer.style.flexWrap = 'wrap';
        stockItemsContainer.style.gap = '6px';
        stockItemsContainer.style.flex = '1';
        stockItemsContainer.style.justifyContent = 'flex-end';
        
        // Add containers to bottom bar
        bottomBar.appendChild(actionButtonsContainer);
        bottomBar.appendChild(stockItemsContainer);
        
        // Add event listeners for actions
        // PDF Generation
        pdfBtn.addEventListener('click', () => {
            const { style, printDiv } = generatePrintableContent();
            window.print();
            document.body.removeChild(style);
            document.body.removeChild(printDiv);
        });

        // Print functionality
        printBtn.addEventListener('click', () => {
            const { style, printDiv } = generatePrintableContent();
            window.print();
            document.body.removeChild(style);
            document.body.removeChild(printDiv);
        });

        // WhatsApp Share
        whatsappBtn.addEventListener('click', () => {
            const customerName = document.title.replace("'s Stock Details", '');
            const message = `Stock details for ${customerName}:\n${window.location.href}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });
        
        document.body.appendChild(bottomBar);
        return stockItemsContainer; // Return the container for stock items
    }

    // Function to load sales history
    function loadSalesHistory(customerName) {
        // Add some compact styling to the table
        const tableStyles = document.createElement('style');
        tableStyles.textContent = `
            #salesHistory {
                font-size: 0.9em;
                border-collapse: collapse;
                width: 100%;
                color: var(--text-primary);
            }
            
            #salesHistory th, #salesHistory td {
                padding: 6px 8px;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-primary);
            }
            
            #salesHistory th {
                font-weight: 600;
                text-align: left;
                background-color: var(--background-secondary);
                color: var(--text-primary);
            }
            
            #salesHistory tr:hover {
                background-color: var(--background-hover);
            }
            
            .table-container {
                margin-top: 15px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .table-container h2 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 1.2em;
                color: var(--text-primary);
            }
            
            /* Error styling */
            .error {
                color: #e53935;
                padding: 10px;
                background-color: rgba(229, 57, 53, 0.1);
                border-radius: 4px;
                margin: 10px 0;
                border-left: 3px solid #e53935;
            }
            
            /* Loading indicator */
            .loading {
                padding: 15px;
                text-align: center;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(tableStyles);
        
        // Get the sales history table tbody
        const salesTable = document.querySelector('#salesHistory tbody');
        if (!salesTable) {
            console.error('Sales history table not found');
            return;
        }
        
        // Show loading indicator
        salesTable.innerHTML = `<tr><td colspan="10" class="loading">Loading sales history...</td></tr>`;
        
        // Get current financial year for filtering
        const currentFY = getCurrentFinancialYear();
        const financialYearParam = currentFY ? `&financialYearId=${encodeURIComponent(currentFY.id)}` : '';
        
        // Fetch sales data for this customer
        fetch(`/api/sales?${financialYearParam}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(sales => {
                // Filter sales for this customer
                const customerSales = sales.filter(sale => sale.accountName === customerName);
                
                // Update the global filteredSales variable for use in other functions
                filteredSales = customerSales;
                
                // Clear loading indicator
                salesTable.innerHTML = '';
                
                if (customerSales.length === 0) {
                    salesTable.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px;">No sales history found for this customer</td></tr>`;
                    return;
                }
                
                // Sort by date (newest first)
                customerSales.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Display the sales data
                customerSales.forEach(sale => {
                    // Check if the sale has products array (multi-product implementation)
                    if (sale.products && Array.isArray(sale.products) && sale.products.length > 0) {
                        // For multi-product sales, create a row for each product
                        sale.products.forEach((product, index) => {
                            const row = salesTable.insertRow();
                            // Only show invoice and date on the first product row
                            row.innerHTML = `
                                <td>${index === 0 ? (sale.invoiceNo || '-') : ''}</td>
                                <td>${index === 0 ? formatDate(sale.date) : ''}</td>
                                <td>${sale.shipToAddress || '-'}</td>
                                <td>${product.productName || '-'}</td>
                                <td>${product.supplyQty || '0'}</td>
                                <td>${product.receivedQty || '0'}</td>
                                <td>${sale.transporterName || '-'}</td>
                                <td>${sale.transporterFare || '0'}</td>
                                <td>${sale.container || '-'}</td>
                                <td>${sale.remark || '-'}</td>
                            `;
                        });
                    } else {
                        // For single-product sales
                        const row = salesTable.insertRow();
                        row.innerHTML = `
                            <td>
                                <a href="sales.html?edit=${sale.id}" style="color: var(--primary-color); text-decoration: underline;">
                                    ${sale.invoiceNo || '-'}
                                </a>
                            </td>
                            <td>${formatDate(sale.date)}</td>
                            <td>${sale.shipToAddress || '-'}</td>
                            <td>${sale.productName || '-'}</td>
                            <td>${sale.supplyQty || '0'}</td>
                            <td>${sale.receivedQty || '0'}</td>
                            <td>${sale.transporterName || '-'}</td>
                            <td>${sale.transporterFare || '0'}</td>
                            <td>${sale.container || '-'}</td>
                            <td>${sale.remark || '-'}</td>
                        `;
                    }
                });
                
                // Add a counter to the section title
                const salesHistoryTitle = document.querySelector('.table-container h2');
                if (salesHistoryTitle) {
                    salesHistoryTitle.textContent = `Sales History (${customerSales.length} transactions)`;
                }
                
                // Update the bottom bar to show current stock information
                updateStockDisplay();
            })
            .catch(error => {
                console.error('Error loading sales history:', error);
                salesTable.innerHTML = `
                    <tr>
                        <td colspan="10" class="error">
                            Error loading sales history: ${error.message}
                        </td>
                    </tr>
                `;
            });
    }
    
    // Helper function to format dates
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
});