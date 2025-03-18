document.addEventListener('DOMContentLoaded', () => {
    // Get transporter ID and data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const transporterId = urlParams.get('id');
    const encodedData = urlParams.get('data');

    if (!transporterId) {
        alert('No transporter selected');
        window.location.href = 'transporters.html';
        return;
    }

    // If we have encoded data, use it immediately
    if (encodedData) {
        try {
            const transporter = JSON.parse(decodeURIComponent(encodedData));
            displayTransporterDetails(transporter);
        } catch (error) {
            console.error('Error parsing transporter data:', error);
            // Fallback to API if data parsing fails
            loadTransporterDetails(transporterId);
        }
    } else {
        // Fallback to API if no encoded data
        loadTransporterDetails(transporterId);
    }

    // Load transactions in any case
    loadTransporterTransactions(transporterId);

    function displayTransporterDetails(transporter) {
        document.getElementById('transporterName').textContent = transporter.name || '-';
        document.getElementById('transporterMobile').textContent = transporter.mobile || '-';
        document.getElementById('transporterAddress').textContent = transporter.address || '-';
        document.getElementById('transporterDetails').textContent = transporter.details || '-';
        document.title = `${transporter.name} - Transporter Overview`;
    }

    function loadTransporterDetails(id) {
        fetch(`/api/transporters/${id}`)
            .then(response => response.json())
            .then(transporter => {
                displayTransporterDetails(transporter);
            })
            .catch(error => {
                console.error('Error loading transporter details:', error);
                alert('Error loading transporter details');
            });
    }

    function loadTransporterTransactions(id) {
        // First get the transporter name
        fetch(`/api/transporters/${id}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(transporter => {
                const transporterName = transporter.name;
                
                // Get current financial year
                const currentFY = getCurrentFinancialYear();
                const financialYearParam = currentFY ? `&financialYearId=${encodeURIComponent(currentFY.id)}` : '';
                
                // Display financial year if we have one
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
                    const infoContainer = document.querySelector('.transporter-info');
                    if (infoContainer && infoContainer.parentNode) {
                        infoContainer.parentNode.insertBefore(fyDisplay, infoContainer.nextSibling);
                    } else {
                        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
                        const existingHeader = document.querySelector('h1, h2, h3, header');
                        if (existingHeader && existingHeader.parentNode) {
                            existingHeader.parentNode.insertBefore(fyDisplay, existingHeader.nextSibling);
                        } else {
                            mainContent.prepend(fyDisplay);
                        }
                    }
                }
                
                // Then fetch all sales and purchases with financial year filter
                return Promise.all([
                    fetch(`/api/sales?${financialYearParam}`).then(res => {
                        if (!res.ok) throw new Error(`Sales API error! status: ${res.status}`);
                        return res.json();
                    }),
                    fetch(`/api/purchases?${financialYearParam}`).then(res => {
                        if (!res.ok) throw new Error(`Purchases API error! status: ${res.status}`);
                        return res.json();
                    }),
                    Promise.resolve(transporterName)
                ]);
            })
            .then(([sales, purchases, transporterName]) => {
                // Filter and map sales transactions
                const salesTransactions = sales
                    .filter(sale => sale.transporterName === transporterName)
                    .map(sale => ({
                        id: sale.id,
                        invoiceNo: sale.invoiceNo,
                        date: sale.date,
                        type: 'sale',
                        accountName: sale.accountName,
                        productName: sale.productName,
                        quantity: sale.supplyQty,
                        shipToAddress: sale.shipToAddress,
                        transporterFare: sale.transporterFare,
                        remark: sale.remark
                    }));

                // Filter and map purchase transactions
                const purchaseTransactions = purchases
                    .filter(purchase => purchase.transporterName === transporterName)
                    .map(purchase => ({
                        id: purchase.id,
                        invoiceNo: purchase.invoiceNo,
                        date: purchase.date,
                        type: 'purchase',
                        accountName: purchase.accountName,
                        productName: purchase.productName,
                        quantity: purchase.supplyQty,
                        shipToAddress: purchase.shipToAddress,
                        transporterFare: purchase.transporterFare,
                        remark: purchase.remark
                    }));

                // Combine and sort transactions by date
                const transactions = [...salesTransactions, ...purchaseTransactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                // Calculate total earnings
                const totalEarnings = transactions.reduce((sum, t) => sum + (parseFloat(t.transporterFare) || 0), 0);
                
                // Update UI with transaction count and earnings
                document.getElementById('totalTransactions').textContent = 
                    `${transactions.length} Transactions (Total Earnings: ₹${totalEarnings.toLocaleString('en-IN')})`;
                
                renderTransactions(transactions);
            })
            .catch(error => {
                console.error('Error loading transactions:', error);
                document.getElementById('totalTransactions').textContent = 'Error loading transactions';
                document.getElementById('transactionsTableBody').innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 20px; color: red;">
                            Error loading transactions: ${error.message}
                        </td>
                    </tr>
                `;
            });
    }

    function renderTransactions(transactions) {
        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = '';

        transactions.forEach(transaction => {
            const row = tbody.insertRow();
            // Determine the correct page based on transaction type
            const redirectPage = transaction.type.toLowerCase() === 'sale' ? 'sales.html' : 'purchases.html';
            // Capitalize the first letter of the type for display
            const displayType = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
            
            row.innerHTML = `
                <td>
                    <a href="${redirectPage}?edit=${transaction.id}" style="color: var(--primary-color); text-decoration: underline; cursor: pointer;">
                        ${transaction.invoiceNo}
                    </a>
                </td>
                <td>${formatDate(transaction.date)}</td>
                <td>
                    <span class="type-badge ${transaction.type}">
                        ${displayType}
                    </span>
                </td>
                <td>${transaction.accountName || '-'}</td>
                <td>${transaction.productName || '-'}</td>
                <td>${transaction.quantity || '0'}</td>
                <td>${transaction.shipToAddress || '-'}</td>
                <td>₹${transaction.transporterFare || '0'}</td>
                <td>${transaction.remark || '-'}</td>
            `;
        });

        if (transactions.length === 0) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 20px;">
                    No transactions found for this transporter
                </td>
            `;
        }
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
}); 