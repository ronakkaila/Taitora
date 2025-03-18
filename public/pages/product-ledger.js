document.addEventListener('DOMContentLoaded', () => {
    const productNameElem = document.getElementById('productName');
    const ledgerTableBody = document.getElementById('ledgerTableBody');
    const totalFilledReceivedElem = document.getElementById('totalFilledReceived');
    const totalFilledSuppliedElem = document.getElementById('totalFilledSupplied');
    const totalEmptyReceivedElem = document.getElementById('totalEmptyReceived');
    const totalEmptySuppliedElem = document.getElementById('totalEmptySupplied');

    // Get product name from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const productName = urlParams.get('product');
    productNameElem.textContent = productName;

    // Display current financial year
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
            margin-top: 10px;
            font-size: 14px;
            display: inline-block;
        `;
        document.querySelector('.product-info').appendChild(fyDisplay);
    }

    // Function to load ledger data for the product
    async function loadLedgerData() {
        try {
            // Show loading state in the table
            ledgerTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i> Loading ledger data...
                    </td>
                </tr>
            `;
            
            // Add financial year filter if available
            const financialYearParam = currentFY ? `&financialYearId=${encodeURIComponent(currentFY.id)}` : '';
            
            const [sales, purchases] = await Promise.all([
                fetch(`/api/sales?productName=${encodeURIComponent(productName)}${financialYearParam}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Sales API error: ${res.status}`);
                        return res.json();
                    }),
                fetch(`/api/purchases?productName=${encodeURIComponent(productName)}${financialYearParam}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Purchases API error: ${res.status}`);
                        return res.json();
                    })
            ]);

            // Clear the table before adding new rows
            ledgerTableBody.innerHTML = '';
            
            let totalFilledReceived = 0;
            let totalFilledSupplied = 0;
            let totalEmptyReceived = 0;
            let totalEmptySupplied = 0;
            
            // Check if we have any data to display
            if (sales.length === 0 && purchases.length === 0) {
                ledgerTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 20px;">
                            No transactions found for ${productName}${currentFY ? ` in financial year ${currentFY.label}` : ''}
                        </td>
                    </tr>
                `;
                
                // Still update totals (all zeros)
                totalFilledReceivedElem.textContent = totalFilledReceived;
                totalFilledSuppliedElem.textContent = totalFilledSupplied;
                totalEmptyReceivedElem.textContent = totalEmptyReceived;
                totalEmptySuppliedElem.textContent = totalEmptySupplied;
                return;
            }

            // Populate ledger table with sales data
            sales.forEach(sale => {
                const row = document.createElement('tr');
                
                // Create date cell
                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(sale.date).toLocaleDateString('en-GB');
                row.appendChild(dateCell);
                
                // Create transaction type cell
                const typeCell = document.createElement('td');
                typeCell.textContent = 'Sale';
                typeCell.style.fontWeight = 'bold';
                typeCell.style.color = 'var(--accent-color)';
                row.appendChild(typeCell);
                
                // Create invoice number cell - make it clickable
                const invoiceCell = document.createElement('td');
                const invoiceLink = document.createElement('a');
                invoiceLink.textContent = sale.invoiceNo;
                invoiceLink.href = "javascript:void(0)";
                invoiceLink.style.color = "var(--primary-color)";
                invoiceLink.style.textDecoration = "underline";
                invoiceLink.style.cursor = "pointer";
                invoiceLink.setAttribute('data-id', sale.id);
                invoiceLink.setAttribute('data-type', 'sale');
                invoiceLink.addEventListener('click', function() {
                    window.location.href = `sales.html?edit=${sale.id}`;
                });
                invoiceCell.appendChild(invoiceLink);
                row.appendChild(invoiceCell);
                
                // Create remaining cells
                const filledReceivedCell = document.createElement('td');
                filledReceivedCell.textContent = '0';
                row.appendChild(filledReceivedCell);
                
                const filledSuppliedCell = document.createElement('td');
                filledSuppliedCell.textContent = sale.supplyQty || '0';
                row.appendChild(filledSuppliedCell);
                
                const emptyReceivedCell = document.createElement('td');
                emptyReceivedCell.textContent = sale.receivedQty || '0';
                row.appendChild(emptyReceivedCell);
                
                const emptySuppliedCell = document.createElement('td');
                emptySuppliedCell.textContent = '0';
                row.appendChild(emptySuppliedCell);

                totalFilledSupplied += parseInt(sale.supplyQty) || 0;
                totalEmptyReceived += parseInt(sale.receivedQty) || 0;

                ledgerTableBody.appendChild(row);
            });

            // Populate ledger table with purchase data
            purchases.forEach(purchase => {
                const row = document.createElement('tr');
                
                // Create date cell
                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(purchase.date).toLocaleDateString('en-GB');
                row.appendChild(dateCell);
                
                // Create transaction type cell
                const typeCell = document.createElement('td');
                typeCell.textContent = 'Purchase';
                typeCell.style.fontWeight = 'bold';
                typeCell.style.color = '#4caf50'; // Green color for purchases
                row.appendChild(typeCell);
                
                // Create invoice number cell - make it clickable
                const invoiceCell = document.createElement('td');
                const invoiceLink = document.createElement('a');
                invoiceLink.textContent = purchase.invoiceNo;
                invoiceLink.href = "javascript:void(0)";
                invoiceLink.style.color = "var(--primary-color)";
                invoiceLink.style.textDecoration = "underline";
                invoiceLink.style.cursor = "pointer";
                invoiceLink.setAttribute('data-id', purchase.id);
                invoiceLink.setAttribute('data-type', 'purchase');
                invoiceLink.addEventListener('click', function() {
                    window.location.href = `purchases.html?edit=${purchase.id}`;
                });
                invoiceCell.appendChild(invoiceLink);
                row.appendChild(invoiceCell);
                
                // Create remaining cells
                const filledReceivedCell = document.createElement('td');
                filledReceivedCell.textContent = purchase.receivedQty || '0';
                row.appendChild(filledReceivedCell);
                
                const filledSuppliedCell = document.createElement('td');
                filledSuppliedCell.textContent = '0';
                row.appendChild(filledSuppliedCell);
                
                const emptyReceivedCell = document.createElement('td');
                emptyReceivedCell.textContent = '0';
                row.appendChild(emptyReceivedCell);
                
                const emptySuppliedCell = document.createElement('td');
                emptySuppliedCell.textContent = purchase.supplyQty || '0';
                row.appendChild(emptySuppliedCell);

                totalFilledReceived += parseInt(purchase.receivedQty) || 0;
                totalEmptySupplied += parseInt(purchase.supplyQty) || 0;

                ledgerTableBody.appendChild(row);
            });

            // Update totals
            totalFilledReceivedElem.textContent = totalFilledReceived;
            totalFilledSuppliedElem.textContent = totalFilledSupplied;
            totalEmptyReceivedElem.textContent = totalEmptyReceived;
            totalEmptySuppliedElem.textContent = totalEmptySupplied;

        } catch (error) {
            console.error('Error loading ledger data:', error);
            ledgerTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #f44336;">
                        <i class="fas fa-exclamation-circle" style="margin-right: 10px;"></i> 
                        Error loading ledger data: ${error.message}
                    </td>
                </tr>
            `;
            
            // Set totals to 0 or empty in case of error
            totalFilledReceivedElem.textContent = '0';
            totalFilledSuppliedElem.textContent = '0';
            totalEmptyReceivedElem.textContent = '0';
            totalEmptySuppliedElem.textContent = '0';
        }
    }

    // Load ledger data
    loadLedgerData();
}); 