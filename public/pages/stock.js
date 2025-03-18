    document.addEventListener('DOMContentLoaded', () => {
    const stockSummary = document.getElementById('stockSummary');
    const stockTableBody = document.getElementById('stockTableBody');
    const refreshBtn = document.getElementById('refreshBtn');

    // Function to apply consistent styling to the stock table
    function styleStockTable() {
        // Get the table and its header row
        const stockTable = document.getElementById('stockTable');
        if (!stockTable) return;
        
        const headerRow = stockTable.querySelector('thead tr');
        if (!headerRow) return;
        
        const headers = headerRow.querySelectorAll('th');
        
        // Style the headers consistent with the data cells
        if (headers.length > 0) {
            // First column (Product) is left-aligned
            headers[0].style.textAlign = 'left';
            headers[0].style.paddingLeft = '16px';
            
            // Middle columns (Full Stock, Empty Stock) are right-aligned
            if (headers.length > 1) {
                headers[1].style.textAlign = 'right';
                headers[1].classList.add('number-header');
            }
            
            if (headers.length > 2) {
                headers[2].style.textAlign = 'right';
                headers[2].classList.add('number-header');
            }
            
            // Last column (Current Stock) is center-aligned
            if (headers.length > 3) {
                headers[3].style.textAlign = 'center';
                headers[3].classList.add('stock-header');
            }
        }
    }

    // Function to create a stock card
    function createStockCard(title, stock, type) {
        // Extract the product name (removing " Filled" or " Empty" from the title)
        const productName = title.replace(/ (Filled|Empty)$/, '');
        
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.style.cssText = `
            background: var(--card-bg);
            border-radius: 10px;
            padding: 20px;
            box-shadow: var(--shadow);
            display: flex;
            flex-direction: column;
            gap: 10px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-3px)';
            card.style.boxShadow = 'var(--shadow-md)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'var(--shadow)';
        });
        
        // Make the entire card clickable
        card.addEventListener('click', () => {
            window.location.href = `product-ledger.html?product=${encodeURIComponent(productName)}`;
        });

        const titleElem = document.createElement('h3');
        titleElem.textContent = title;
        titleElem.style.margin = '0';

        const stockElem = document.createElement('div');
        stockElem.className = 'stock-value';
        stockElem.textContent = stock || '0';
        stockElem.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            color: ${type === 'filled' ? 'var(--primary-color)' : 'var(--warning-color)'};
        `;

        card.appendChild(titleElem);
        card.appendChild(stockElem);
        return card;
    }

    // Function to create a stock table row
    function createStockRow(movement) {
        const row = document.createElement('tr');
        
        // Make the entire row clickable
        row.style.cursor = 'pointer';
        
        // Add single click event listener
        row.addEventListener('click', () => {
            row.classList.add('row-highlight');
            setTimeout(() => {
                row.classList.remove('row-highlight');
            }, 300);
        });
        
        // Add double click event listener
        row.addEventListener('dblclick', () => {
            window.location.href = `product-ledger.html?product=${encodeURIComponent(movement.productName)}`;
        });
        
        // Format date
        const date = new Date(movement.date);
        const formattedDate = date.toLocaleDateString('en-GB');

        // Fetch totals from product ledger
        async function fetchProductLedgerTotals(productName) {
            try {
                const [sales, purchases] = await Promise.all([
                    fetch(`/api/sales?productName=${encodeURIComponent(productName)}`).then(res => res.json()),
                    fetch(`/api/purchases?productName=${encodeURIComponent(productName)}`).then(res => res.json())
                ]);

                let totalFilledReceived = 0;
                let totalFilledSupplied = 0;
                let totalEmptyReceived = 0;
                let totalEmptySupplied = 0;

                // Calculate totals from sales
                sales.forEach(sale => {
                    totalFilledSupplied += sale.supplyQty || 0;
                    totalEmptyReceived += sale.receivedQty || 0;
                });

                // Calculate totals from purchases
                purchases.forEach(purchase => {
                    totalFilledReceived += purchase.receivedQty || 0;
                    totalEmptySupplied += purchase.supplyQty || 0;
                });

                return {
                    totalFilledReceived,
                    totalFilledSupplied,
                    totalEmptyReceived,
                    totalEmptySupplied
                };
            } catch (error) {
                console.error('Error fetching product ledger totals:', error);
                return null;
            }
        }

        // Create cells with async data
        fetchProductLedgerTotals(movement.productName).then(totals => {
            if (totals) {
                const cells = [
                    { text: movement.productName, class: '' },
                    { text: movement.fullStock || movement.filledStock || '0', class: 'number-cell' }, // Full opening stock
                    { text: movement.emptyStock || '0', class: 'number-cell' }, // Empty opening stock
                    { 
                        text: `F: ${(movement.fullStock || movement.filledStock || 0) + totals.totalFilledReceived - totals.totalFilledSupplied}\nE: ${(movement.emptyStock || 0) + totals.totalEmptyReceived - totals.totalEmptySupplied}`, 
                        class: 'stock-cell highlight-cell'
                    }
                ];

                cells.forEach((cell, index) => {
                    const td = document.createElement('td');
                    td.className = cell.class;
                    td.textContent = cell.text || '0';
                    
                    // Apply specific alignment based on cell type
                    if (index === 0) { // Product name (first column)
                        td.style.textAlign = 'left';
                    } else if (index === 1 || index === 2) { // Number cells (Full stock, Empty stock)
                        td.style.textAlign = 'right';
                    } else { // Other cells (typically the combined stocks cell)
                        td.style.textAlign = 'center';
                    }
                    
                    row.appendChild(td);
                });
            }
        });

        return row;
    }

    // Function to display stock summary
    function displayStockSummary(summaryData) {
        stockSummary.innerHTML = '';
        stockSummary.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        `;

        summaryData.forEach(data => {
            stockSummary.appendChild(createStockCard(`${data.productName} Filled`, data.filledStock, 'filled'));
            stockSummary.appendChild(createStockCard(`${data.productName} Empty`, data.emptyStock, 'empty'));
        });
    }

    // Function to display stock movements
    function displayStockMovements(movementsData) {
        stockTableBody.innerHTML = '';
        
        // Group movements by product name only
        const groupedMovements = {};
        movementsData.forEach(movement => {
            const key = movement.productName;
            if (!groupedMovements[key]) {
                groupedMovements[key] = {
                    ...movement,
                    openingStock: movement.openingStock || 0,
                    filledStock: movement.filledStock || 0,
                    emptyStock: movement.emptyStock || 0,
                    filledReceived: movement.filledReceived || 0,
                    filledSupplied: movement.filledSupplied || 0,
                    emptyReceived: movement.emptyReceived || 0,
                    emptySupplied: movement.emptySupplied || 0
                };
            } else {
                // Update quantities
                groupedMovements[key].filledReceived += movement.filledReceived || 0;
                groupedMovements[key].filledSupplied += movement.filledSupplied || 0;
                groupedMovements[key].emptyReceived += movement.emptyReceived || 0;
                groupedMovements[key].emptySupplied += movement.emptySupplied || 0;
                groupedMovements[key].filledStock = movement.filledStock || 0;
                groupedMovements[key].emptyStock = movement.emptyStock || 0;
            }
        });

        // Create rows for grouped movements
        Object.values(groupedMovements)
            .sort((a, b) => a.productName.localeCompare(b.productName))
            .forEach(movement => {
                const row = createStockRow(movement);
                stockTableBody.appendChild(row);
            });
    }

    // Function to load all products and their stock movements
    async function loadAllProducts() {
        try {
            const products = await fetch('/api/products').then(res => res.json());
            const movements = await fetch('/api/stock/movements').then(res => res.json());

            // Create a map of product names to their stock movements
            const movementMap = {};
            movements.forEach(movement => {
                movementMap[movement.productName] = movement;
            });

            // Clear existing rows
            stockTableBody.innerHTML = '';

            // Create rows for each product
            products.forEach(product => {
                const movement = movementMap[product.name] || {};
                const row = createStockRow({
                    productName: product.name,
                    fullStock: product.fullStock || 0,
                    emptyStock: product.emptyStock || 0,
                    filledReceived: movement.filledReceived || 0,
                    filledSupplied: movement.filledSupplied || 0,
                    emptyReceived: movement.emptyReceived || 0,
                    emptySupplied: movement.emptySupplied || 0,
                    filledStock: movement.filledStock || product.fullStock || 0,
                    emptyStock: movement.emptyStock || product.emptyStock || 0
                });
                stockTableBody.appendChild(row);
            });
            
            return products; // Return products for further processing
        } catch (error) {
            console.error('Error loading products and stock movements:', error);
            return []; // Return empty array on error
        }
    }

    // Function to refresh stock data
    async function refreshStockData() {
        try {
            // Disable refresh button and show loading state
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="refresh-icon spinning">↻</span> Refreshing...';
            
            // Clear existing data
            stockSummary.innerHTML = '';
            stockTableBody.innerHTML = '';

            // Fetch new data
            const [summaryData, movementsData] = await Promise.all([
                fetch('/api/stock/summary').then(res => res.json()),
                fetch('/api/stock/movements').then(res => res.json())
            ]);

            // Display new data
            displayStockSummary(summaryData);
            displayStockMovements(movementsData);
            
            // Apply consistent styling to the table
            styleStockTable();
        } catch (error) {
            console.error('Error refreshing stock data:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'Failed to refresh stock data. Please try again.';
            stockSummary.appendChild(errorDiv);
        } finally {
            // Reset refresh button state
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="refresh-icon">↻</span> Refresh';
        }
    }

    // Load initial data
    loadAllProducts().then(() => {
        // Apply table styling
        styleStockTable();
    });

    // Set up refresh button
    refreshBtn.addEventListener('click', refreshStockData);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .error-message {
            color: var(--danger-color);
            padding: 10px;
            border-radius: 5px;
            background: var(--danger-bg);
            margin: 10px;
            text-align: center;
        }
        
        /* Improved table alignment styles */
        #stockTable {
            width: 100%;
            border-collapse: collapse;
        }
        
        #stockTable th,
        #stockTable td {
            padding: 8px 12px;
            text-align: center;
            vertical-align: middle;
        }
        
        #stockTable th {
            background-color: var(--primary-color-light, #e6f7ff);
            color: var(--primary-color-dark, #1a237e);
            font-weight: bold;
            border-bottom: 2px solid var(--primary-color, #4a90e2);
        }
        
        #stockTable th:first-child,
        #stockTable td:first-child {
            text-align: left;
            padding-left: 16px;
        }
        
        .number-header,
        .number-cell {
            text-align: right !important;
            font-family: monospace;
            padding: 8px 16px;
        }
        
        .stock-header,
        .stock-cell {
            text-align: center !important;
            font-family: monospace;
            padding: 8px 16px;
            white-space: pre-line;
            font-weight: bold;
        }
        
        .positive {
            color: var(--success-color);
            font-weight: 500;
        }
        
        .negative {
            color: var(--danger-color);
            font-weight: 500;
        }
        
        .highlight-cell {
            background-color: rgba(74, 144, 226, 0.05);
        }
        
        .refresh-icon.spinning {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            100% { transform: rotate(360deg); }
        }
        
        /* Style for clickable rows */
        #stockTableBody tr {
            transition: background-color 0.2s, transform 0.2s;
        }
        
        #stockTableBody tr:hover {
            background-color: rgba(74, 144, 226, 0.1);
            transform: translateY(-2px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 1;
        }
        
        /* Add visual feedback for clicking */
        .row-highlight {
            background-color: rgba(74, 144, 226, 0.2) !important;
        }
        
        /* Add a small indicator arrow to show it's clickable */
        #stockTableBody tr td:last-child::after {
            content: ' →';
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        #stockTableBody tr:hover td:last-child::after {
            opacity: 1;
        }
        
        /* Add double-click hint */
        #stockTableBody tr::before {
            content: '';
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 12px;
            color: var(--primary-color);
        }
        
        #stockTableBody tr:hover::before {
            content: 'Double-click to open';
            opacity: 0.7;
        }
        
        /* Style for stock cards */
        .stock-card {
            position: relative;
        }
        
        .stock-card::after {
            content: '→';
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 16px;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
        }
        
        .stock-card:hover::after {
            opacity: 1;
            transform: translateX(3px);
        }
    `;
    document.head.appendChild(style);
});
