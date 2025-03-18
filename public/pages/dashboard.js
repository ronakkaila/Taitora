document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard page loaded');

    const themeToggleBtn = document.getElementById('themeToggleBtn');

    // Theme toggle functionality
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    // Set initial theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Load all dashboard data
    loadDashboardData();

    async function loadDashboardData() {
        try {
            const [salesSummary, topCustomers, recentSales, productPerformance] = await Promise.all([
                fetch('/api/dashboard/sales-summary').then(res => res.json()),
                fetch('/api/dashboard/top-customers').then(res => res.json()),
                fetch('/api/dashboard/recent-sales').then(res => res.json()),
                fetch('/api/dashboard/product-performance').then(res => res.json())
            ]);

            // Update sales summary cards
            updateSalesSummaryCards(salesSummary[0]); // Most recent month

            // Create monthly sales chart
            createMonthlySalesChart(salesSummary);

            // Update top customers table
            updateTopCustomersTable(topCustomers);

            // Update recent sales table
            updateRecentSalesTable(recentSales);

            // Create product performance chart
            createProductPerformanceChart(productPerformance);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showError('Failed to load dashboard data. Please try again later.');
        }
    }

    function updateSalesSummaryCards(summary) {
        if (!summary) return;

        document.getElementById('totalSales').textContent = summary.totalSales;
        document.getElementById('totalSupply').textContent = summary.totalSupplyQty;
        document.getElementById('totalReceived').textContent = summary.totalReceivedQty;
        document.getElementById('totalTransport').textContent = `₹${summary.totalTransportFare}`;
        document.getElementById('cashSales').textContent = summary.cashSales;
        document.getElementById('creditSales').textContent = summary.creditSales;
    }

    function createMonthlySalesChart(data) {
        const ctx = document.getElementById('monthlySalesChart').getContext('2d');
        
        // Reverse data to show oldest to newest
        const chartData = data.reverse();
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map(item => item.month),
                datasets: [{
                    label: 'Total Sales',
                    data: chartData.map(item => item.totalSales),
                    borderColor: '#4a90e2',
                    tension: 0.1
                }, {
                    label: 'Supply Quantity',
                    data: chartData.map(item => item.totalSupplyQty),
                    borderColor: '#2ecc71',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Sales Performance'
                    }
                }
            }
        });
    }

    function updateTopCustomersTable(customers) {
        const tbody = document.getElementById('topCustomersBody');
        tbody.innerHTML = customers.map(customer => `
            <tr>
                <td>${customer.accountName}</td>
                <td>${customer.totalTransactions}</td>
                <td>${customer.totalSupplyQty}</td>
                <td>${customer.totalReceivedQty}</td>
                <td>₹${customer.totalTransportFare}</td>
            </tr>
        `).join('');
    }

    function updateRecentSalesTable(sales) {
        const tbody = document.getElementById('recentSalesBody');
        tbody.innerHTML = sales.map(sale => `
            <tr>
                <td>${sale.invoiceNo}</td>
                <td>${new Date(sale.date).toLocaleDateString()}</td>
                <td>${sale.accountName}</td>
                <td>${sale.productName}</td>
                <td>${sale.supplyQty}</td>
                <td>${sale.receivedQty}</td>
                <td>₹${sale.transporterFare}</td>
                <td><span class="payment-badge ${sale.paymentOption}">${sale.paymentOption}</span></td>
            </tr>
        `).join('');
    }

    function createProductPerformanceChart(data) {
        const ctx = document.getElementById('productPerformanceChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.productName),
                datasets: [{
                    label: 'Total Sales',
                    data: data.map(item => item.totalSales),
                    backgroundColor: '#4a90e2'
                }, {
                    label: 'Average Supply Qty',
                    data: data.map(item => item.avgSupplyQty),
                    backgroundColor: '#2ecc71'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Product Performance'
                    }
                }
            }
        });
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.content').prepend(errorDiv);
        
        // Remove error after 5 seconds
        setTimeout(() => errorDiv.remove(), 5000);
    }
});