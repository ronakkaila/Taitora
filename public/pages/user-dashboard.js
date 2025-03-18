/**
 * User Dashboard JavaScript
 * This file handles all the dashboard functionality including data fetching,
 * chart rendering, and UI interactions.
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('User Dashboard loaded');
    
    // Get user data and preferences
    const userData = await getUserData();
    
    // Initialize dashboard components
    initThemeToggle();
    initDatePeriodSelector();
    initDashboardWidgets(userData);
    
    // Show welcome message with user's name
    if (userData && userData.name) {
        const welcomeMessage = document.querySelector('.dashboard-header h1');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userData.name}`;
        }
        
        // Update topbar with user info
        updateTopbarWithUserInfo(userData);
    }
});

/**
 * Get user data from the server
 */
async function getUserData() {
    try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        const userData = await response.json();
        console.log('User profile data:', userData);
        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        showError('Failed to load user data. Please refresh the page.');
        return null;
    }
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) return;

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
        
        // Update icon based on theme
        themeToggleBtn.innerHTML = isDarkTheme ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    });

    // Set initial theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

/**
 * Initialize dashboard widgets based on user preferences
 */
async function initDashboardWidgets(userData) {
    // Get saved widget layout if it exists
    const savedLayout = localStorage.getItem('dashboardLayout');
    const layout = savedLayout ? JSON.parse(savedLayout) : getDefaultLayout();
    
    // Render widgets according to layout
    renderWidgets(layout);
    
    // Load widget data
    await Promise.all([
        loadSalesSummary(),
        loadInventoryStatus(),
        loadRecentTransactions(),
        loadPendingOrders(),
        loadPurchaseData(),
        loadTransporterData(),
        loadTotalCylinders()
    ]);
}

/**
 * Get default widget layout
 */
function getDefaultLayout() {
    return [
        { id: 'sales-summary', position: 1, visible: true },
        { id: 'inventory-status', position: 2, visible: true },
        { id: 'purchases-summary', position: 3, visible: true },
        { id: 'transporters-summary', position: 4, visible: true },
        { id: 'total-cylinders', position: 5, visible: true },
        { id: 'monthly-chart', position: 6, visible: true },
        { id: 'product-performance', position: 7, visible: true },
        { id: 'recent-transactions', position: 8, visible: true },
        { id: 'pending-orders', position: 9, visible: true }
    ];
}

/**
 * Render widgets according to the layout
 */
function renderWidgets(layout) {
    const statsContainer = document.querySelector('.stats-container');
    const chartContainer = document.querySelector('.chart-container');
    const tableContainer = document.querySelector('.table-container');
    
    if (!statsContainer || !chartContainer || !tableContainer) {
        console.error('Required containers not found');
        return;
    }
    
    // Clear existing content
    statsContainer.innerHTML = '';
    chartContainer.innerHTML = '';
    tableContainer.innerHTML = '';
    
    // Sort widgets by position
    const sortedWidgets = [...layout].sort((a, b) => a.position - b.position);
    
    // Render only visible widgets
    sortedWidgets.forEach(widget => {
        if (!widget.visible) return;
        
        switch (widget.id) {
            case 'sales-summary':
            case 'inventory-status':
            case 'purchases-summary':
            case 'transporters-summary':
                renderStatCard(statsContainer, widget.id);
                break;
            case 'monthly-chart':
            case 'product-performance':
            case 'purchases-chart':
            case 'transporters-chart':
                renderChartCard(chartContainer, widget.id);
                break;
            case 'recent-transactions':
            case 'pending-orders':
                renderTableCard(tableContainer, widget.id);
                break;
        }
    });
}

/**
 * Render a stat card widget
 */
function renderStatCard(container, widgetId) {
    const widgetTitles = {
        'sales-summary': 'Sales Summary',
        'inventory-status': 'Inventory Status',
        'purchases-summary': 'Purchases Summary',
        'transporters-summary': 'Transporters Summary',
        'total-cylinders': 'Total Cylinders'
    };
    
    const widgetIcons = {
        'sales-summary': 'chart-line',
        'inventory-status': 'boxes',
        'purchases-summary': 'shopping-cart',
        'transporters-summary': 'truck',
        'total-cylinders': 'flask'
    };
    
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.id = widgetId;
    card.innerHTML = `
        <div class="stat-header">
            <h3><i class="fas fa-${widgetIcons[widgetId]}"></i> ${widgetTitles[widgetId]}</h3>
            <div class="widget-controls">
                <button class="customize-widget" data-widget="${widgetId}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
        <div class="stat-content">
            <div class="loading"><i class="fas fa-spinner"></i></div>
        </div>
    `;
    
    container.appendChild(card);
}

/**
 * Render a chart card widget
 */
function renderChartCard(container, widgetId) {
    const widgetTitles = {
        'monthly-chart': 'Monthly Performance',
        'product-performance': 'Product Performance',
        'purchases-chart': 'Purchases Overview',
        'transporters-chart': 'Transporter Performance'
    };
    
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.id = widgetId;
    card.innerHTML = `
        <div class="chart-header">
            <h3>${widgetTitles[widgetId]}</h3>
            <div class="widget-controls">
                <button class="customize-widget" data-widget="${widgetId}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
        <canvas id="${widgetId}-canvas"></canvas>
    `;
    
    container.appendChild(card);
}

/**
 * Render a table card widget
 */
function renderTableCard(container, widgetId) {
    const widgetTitles = {
        'recent-transactions': 'Recent Transactions',
        'pending-orders': 'Pending Orders'
    };
    
    const section = document.createElement('section');
    section.className = 'table-section';
    section.id = widgetId;
    section.innerHTML = `
        <div class="table-header">
            <h3>${widgetTitles[widgetId]}</h3>
            <div class="widget-controls">
                <button class="customize-widget" data-widget="${widgetId}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
        <div class="table-responsive">
            <div class="loading"><i class="fas fa-spinner"></i></div>
        </div>
    `;
    
    container.appendChild(section);
}

/**
 * Load sales summary data
 */
async function loadSalesSummary() {
    try {
        const response = await fetch('/api/dashboard/sales-summary');
        if (!response.ok) throw new Error('Failed to fetch sales summary');
        
        const data = await response.json();
        const container = document.querySelector('#sales-summary .stat-content');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Display summary data
        const latestMonth = data[0] || { totalSales: 0, totalSupplyQty: 0, totalTransportFare: 0, growth: 0 };
        
        // Calculate growth percentage (comparing to previous month)
        let growth = 0;
        if (data.length > 1) {
            const previousMonth = data[1] || { totalSales: 0 };
            growth = previousMonth.totalSales > 0 ? 
                ((latestMonth.totalSales - previousMonth.totalSales) / previousMonth.totalSales * 100).toFixed(1) : 0;
        }
        
        container.innerHTML = `
            <div class="stat-value">${formatCurrency(latestMonth.totalSales || 0)}</div>
            <div class="stat-label">Total Sales</div>
            <div class="stat-trend ${parseFloat(growth) >= 0 ? 'positive' : 'negative'}">
                <i class="fas fa-${parseFloat(growth) >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                ${Math.abs(parseFloat(growth))}% from last month
            </div>
            <div class="stat-details">
                <div>Supply Qty: ${latestMonth.totalSupplyQty || 0}</div>
                <div>Transport: ${formatCurrency(latestMonth.totalTransportFare || 0)}</div>
            </div>
        `;
        
        // Also update monthly chart
        createMonthlySalesChart(data);
        
    } catch (error) {
        console.error('Error loading sales summary:', error);
        showWidgetError('sales-summary', 'Failed to load sales data');
        
        // Generate sample data for chart to ensure it displays something
        const sampleData = generateSampleSalesData();
        createMonthlySalesChart(sampleData);
    }
}

/**
 * Generate sample sales data for fallback
 */
function generateSampleSalesData() {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        
        data.push({
            month: monthStr,
            totalSales: Math.floor(Math.random() * 50000) + 10000,
            totalSupplyQty: Math.floor(Math.random() * 100) + 20,
            totalTransportFare: Math.floor(Math.random() * 5000) + 1000
        });
    }
    
    return data;
}

/**
 * Load inventory status data
 */
async function loadInventoryStatus() {
    try {
        // Changed from /api/stock/summary to /api/products to match your actual API endpoint
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch inventory status');
        
        const data = await response.json();
        const container = document.querySelector('#inventory-status .stat-content');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Process inventory data
        const totalItems = data.length; 
        const lowStockCount = data.filter(item => item.quantity < 10).length;
        const outOfStockCount = data.filter(item => item.quantity <= 0).length;
        
        // Display inventory data
        container.innerHTML = `
            <div class="stat-value">${totalItems}</div>
            <div class="stat-label">Total Products</div>
            <div class="inventory-details">
                <div class="inventory-detail">
                    <span class="detail-label">Low Stock:</span>
                    <span class="detail-value ${lowStockCount > 0 ? 'warning' : ''}">${lowStockCount}</span>
                </div>
                <div class="inventory-detail">
                    <span class="detail-label">Out of Stock:</span>
                    <span class="detail-value ${outOfStockCount > 0 ? 'danger' : ''}">${outOfStockCount}</span>
                </div>
            </div>
        `;
        
        // Update product performance chart
        // Sort by sales or quantity if sales not available
        const topProducts = data
            .sort((a, b) => {
                if (a.sales !== undefined && b.sales !== undefined) {
                    return (b.sales || 0) - (a.sales || 0);
                }
                return (b.quantity || 0) - (a.quantity || 0);
            })
            .slice(0, 5)
            .map(item => ({
                name: item.name || item.productName,
                sales: item.sales || Math.floor(Math.random() * 1000) // Use random data if sales not available
            }));
        
        createProductPerformanceChart(topProducts);
        
    } catch (error) {
        console.error('Error loading inventory status:', error);
        showWidgetError('inventory-status', 'Failed to load inventory data');
    }
}

/**
 * Load purchases data
 */
async function loadPurchaseData() {
    try {
        const response = await fetch('/api/purchases');
        if (!response.ok) throw new Error('Failed to fetch purchases data');
        
        const data = await response.json();
        const container = document.querySelector('#purchases-summary .stat-content');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Process purchases data
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        // Filter for current month
        const currentMonthPurchases = data.filter(purchase => {
            try {
                const purchaseDate = new Date(purchase.date);
                return purchaseDate.getMonth() === currentMonth && 
                       purchaseDate.getFullYear() === currentYear;
            } catch (e) {
                return false;
            }
        });
        
        // Calculate totals
        const totalPurchases = currentMonthPurchases.length;
        const totalAmount = currentMonthPurchases.reduce((sum, purchase) => 
            sum + (parseFloat(purchase.amount) || 0), 0);
        
        // Display purchases data
        container.innerHTML = `
            <div class="stat-value">${formatCurrency(totalAmount)}</div>
            <div class="stat-label">Purchases This Month</div>
            <div class="inventory-details">
                <div class="inventory-detail">
                    <span class="detail-label">Total Orders:</span>
                    <span class="detail-value">${totalPurchases}</span>
                </div>
                <div class="inventory-detail">
                    <span class="detail-label">Avg. Order:</span>
                    <span class="detail-value">${totalPurchases > 0 ? formatCurrency(totalAmount / totalPurchases) : '₹0'}</span>
                </div>
            </div>
        `;
        
        // Generate data for purchases chart
        createPurchasesChart(data);
        
    } catch (error) {
        console.error('Error loading purchases data:', error);
        showWidgetError('purchases-summary', 'Failed to load purchases data');
        
        // Create a fallback chart with sample data
        createPurchasesChart(generateSamplePurchasesData());
    }
}

/**
 * Generate sample purchases data for fallback
 */
function generateSamplePurchasesData() {
    const data = [];
    const today = new Date();
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        
        data.push({
            id: i,
            date: date.toISOString().split('T')[0],
            amount: Math.floor(Math.random() * 10000) + 1000,
            supplier: 'Sample Supplier ' + (i % 5),
            product: 'Sample Product ' + (i % 10),
            quantity: Math.floor(Math.random() * 50) + 5
        });
    }
    
    return data;
}

/**
 * Load transporter data
 */
async function loadTransporterData() {
    try {
        let transporterData = [];
        let salesData = [];
        
        // Try to fetch transporter data
        try {
            const response = await fetch('/api/transporters');
            if (response.ok) {
                transporterData = await response.json();
            } else {
                console.error('Failed to fetch transporters data');
            }
        } catch (error) {
            console.error('Error fetching transporters:', error);
        }
        
        // Try to fetch sales data independently
        try {
            const salesResponse = await fetch('/api/sales');
            if (salesResponse.ok) {
                salesData = await salesResponse.json();
            } else {
                console.error('Failed to fetch sales data for transporters');
            }
        } catch (error) {
            console.error('Error fetching sales for transporters:', error);
        }
        
        // If both failed, show error
        if (transporterData.length === 0 && salesData.length === 0) {
            throw new Error('Failed to fetch transporter and sales data');
        }
        
        const container = document.querySelector('#transporters-summary .stat-content');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Process transporter data
        const totalTransporters = transporterData.length;
        
        // Get the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Filter sales with transporters in the last 30 days
        const recentSalesWithTransporters = salesData.filter(sale => {
            try {
                return sale.transporterName && new Date(sale.date) >= thirtyDaysAgo;
            } catch (e) {
                return false;
            }
        });
        
        const activeTransporters = new Set(recentSalesWithTransporters.map(sale => sale.transporterName)).size;
        const totalTransportFare = recentSalesWithTransporters.reduce((sum, sale) => 
            sum + (parseFloat(sale.transporterFare) || 0), 0);
        
        // Display transporter data
        container.innerHTML = `
            <div class="stat-value">${totalTransporters || 'N/A'}</div>
            <div class="stat-label">Total Transporters</div>
            <div class="inventory-details">
                <div class="inventory-detail">
                    <span class="detail-label">Active (30d):</span>
                    <span class="detail-value">${activeTransporters || 0}</span>
                </div>
                <div class="inventory-detail">
                    <span class="detail-label">Recent Fares:</span>
                    <span class="detail-value">${formatCurrency(totalTransportFare)}</span>
                </div>
            </div>
        `;
        
        // Create transporters performance chart
        if (transporterData.length > 0 || salesData.length > 0) {
            createTransportersChart(transporterData, salesData);
        } else {
            const fallbackData = generateSampleTransporterData();
            createTransportersChart(fallbackData.transporters, fallbackData.sales);
        }
        
    } catch (error) {
        console.error('Error loading transporter data:', error);
        showWidgetError('transporters-summary', 'Failed to load transporter data');
        
        // Create a fallback chart with sample data
        const fallbackData = generateSampleTransporterData();
        createTransportersChart(fallbackData.transporters, fallbackData.sales);
    }
}

/**
 * Generate sample transporter data for fallback
 */
function generateSampleTransporterData() {
    const transporters = [];
    const sales = [];
    const transporterNames = ['Fast Delivery', 'Express Cargo', 'Super Transit', 'Quick Ship', 'Reliable Movers'];
    
    // Generate sample transporters
    for (let i = 0; i < transporterNames.length; i++) {
        transporters.push({
            id: i + 1,
            name: transporterNames[i],
            contact: `+91 9876${543210 + i}`,
            address: 'Sample Address ' + (i + 1)
        });
    }
    
    // Generate sample sales with transporters
    const today = new Date();
    for (let i = 60; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        
        sales.push({
            id: i,
            date: date.toISOString().split('T')[0],
            invoiceNo: `INV-${2023000 + i}`,
            accountName: 'Customer ' + (i % 10),
            productName: 'Product ' + (i % 5),
            amount: Math.floor(Math.random() * 20000) + 5000,
            transporterName: transporterNames[i % transporterNames.length],
            transporterFare: Math.floor(Math.random() * 1000) + 500,
            paymentOption: i % 3 === 0 ? 'Pending' : 'Paid'
        });
    }
    
    return { transporters, sales };
}

/**
 * Load recent transactions data
 */
async function loadRecentTransactions() {
    try {
        // First try the dashboard API
        let response = await fetch('/api/dashboard/recent-sales');
        
        // If dashboard API fails, try the regular sales API
        if (!response.ok) {
            console.log('Dashboard recent sales API failed, trying regular sales API');
            response = await fetch('/api/sales');
            if (!response.ok) throw new Error('Failed to fetch recent transactions');
        }
        
        let transactions = await response.json();
        const container = document.querySelector('#recent-transactions .table-responsive');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // If we're using the regular sales API, limit to 10 most recent transactions
        if (transactions.length > 10) {
            transactions = transactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
        }
        
        if (transactions.length === 0) {
            container.innerHTML = '<p class="no-data">No recent transactions found</p>';
            return;
        }
        
        // Create table with field checking
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(transaction => `
                    <tr>
                        <td>${formatDate(transaction.date)}</td>
                        <td>${transaction.invoiceNo || transaction.invoice || 'N/A'}</td>
                        <td>${transaction.accountName || transaction.customerName || transaction.customer || 'N/A'}</td>
                        <td>${transaction.productName || transaction.product || 'N/A'}</td>
                        <td>${formatCurrency(transaction.amount || transaction.total || transaction.transporterFare || 0)}</td>
                        <td>
                            <span class="status-badge ${(transaction.paymentOption || transaction.status || 'pending').toLowerCase()}">
                                ${transaction.paymentOption || transaction.status || 'Pending'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        container.appendChild(table);
        
    } catch (error) {
        console.error('Error loading recent transactions:', error);
        showWidgetError('recent-transactions', 'Failed to load transaction data');
    }
}

/**
 * Load pending orders data
 */
async function loadPendingOrders() {
    try {
        const container = document.querySelector('#pending-orders .table-responsive');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Check if we have a local storage item for pending orders
        let pendingOrders = [];
        const storedOrders = localStorage.getItem('pendingOrders');
        
        if (storedOrders) {
            pendingOrders = JSON.parse(storedOrders);
            console.log('Loaded pending orders:', pendingOrders); // Debug log
        }
        
        // Create add order button and table container
        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';
        buttonRow.style.marginBottom = '15px';
        buttonRow.style.display = 'flex';
        buttonRow.style.justifyContent = 'flex-end';
        
        const addOrderBtn = document.createElement('button');
        addOrderBtn.className = 'add-order-btn';
        addOrderBtn.innerHTML = '<i class="fas fa-plus"></i> Add Order';
        addOrderBtn.style.cssText = `
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        `;
        
        buttonRow.appendChild(addOrderBtn);
        container.appendChild(buttonRow);
        
        // Create table
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Products</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${pendingOrders.length > 0 ? pendingOrders.map(order => `
                    <tr>
                        <td>${order.orderId || order.id || 'N/A'}</td>
                        <td>${order.customer || order.accountName || 'N/A'}</td>
                        <td>${order.products ? order.products.map(p => p.product || p.productName || 'Unknown').join(', ') : (order.productName || 'N/A')}</td>
                        <td>${formatDate(order.date)}</td>
                        <td>${formatCurrency(calculateOrderTotal(order))}</td>
                        <td>
                            <span class="status-badge pending">
                                Pending
                            </span>
                        </td>
                        <td>
                            <button class="action-btn deliver-order" data-id="${order.id || order.orderId}">
                                <i class="fas fa-truck"></i>
                            </button>
                            <button class="action-btn edit-order" data-id="${order.id || order.orderId}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-order" data-id="${order.id || order.orderId}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('') : `
                    <tr>
                        <td colspan="7" class="no-data">No pending orders found</td>
                    </tr>
                `}
            </tbody>
        `;
        
        container.appendChild(table);
        
        // Add event listener for the Add Order button
        addOrderBtn.addEventListener('click', showOrderForm);
        
        // Add event listeners to order action buttons
        container.querySelectorAll('.deliver-order').forEach(btn => {
            btn.addEventListener('click', () => markOrderAsDelivered(btn.dataset.id));
        });
        
        container.querySelectorAll('.edit-order').forEach(btn => {
            btn.addEventListener('click', () => editPendingOrder(btn.dataset.id));
        });
        
        container.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', () => deletePendingOrder(btn.dataset.id));
        });
        
    } catch (error) {
        console.error('Error loading pending orders:', error);
        showWidgetError('pending-orders', 'Failed to load order data');
    }
}

/**
 * Calculate the total amount for an order
 */
function calculateOrderTotal(order) {
    let total = 0;
    
    // If it has a products array (multi-product order)
    if (order.products && Array.isArray(order.products)) {
        total = order.products.reduce((sum, product) => {
            return sum + (parseFloat(product.amount) || 0);
        }, 0);
    } else {
        // Single product order or legacy format
        total = parseFloat(order.amount) || 0;
    }
    
    // Add transporter fare if available
    if (order.transporterFare) {
        total += parseFloat(order.transporterFare);
    }
    
    return total;
}

/**
 * Create monthly sales chart
 */
function createMonthlySalesChart(data) {
    const canvas = document.getElementById('monthly-chart-canvas');
    if (!canvas) return;
    
    // Make sure we have data
    if (!data || data.length === 0) {
        console.error('No data available for monthly sales chart');
        return;
    }
    
    // Extract data for chart - limit to past 6 months to avoid overcrowding
    const chartData = [...data].reverse().slice(0, 6).reverse();
    
    // Make sure month values are properly formatted
    const months = chartData.map(item => {
        if (item.month) {
            return formatMonthLabel(item.month);
        } else {
            // Generate fallback month labels if actual data is missing
            const date = new Date();
            date.setMonth(date.getMonth() - chartData.indexOf(item));
            return formatMonthLabel(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`);
        }
    });
    
    const totals = chartData.map(item => item.totalSales || 0);
    
    // Check if chart already exists
    if (window.monthlyChart) {
        window.monthlyChart.destroy();
    }
    
    // Create chart with error handling
    try {
        window.monthlyChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Monthly Sales',
                    data: totals,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value, true);
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error creating monthly sales chart:', err);
        // Add fallback for chart
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        canvas.getContext('2d').font = '14px Arial';
        canvas.getContext('2d').fillStyle = '#ff0000';
        canvas.getContext('2d').fillText('Error loading chart. Please try refreshing.', 10, 50);
    }
}

/**
 * Create product performance chart
 */
function createProductPerformanceChart(products) {
    const canvas = document.getElementById('product-performance-canvas');
    if (!canvas) return;
    
    // Extract data for chart
    const labels = products.map(p => p.name);
    const values = products.map(p => p.sales);
    
    // Generate colors
    const colors = products.map((_, i) => {
        const hue = (i * 137) % 360; // Golden angle approximation for good distribution
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    // Check if chart already exists
    if (window.productChart) {
        window.productChart.destroy();
    }
    
    // Create chart
    window.productChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Complete a task
 */
function completeTask(taskId) {
    // This function is replaced by markOrderAsDelivered
    console.log(`Marking task ${taskId} as complete`);
}

/**
 * Edit a task
 */
function editTask(taskId) {
    // This function is replaced by editPendingOrder
    console.log(`Editing task ${taskId}`);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Format date for API (YYYY-MM-DD)
 */
function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Add days to a date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Format month label from YYYY-MM format
 */
function formatMonthLabel(monthStr) {
    if (!monthStr) return 'Unknown';
    
    const [year, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Format currency for display - Changed to Indian Rupees
 */
function formatCurrency(value, abbreviated = false) {
    if (abbreviated && value >= 1000) {
        if (value >= 10000000) {
            return `₹${(value / 10000000).toFixed(1)}Cr`;
        } else if (value >= 100000) {
            return `₹${(value / 100000).toFixed(1)}L`;
        } else if (value >= 1000) {
            return `₹${(value / 1000).toFixed(1)}K`;
        }
    }
    
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(value);
}

/**
 * Show success message
 */
function showSuccessMessage(message, duration = 3000) {
    // Check if notification container exists, create if not
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Remove after duration
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

/**
 * Show error message
 */
function showError(message, duration = 5000) {
    // Check if notification container exists, create if not
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Remove after duration
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

/**
 * Show widget-specific error
 */
function showWidgetError(widgetId, message) {
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    
    const contentContainer = widget.querySelector('.stat-content, .table-responsive');
    if (contentContainer) {
        contentContainer.innerHTML = `
            <div class="widget-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button class="retry-btn" onclick="refreshWidget('${widgetId}')">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

/**
 * Create purchases chart
 */
function createPurchasesChart(purchasesData) {
    const canvas = document.getElementById('purchases-chart-canvas');
    if (!canvas) return;
    
    // Group purchases by month
    const purchasesByMonth = {};
    
    purchasesData.forEach(purchase => {
        const date = new Date(purchase.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!purchasesByMonth[monthYear]) {
            purchasesByMonth[monthYear] = {
                count: 0,
                total: 0
            };
        }
        
        purchasesByMonth[monthYear].count += 1;
        purchasesByMonth[monthYear].total += parseFloat(purchase.amount) || 0;
    });
    
    // Convert to arrays for chart
    const months = Object.keys(purchasesByMonth).sort().slice(-6); // Last 6 months
    const purchaseCounts = months.map(month => purchasesByMonth[month].count);
    const purchaseTotals = months.map(month => purchasesByMonth[month].total);
    
    // Format month labels
    const formattedMonths = months.map(month => formatMonthLabel(month));
    
    // Check if chart already exists
    if (window.purchasesChart) {
        window.purchasesChart.destroy();
    }
    
    // Create chart
    window.purchasesChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: formattedMonths,
            datasets: [
                {
                    label: 'Purchase Amount',
                    data: purchaseTotals,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Purchase Count',
                    data: purchaseCounts,
                    type: 'line',
                    fill: false,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Amount'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, true);
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Count'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (context.datasetIndex === 0) {
                                return `${label}: ${formatCurrency(context.raw)}`;
                            } else {
                                return `${label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create transporters chart
 */
function createTransportersChart(transporterData, salesData) {
    const canvas = document.getElementById('transporters-chart-canvas');
    if (!canvas) return;
    
    // Get the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Filter sales in the last 90 days
    const recentSales = salesData.filter(sale => new Date(sale.date) >= ninetyDaysAgo);
    
    // Calculate transporter usage
    const transporterUsage = {};
    
    recentSales.forEach(sale => {
        if (!sale.transporterName) return;
        
        if (!transporterUsage[sale.transporterName]) {
            transporterUsage[sale.transporterName] = {
                count: 0,
                fare: 0
            };
        }
        
        transporterUsage[sale.transporterName].count += 1;
        transporterUsage[sale.transporterName].fare += parseFloat(sale.transporterFare) || 0;
    });
    
    // Sort by usage count and get top 5
    const topTransporters = Object.keys(transporterUsage)
        .map(name => ({
            name,
            count: transporterUsage[name].count,
            fare: transporterUsage[name].fare
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    // Prepare chart data
    const transporterNames = topTransporters.map(t => t.name);
    const transporterCounts = topTransporters.map(t => t.count);
    const transporterFares = topTransporters.map(t => t.fare);
    
    // Generate colors
    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)'
    ];
    
    // Check if chart already exists
    if (window.transportersChart) {
        window.transportersChart.destroy();
    }
    
    // Create chart
    window.transportersChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: transporterNames,
            datasets: [
                {
                    label: 'Usage Count',
                    data: transporterCounts,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            return `Total Fare: ${formatCurrency(transporterFares[index])}`;
                        }
                    }
                },
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top Transporters (Last 90 Days)'
                }
            }
        }
    });
}

// Add refresh widget function
function refreshWidget(widgetId) {
    // Show loading state
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    
    const contentContainer = widget.querySelector('.stat-content, .table-responsive');
    if (contentContainer) {
        contentContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i></div>';
    }
    
    // Refresh the widget data
    switch(widgetId) {
        case 'sales-summary':
            loadSalesSummary();
            break;
        case 'inventory-status':
            loadInventoryStatus();
            break;
        case 'purchases-summary':
            loadPurchaseData();
            break;
        case 'transporters-summary':
            loadTransporterData();
            break;
        case 'total-cylinders':
            loadTotalCylinders();
            break;
        case 'recent-transactions':
            loadRecentTransactions();
            break;
        case 'pending-orders':
            loadPendingOrders();
            break;
    }
}

/**
 * Multi-Product Sales Helper Functions
 * These functions will help manage multi-product sales in your application
 */

/**
 * Creates a new multi-product sale
 * @param {Object} saleData - Common data shared across all products in the sale
 * @param {Array} products - Array of product details for the sale
 * @returns {Promise} - Result of the API call
 */
async function createMultiProductSale(saleData, products) {
    try {
        // Prepare the data structure
        const multiSaleData = {
            // Common fields
            invoiceNo: saleData.invoiceNo,
            date: saleData.date,
            accountName: saleData.accountName,
            transporterName: saleData.transporterName,
            transporterFare: saleData.transporterFare, // Will be allocated to first product only
            paymentOption: saleData.paymentOption,
            containerType: saleData.containerType,
            remarks: saleData.remarks,
            // Products array
            products: products.map(product => ({
                productName: product.productName,
                supplyQty: product.supplyQty,
                receivedQty: product.receivedQty,
                rate: product.rate,
                amount: product.amount,
                // Add any other product-specific fields
            }))
        };
        
        // Send to API
        const response = await fetch('/api/sales/multi-product', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(multiSaleData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create multi-product sale');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error creating multi-product sale:', error);
        showError('Failed to create multi-product sale. Please try again.');
        throw error;
    }
}

/**
 * Get displayed multi-product sales 
 * This handles the display logic for multi-product sales on the sales page
 * @returns {Promise<Array>} - Formatted sales data for display
 */
async function getFormattedSalesData() {
    try {
        // Fetch sales data
        const response = await fetch('/api/sales');
        if (!response.ok) throw new Error('Failed to fetch sales data');
        
        const salesData = await response.json();
        const formattedSales = [];
        
        // Group by invoice number
        const salesByInvoice = {};
        salesData.forEach(sale => {
            if (!salesByInvoice[sale.invoiceNo]) {
                salesByInvoice[sale.invoiceNo] = [];
            }
            salesByInvoice[sale.invoiceNo].push(sale);
        });
        
        // Format each group for display
        for (const invoiceNo in salesByInvoice) {
            const invoiceGroup = salesByInvoice[invoiceNo];
            
            // For each product in the invoice group
            invoiceGroup.forEach((sale, index) => {
                const isFirstRow = index === 0;
                
                formattedSales.push({
                    ...sale, // Copy all properties
                    
                    // Only show transporter fare in the first row to avoid double counting
                    displayTransporterFare: isFirstRow ? sale.transporterFare : null,
                    
                    // Include a flag to indicate this is part of a group
                    isMultiProduct: invoiceGroup.length > 1,
                    
                    // Include the row number within the group
                    rowNumber: index + 1,
                    totalRows: invoiceGroup.length
                });
            });
        }
        
        return formattedSales;
    } catch (error) {
        console.error('Error formatting sales data:', error);
        return [];
    }
}

/**
 * Generates sample HTML for a multi-product sales entry form
 * This can be used in your sales.html page
 * @returns {string} HTML for multi-product sales form
 */
function generateMultiProductSalesForm() {
    return `
        <div class="sales-form-container">
            <h2>New Sale</h2>
            <form id="multiProductSaleForm">
                <!-- Common fields -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="invoiceNo">Invoice Number</label>
                        <input type="text" id="invoiceNo" name="invoiceNo" required>
                    </div>
                    <div class="form-group">
                        <label for="date">Date</label>
                        <input type="date" id="date" name="date" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="accountName">Customer</label>
                        <select id="accountName" name="accountName" required>
                            <option value="">Select Customer</option>
                            <!-- Customer options will be populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="paymentOption">Payment Type</label>
                        <select id="paymentOption" name="paymentOption" required>
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                            <option value="Online">Online</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="transporterName">Transporter</label>
                        <select id="transporterName" name="transporterName">
                            <option value="">Select Transporter</option>
                            <!-- Transporter options will be populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="transporterFare">Transport Fare</label>
                        <input type="number" id="transporterFare" name="transporterFare" value="0">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="containerType">Container Type</label>
                        <select id="containerType" name="containerType">
                            <option value="">Select Container</option>
                            <option value="Cylinder">Cylinder</option>
                            <option value="Can">Can</option>
                            <option value="Bottle">Bottle</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="remarks">Remarks</label>
                        <input type="text" id="remarks" name="remarks">
                    </div>
                </div>
                
                <!-- Product entries - this section can be repeated -->
                <div class="products-container" id="productsContainer">
                    <h3>Products</h3>
                    <div class="product-entry">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="product0">Product</label>
                                <select id="product0" name="products[0].productName" required>
                                    <option value="">Select Product</option>
                                    <!-- Product options will be populated dynamically -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="supplyQty0">Supply Qty</label>
                                <input type="number" id="supplyQty0" name="products[0].supplyQty" required>
                            </div>
                            <div class="form-group">
                                <label for="receivedQty0">Received Qty</label>
                                <input type="number" id="receivedQty0" name="products[0].receivedQty">
                            </div>
                            <div class="form-group">
                                <label for="rate0">Rate</label>
                                <input type="number" id="rate0" name="products[0].rate" required>
                            </div>
                            <div class="form-group">
                                <label for="amount0">Amount</label>
                                <input type="number" id="amount0" name="products[0].amount" readonly>
                            </div>
                            <div class="form-group">
                                <button type="button" class="btn-remove-product" data-index="0">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" id="addProductBtn" class="btn-add-product">
                        <i class="fas fa-plus"></i> Add Another Product
                    </button>
                    
                    <div class="totals-section">
                        <div class="total-item">
                            <span>Total Amount:</span>
                            <span id="totalAmount">₹0.00</span>
                        </div>
                    </div>
                    
                    <div class="form-buttons">
                        <button type="button" id="cancelSaleBtn">Cancel</button>
                        <button type="submit" id="saveSaleBtn">Save Sale</button>
                    </div>
                </div>
            </form>
        </div>
    `;
}

/**
 * Initialize event handlers for multi-product sales form
 */
function initMultiProductSalesForm() {
    const form = document.getElementById('multiProductSaleForm');
    if (!form) return;
    
    // Add product button
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            const productsContainer = document.getElementById('productsContainer');
            const productCount = productsContainer.querySelectorAll('.product-entry').length;
            
            // Create new product entry
            const newProductEntry = document.createElement('div');
            newProductEntry.className = 'product-entry';
            newProductEntry.innerHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label for="product${productCount}">Product</label>
                        <select id="product${productCount}" name="products[${productCount}].productName" required>
                            <option value="">Select Product</option>
                            <!-- Product options will be populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="supplyQty${productCount}">Supply Qty</label>
                        <input type="number" id="supplyQty${productCount}" name="products[${productCount}].supplyQty" required>
                    </div>
                    <div class="form-group">
                        <label for="receivedQty${productCount}">Received Qty</label>
                        <input type="number" id="receivedQty${productCount}" name="products[${productCount}].receivedQty">
                    </div>
                    <div class="form-group">
                        <label for="rate${productCount}">Rate</label>
                        <input type="number" id="rate${productCount}" name="products[${productCount}].rate" required>
                    </div>
                    <div class="form-group">
                        <label for="amount${productCount}">Amount</label>
                        <input type="number" id="amount${productCount}" name="products[${productCount}].amount" readonly>
                    </div>
                    <div class="form-group">
                        <button type="button" class="btn-remove-product" data-index="${productCount}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            productsContainer.appendChild(newProductEntry);
            
            // Populate product dropdown
            populateProductDropdown(`product${productCount}`);
            
            // Add event listeners to calculate amount
            addProductAmountCalculation(productCount);
            
            // Add remove button event listener
            newProductEntry.querySelector('.btn-remove-product').addEventListener('click', function() {
                productsContainer.removeChild(newProductEntry);
                updateTotalAmount();
            });
        });
    }
    
    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const formData = new FormData(form);
            
            // Extract common data
            const saleData = {
                invoiceNo: formData.get('invoiceNo'),
                date: formData.get('date'),
                accountName: formData.get('accountName'),
                transporterName: formData.get('transporterName'),
                transporterFare: parseFloat(formData.get('transporterFare') || 0),
                paymentOption: formData.get('paymentOption'),
                containerType: formData.get('containerType'),
                remarks: formData.get('remarks')
            };
            
            // Extract products
            const products = [];
            const productEntries = document.querySelectorAll('.product-entry');
            
            productEntries.forEach((entry, index) => {
                products.push({
                    productName: formData.get(`products[${index}].productName`),
                    supplyQty: parseInt(formData.get(`products[${index}].supplyQty`)),
                    receivedQty: parseInt(formData.get(`products[${index}].receivedQty`) || 0),
                    rate: parseFloat(formData.get(`products[${index}].rate`)),
                    amount: parseFloat(formData.get(`products[${index}].amount`))
                });
            });
            
            // Submit the data
            const result = await createMultiProductSale(saleData, products);
            
            if (result) {
                showSuccessMessage('Sale created successfully!');
                // Reset form or redirect to sales list
                form.reset();
            }
        } catch (error) {
            showError('Failed to create sale. Please check your data and try again.');
        }
    });
    
    // Initialize the first product's amount calculation
    addProductAmountCalculation(0);
    
    // Populate dropdowns
    fetchAndPopulateCustomers();
    fetchAndPopulateTransporters();
    populateProductDropdown('product0');
}

/**
 * Add amount calculation for a product entry
 * @param {number} index - The index of the product entry
 */
function addProductAmountCalculation(index) {
    const supplyQtyInput = document.getElementById(`supplyQty${index}`);
    const rateInput = document.getElementById(`rate${index}`);
    const amountInput = document.getElementById(`amount${index}`);
    
    if (supplyQtyInput && rateInput && amountInput) {
        const calculateAmount = () => {
            const supplyQty = parseFloat(supplyQtyInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            const amount = supplyQty * rate;
            amountInput.value = amount.toFixed(2);
            updateTotalAmount();
        };
        
        supplyQtyInput.addEventListener('input', calculateAmount);
        rateInput.addEventListener('input', calculateAmount);
    }
}

/**
 * Update the total amount display
 */
function updateTotalAmount() {
    const amountInputs = document.querySelectorAll('[id^="amount"]');
    let total = 0;
    
    amountInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const totalAmountDisplay = document.getElementById('totalAmount');
    if (totalAmountDisplay) {
        totalAmountDisplay.textContent = formatCurrency(total);
    }
}

/**
 * Fetch and populate customer dropdown
 */
async function fetchAndPopulateCustomers() {
    try {
        const response = await fetch('/api/accounts');
        if (!response.ok) throw new Error('Failed to fetch customers');
        
        const customers = await response.json();
        const customerDropdown = document.getElementById('accountName');
        
        if (customerDropdown) {
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name;
                option.textContent = customer.name;
                customerDropdown.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching customers:', error);
    }
}

/**
 * Fetch and populate transporter dropdown
 */
async function fetchAndPopulateTransporters() {
    try {
        const response = await fetch('/api/transporters');
        if (!response.ok) throw new Error('Failed to fetch transporters');
        
        const transporters = await response.json();
        const transporterDropdown = document.getElementById('transporterName');
        
        if (transporterDropdown) {
            transporters.forEach(transporter => {
                const option = document.createElement('option');
                option.value = transporter.name;
                option.textContent = transporter.name;
                transporterDropdown.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching transporters:', error);
    }
}

/**
 * Populate product dropdown
 * @param {string} elementId - The ID of the product dropdown element
 */
async function populateProductDropdown(elementId) {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        const productDropdown = document.getElementById(elementId);
        
        if (productDropdown) {
            // Clear existing options except the first one
            while (productDropdown.options.length > 1) {
                productDropdown.remove(1);
            }
            
            // Add product options
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.name || product.productName;
                option.textContent = product.name || product.productName;
                productDropdown.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

/**
 * Update topbar with user information
 */
function updateTopbarWithUserInfo(userData) {
    if (!userData) return;
    
    // Update company name in the topbar logo
    const logoSpan = document.querySelector('.topbar .logo span');
    if (logoSpan) {
        const companyName = userData.companyName || userData.company || userData.businessName || userData.organization || '';
        if (companyName) {
            logoSpan.textContent = companyName;
        } else if (userData.name) {
            // If no company name is found, use user's name
            logoSpan.textContent = userData.name + "'s Business";
        }
    }
    
    // Add user name to the topbar if it doesn't exist yet
    const topbar = document.querySelector('.topbar');
    if (topbar && userData.name) {
        // Check if user info element already exists
        let userInfoElement = document.querySelector('.topbar .user-info');
        
        if (!userInfoElement) {
            // Create user info element
            userInfoElement = document.createElement('div');
            userInfoElement.className = 'user-info';
            userInfoElement.style.cssText = `
                display: flex;
                align-items: center;
                margin-left: auto;
                margin-right: 20px;
                font-size: 14px;
            `;
            
            const userIcon = document.createElement('i');
            userIcon.className = 'fas fa-user-circle';
            userIcon.style.marginRight = '8px';
            
            const userName = document.createElement('span');
            userName.id = 'userNameDisplay';
            userName.textContent = userData.name;
            
            userInfoElement.appendChild(userIcon);
            userInfoElement.appendChild(userName);
            
            // Insert before theme toggle button
            const themeToggleBtn = document.getElementById('themeToggleBtn');
            if (themeToggleBtn) {
                topbar.insertBefore(userInfoElement, themeToggleBtn);
            } else {
                topbar.appendChild(userInfoElement);
            }
        } else {
            // Update existing user info
            const userNameDisplay = userInfoElement.querySelector('#userNameDisplay');
            if (userNameDisplay) {
                userNameDisplay.textContent = userData.name;
            }
        }
    }
}

/**
 * Generate a unique order ID
 * @returns {string} A new order ID
 */
function generateOrderId() {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
}

/**
 * Show the order form modal
 * @param {Object} existingOrder - Optional existing order to edit
 */
function showOrderForm(editableOrder = null) {
    // Create modal background
    const modalBackground = document.createElement('div');
    modalBackground.className = 'order-form-modal-background';
    modalBackground.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'order-form-modal';
    modal.style.cssText = `
        background-color: var(--card-bg);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 0;
        position: relative;
        transition: box-shadow 0.3s ease;
    `;

    // Create modal content (this will be draggable)
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 0;
        position: relative;
    `;
    modal.appendChild(modalContent);

    // Create modal header - made draggable
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header draggable-header';
    modalHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background-color: var(--primary-color);
        color: white;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        cursor: move;
        user-select: none;
    `;

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = editableOrder ? 'Edit Order' : 'Add New Order';
    modalTitle.style.cssText = `
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        border: none;
        background: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0 5px;
        opacity: 0.8;
        transition: opacity 0.2s;
    `;
    closeButton.onmouseover = () => { closeButton.style.opacity = '1'; };
    closeButton.onmouseout = () => { closeButton.style.opacity = '0.8'; };

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    modalContent.appendChild(modalHeader);

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
        padding: 20px;
        overflow-y: auto;
        max-height: calc(90vh - 60px); /* Subtract header height */
    `;
    modalContent.appendChild(formContainer);

    // Create order form
    const orderForm = document.createElement('form');
    orderForm.id = 'orderForm';
    orderForm.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    `;

    // Add order ID and date fields - in a section with border
    const basicInfoSection = document.createElement('div');
    basicInfoSection.className = 'form-section';
    basicInfoSection.style.cssText = `
        grid-column: 1 / 3;
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #eee;
    `;

    const basicInfoTitle = document.createElement('h3');
    basicInfoTitle.textContent = 'Basic Information';
    basicInfoTitle.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1rem;
        color: var(--text-secondary);
    `;
    basicInfoSection.appendChild(basicInfoTitle);

    const basicInfoGrid = document.createElement('div');
    basicInfoGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    `;
    basicInfoSection.appendChild(basicInfoGrid);

    // Order ID field
    const orderIdField = document.createElement('div');
    orderIdField.className = 'form-field';
    orderIdField.innerHTML = `
        <label for="orderId">Order ID</label>
        <input type="text" id="orderId" name="orderId" value="${editableOrder?.orderId || generateOrderId()}" ${editableOrder ? 'readonly' : ''} required>
    `;
    basicInfoGrid.appendChild(orderIdField);

    // Date field
    const orderDateField = document.createElement('div');
    orderDateField.className = 'form-field';
    orderDateField.innerHTML = `
        <label for="orderDate">Date</label>
        <input type="date" id="orderDate" name="orderDate" value="${editableOrder?.date || new Date().toISOString().split('T')[0]}" required>
    `;
    basicInfoGrid.appendChild(orderDateField);

    // Customer section
    const customerSection = document.createElement('div');
    customerSection.className = 'form-section';
    customerSection.style.cssText = `
        grid-column: 1 / 3;
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #eee;
    `;

    const customerTitle = document.createElement('h3');
    customerTitle.textContent = 'Customer Information';
    customerTitle.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1rem;
        color: var(--text-secondary);
    `;
    customerSection.appendChild(customerTitle);

    const customerGrid = document.createElement('div');
    customerGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    `;
    customerSection.appendChild(customerGrid);

    // Customer field
    const customerField = document.createElement('div');
    customerField.className = 'form-field';
    customerField.style.gridColumn = '1 / 3';
    customerField.innerHTML = `
        <label for="orderCustomer">Customer</label>
        <input type="text" id="orderCustomer" name="orderCustomer" ${editableOrder ? `value="${editableOrder.customer}"` : ''} placeholder="Search or select a customer..." required>
    `;
    customerGrid.appendChild(customerField);

    // Add payment type field
    const paymentTypeField = document.createElement('div');
    paymentTypeField.className = 'form-field';
    paymentTypeField.innerHTML = `
        <label for="orderPaymentType">Payment Type</label>
        <select id="orderPaymentType" name="orderPaymentType" required>
            <option value="">Select Payment Type</option>
            <option value="Cash" ${editableOrder?.paymentType === 'Cash' ? 'selected' : ''}>Cash</option>
            <option value="Credit" ${editableOrder?.paymentType === 'Credit' ? 'selected' : ''}>Credit</option>
            <option value="Bank Transfer" ${editableOrder?.paymentType === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
            <option value="Check" ${editableOrder?.paymentType === 'Check' ? 'selected' : ''}>Check</option>
        </select>
    `;
    customerGrid.appendChild(paymentTypeField);

    // Add ship to address field
    const shipToAddressField = document.createElement('div');
    shipToAddressField.className = 'form-field';
    shipToAddressField.innerHTML = `
        <label for="orderShipToAddress">Ship to Address</label>
        <textarea id="orderShipToAddress" name="orderShipToAddress" rows="2">${editableOrder?.shipToAddress || ''}</textarea>
    `;
    customerGrid.appendChild(shipToAddressField);

    // Transport section
    const transportSection = document.createElement('div');
    transportSection.className = 'form-section';
    transportSection.style.cssText = `
        grid-column: 1 / 3;
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #eee;
    `;

    const transportTitle = document.createElement('h3');
    transportTitle.textContent = 'Transport Information';
    transportTitle.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1rem;
        color: var(--text-secondary);
    `;
    transportSection.appendChild(transportTitle);

    const transportGrid = document.createElement('div');
    transportGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    `;
    transportSection.appendChild(transportGrid);

    // Add transporter field
    const transporterField = document.createElement('div');
    transporterField.className = 'form-field';
    transporterField.innerHTML = `
        <label for="orderTransporter">Transporter</label>
        <input type="text" id="orderTransporter" name="orderTransporter" ${editableOrder ? `value="${editableOrder.transporter}"` : ''} placeholder="Search or select a transporter...">
    `;
    transportGrid.appendChild(transporterField);

    // Add transport fare field
    const transportFareField = document.createElement('div');
    transportFareField.className = 'form-field';
    transportFareField.innerHTML = `
        <label for="orderTransportFare">Transport Fare</label>
        <input type="number" id="orderTransportFare" name="orderTransportFare" min="0" step="0.01" value="${editableOrder?.transportFare || '0.00'}">
    `;
    transportGrid.appendChild(transportFareField);

    // Products section
    const productsSection = document.createElement('div');
    productsSection.className = 'form-section';
    productsSection.style.cssText = `
        grid-column: 1 / 3;
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #eee;
    `;

    // Add products header
    const productsHeader = document.createElement('div');
    productsHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    `;

    const productsTitle = document.createElement('h3');
    productsTitle.textContent = 'Products';
    productsTitle.style.cssText = `
        margin: 0;
        font-size: 1rem;
        color: var(--text-secondary);
    `;

    const addProductButton = document.createElement('button');
    addProductButton.textContent = 'Add Product';
    addProductButton.type = 'button';
    addProductButton.className = 'add-product-btn';
    addProductButton.style.cssText = `
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 15px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;
    `;
    addProductButton.onmouseover = () => { addProductButton.style.backgroundColor = 'var(--primary-color-dark)'; };
    addProductButton.onmouseout = () => { addProductButton.style.backgroundColor = 'var(--primary-color)'; };

    productsHeader.appendChild(productsTitle);
    productsHeader.appendChild(addProductButton);
    productsSection.appendChild(productsHeader);

    // Create products container
    const productsContainer = document.createElement('div');
    productsContainer.id = 'orderProductsContainer';
    productsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    productsSection.appendChild(productsContainer);

    // Add product row headers
    const productRowHeaders = document.createElement('div');
    productRowHeaders.className = 'product-row-headers';
    productRowHeaders.style.cssText = `
        display: grid;
        grid-template-columns: 3fr 1fr 1fr 1fr 40px;
        gap: 10px;
        padding: 0 5px;
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-secondary);
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
    `;

    productRowHeaders.innerHTML = `
        <div>Product</div>
        <div>Supply Qty</div>
        <div>Rate</div>
        <div>Amount</div>
        <div></div>
    `;
    productsContainer.appendChild(productRowHeaders);

    // Add product rows
    if (editableOrder && editableOrder.products && editableOrder.products.length > 0) {
        editableOrder.products.forEach((product, index) => {
            addProductRow(productsContainer, index + 1, product);
        });
    } else {
        addProductRow(productsContainer, 1);
    }

    // Add total row
    const totalRow = document.createElement('div');
    totalRow.className = 'total-row';
    totalRow.style.cssText = `
        display: flex;
        justify-content: flex-end;
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid #eee;
        font-weight: bold;
    `;

    totalRow.innerHTML = `
        <div style="margin-right: 20px;"><strong>Total:</strong></div>
        <div><input type="text" id="orderTotal" readonly value="${editableOrder?.total || '0.00'}" style="text-align: right; font-weight: bold; background-color: transparent; border: none;"></div>
    `;
    productsSection.appendChild(totalRow);

    // Add form controls
    const formControls = document.createElement('div');
    formControls.style.cssText = `
        grid-column: 1 / 3;
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
        gap: 10px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.type = 'button';
    cancelButton.className = 'cancel-btn';
    cancelButton.style.cssText = `
        background-color: #f1f1f1;
        color: #333;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    cancelButton.onmouseover = () => { cancelButton.style.backgroundColor = '#ddd'; };
    cancelButton.onmouseout = () => { cancelButton.style.backgroundColor = '#f1f1f1'; };

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Order';
    saveButton.type = 'submit';
    saveButton.className = 'save-btn';
    saveButton.style.cssText = `
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    saveButton.onmouseover = () => { saveButton.style.backgroundColor = 'var(--primary-color-dark)'; };
    saveButton.onmouseout = () => { saveButton.style.backgroundColor = 'var(--primary-color)'; };

    formControls.appendChild(cancelButton);
    formControls.appendChild(saveButton);

    // Append all elements to form
    orderForm.appendChild(basicInfoSection);
    orderForm.appendChild(customerSection);
    orderForm.appendChild(transportSection);
    orderForm.appendChild(productsSection);
    orderForm.appendChild(formControls);

    formContainer.appendChild(orderForm);
    modalBackground.appendChild(modal);
    document.body.appendChild(modalBackground);

    // Add event listeners
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalBackground);
    });

    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modalBackground);
    });

    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveOrder(editableOrder);
    });

    addProductButton.addEventListener('click', () => {
        const productRows = productsContainer.querySelectorAll('.product-row');
        addProductRow(productsContainer, productRows.length + 1);
    });

    // Set up autocomplete for customer, transporter and product fields
    setupCustomerAutocomplete('orderCustomer', editableOrder?.customer || '');
    setupTransporterAutocomplete('orderTransporter', editableOrder?.transporter || '');
    
    // Set up product autocomplete for existing products
    const productInputs = document.querySelectorAll('[id^="orderProduct"]');
    productInputs.forEach(input => {
        setupProductAutocomplete(input.id, input.value || '');
    });

    // Add event listener for transport fare to update total
    document.getElementById('orderTransportFare').addEventListener('input', updateOrderTotal);

    // Focus on the first input
    document.getElementById('orderCustomer').focus();

    // Make the modal draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    modalHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === modalHeader || modalHeader.contains(e.target)) {
            isDragging = true;
            modalHeader.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, modal);
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        modalHeader.style.cursor = 'grab';
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
}

/**
 * Add a product row to the order form
 * Set up enhanced autocomplete dropdown for transporters
 * @param {string} inputId - The ID of the input element
 * @param {string} selectedValue - Optional preselected value
 */
async function setupTransporterAutocomplete(inputId, selectedValue = '') {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;
    
    // Store original input value if provided
    if (selectedValue) {
        inputElement.value = selectedValue;
    }
    
    // Create popup elements
    const popup = document.createElement('div');
    popup.className = 'autocomplete-popup';
    popup.id = `${inputId}-popup`;
    popup.style.cssText = `
        display: none;
        position: absolute;
        top: ${inputElement.offsetTop + inputElement.offsetHeight + 5}px;
        left: ${inputElement.offsetLeft}px;
        width: ${inputElement.offsetWidth}px;
        max-height: 300px;
        background-color: white;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        overflow: hidden;
    `;
    
    // Create popup header
    const popupHeader = document.createElement('div');
    popupHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
        background-color: #f9f9f9;
    `;
    
    const popupTitle = document.createElement('div');
    popupTitle.textContent = 'Select Transporter';
    popupTitle.style.fontWeight = '600';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        border: none;
        background: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0 5px;
        color: #666;
    `;
    
    popupHeader.appendChild(popupTitle);
    popupHeader.appendChild(closeButton);
    
    // Create search input
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
    `;
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search transporters...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
    `;
    
    searchContainer.appendChild(searchInput);
    
    // Create transporters container
    const transportersContainer = document.createElement('div');
    transportersContainer.style.cssText = `
        max-height: 200px;
        overflow-y: auto;
    `;
    
    // Add components to popup
    popup.appendChild(popupHeader);
    popup.appendChild(searchContainer);
    popup.appendChild(transportersContainer);
    
    // Add popup next to the input
    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(popup);
    
    // Create icon for the input
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #666;
        cursor: pointer;
    `;
    iconContainer.innerHTML = '<i class="fas fa-chevron-down"></i>';
    
    // Add icon to input container if it doesn't already have one
    if (!inputElement.parentNode.querySelector('.dropdown-icon')) {
        iconContainer.className = 'dropdown-icon';
        inputElement.parentNode.appendChild(iconContainer);
        inputElement.style.paddingRight = '30px';
    }
    
    // Function to show popup
    function showPopup() {
        // Position the popup relative to the input's current position
        const rect = inputElement.getBoundingClientRect();
        popup.style.top = `${inputElement.offsetHeight}px`;
        popup.style.width = `${inputElement.offsetWidth}px`;
        
        popup.style.display = 'block';
        searchInput.value = '';
        searchInput.focus();
        loadTransporters();
    }
    
    // Function to hide popup
    function hidePopup() {
        popup.style.display = 'none';
    }
    
    // Load transporters from API
    async function loadTransporters(searchText = '') {
        try {
            const response = await fetch('/api/transporters');
            if (!response.ok) throw new Error('Failed to fetch transporters');
            
            const transporters = await response.json();
            renderTransporters(transporters, searchText);
        } catch (error) {
            console.error('Error loading transporters:', error);
            transportersContainer.innerHTML = '<div class="no-results">Failed to load transporters</div>';
        }
    }
    
    // Render transporters in the popup
    function renderTransporters(transporters, searchText = '') {
        transportersContainer.innerHTML = '';
        
        // Filter transporters if search text is provided
        let filteredTransporters = transporters;
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            filteredTransporters = transporters.filter(transporter => 
                (transporter.name && transporter.name.toLowerCase().includes(searchLower)) ||
                (transporter.mobile && transporter.mobile.includes(searchText))
            );
        }
        
        if (filteredTransporters.length === 0) {
            transportersContainer.innerHTML = '<div class="no-results" style="padding: 15px; text-align: center; color: #666;">No transporters found</div>';
            return;
        }
        
        filteredTransporters.forEach(transporter => {
            const transporterItem = document.createElement('div');
            transporterItem.className = 'autocomplete-item';
            transporterItem.style.cssText = `
                padding: 10px 15px;
                cursor: pointer;
                border-bottom: 1px solid #f5f5f5;
                transition: background-color 0.2s;
            `;
            
            // Build transporter details
            transporterItem.innerHTML = `
                <div style="font-weight: bold;">${transporter.name}</div>
                ${transporter.mobile ? `<div style="font-size: 12px; color: #666;">${transporter.mobile}</div>` : ''}
                ${transporter.address ? `<div style="font-size: 12px; color: #666;">${transporter.address}</div>` : ''}
            `;
            
            // Highlight selected transporter
            if (transporter.name === inputElement.value) {
                transporterItem.style.backgroundColor = '#f0f7ff';
                transporterItem.style.borderLeft = '3px solid var(--primary-color)';
            }
            
            // Hover effect
            transporterItem.addEventListener('mouseover', () => {
                transporterItem.style.backgroundColor = '#f5f5f5';
            });
            
            transporterItem.addEventListener('mouseout', () => {
                if (transporter.name === inputElement.value) {
                    transporterItem.style.backgroundColor = '#f0f7ff';
                } else {
                    transporterItem.style.backgroundColor = '';
                }
            });
            
            // Select transporter on click
            transporterItem.addEventListener('click', () => {
                inputElement.value = transporter.name;
                hidePopup();
                
                // Trigger change event
                const event = new Event('change');
                inputElement.dispatchEvent(event);
            });
            
            transportersContainer.appendChild(transporterItem);
        });
    }
    
    // Add event listeners
    inputElement.addEventListener('click', (e) => {
        e.preventDefault();
        showPopup();
    });
    
    if (iconContainer) {
        iconContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showPopup();
        });
    }
    
    closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        hidePopup();
    });
    
    searchInput.addEventListener('input', (e) => {
        loadTransporters(e.target.value);
    });
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== inputElement && !iconContainer.contains(e.target)) {
            hidePopup();
        }
    });
    
    // Close popup on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hidePopup();
        }
    });
    
    // Initial load if a value is selected
    if (selectedValue) {
        inputElement.value = selectedValue;
    }
}

/**
 * Set up enhanced autocomplete dropdown for products
 * @param {string} inputId - The ID of the input element
 * @param {string} selectedValue - Optional preselected value
 */
async function setupProductAutocomplete(inputId, selectedValue = '') {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;
    
    // Store original input value if provided
    if (selectedValue) {
        inputElement.value = selectedValue;
    }
    
    // Create popup elements
    const popup = document.createElement('div');
    popup.className = 'autocomplete-popup';
    popup.id = `${inputId}-popup`;
    popup.style.cssText = `
        display: none;
        position: absolute;
        top: ${inputElement.offsetTop + inputElement.offsetHeight + 5}px;
        left: ${inputElement.offsetLeft}px;
        width: ${inputElement.offsetWidth}px;
        max-height: 300px;
        background-color: white;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        overflow: hidden;
    `;
    
    // Create popup header
    const popupHeader = document.createElement('div');
    popupHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
        background-color: #f9f9f9;
    `;
    
    const popupTitle = document.createElement('div');
    popupTitle.textContent = 'Select Product';
    popupTitle.style.fontWeight = '600';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        border: none;
        background: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0 5px;
        color: #666;
    `;
    
    popupHeader.appendChild(popupTitle);
    popupHeader.appendChild(closeButton);
    
    // Create search input
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
    `;
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search products...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
    `;
    
    searchContainer.appendChild(searchInput);
    
    // Create products container
    const productsContainer = document.createElement('div');
    productsContainer.style.cssText = `
        max-height: 200px;
        overflow-y: auto;
    `;
    
    // Add components to popup
    popup.appendChild(popupHeader);
    popup.appendChild(searchContainer);
    popup.appendChild(productsContainer);
    
    // Add popup next to the input
    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(popup);
    
    // Create icon for the input
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #666;
        cursor: pointer;
    `;
    iconContainer.innerHTML = '<i class="fas fa-chevron-down"></i>';
    
    // Add icon to input container if it doesn't already have one
    if (!inputElement.parentNode.querySelector('.dropdown-icon')) {
        iconContainer.className = 'dropdown-icon';
        inputElement.parentNode.appendChild(iconContainer);
        inputElement.style.paddingRight = '30px';
    }
    
    // Function to show popup
    function showPopup() {
        // Position the popup relative to the input's current position
        const rect = inputElement.getBoundingClientRect();
        popup.style.top = `${inputElement.offsetHeight}px`;
        popup.style.width = `${inputElement.offsetWidth}px`;
        
        popup.style.display = 'block';
        searchInput.value = '';
        searchInput.focus();
        loadProducts();
    }
    
    // Function to hide popup
    function hidePopup() {
        popup.style.display = 'none';
    }
    
    // Load products from API
    async function loadProducts(searchText = '') {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            
            const products = await response.json();
            renderProducts(products, searchText);
        } catch (error) {
            console.error('Error loading products:', error);
            productsContainer.innerHTML = '<div class="no-results">Failed to load products</div>';
        }
    }
    
    // Render products in the popup
    function renderProducts(products, searchText = '') {
        productsContainer.innerHTML = '';
        
        // Filter products if search text is provided
        let filteredProducts = products;
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            filteredProducts = products.filter(product => 
                (product.name && product.name.toLowerCase().includes(searchLower)) ||
                (product.productName && product.productName.toLowerCase().includes(searchLower)) ||
                (product.description && product.description.toLowerCase().includes(searchLower))
            );
        }
        
        if (filteredProducts.length === 0) {
            productsContainer.innerHTML = '<div class="no-results" style="padding: 15px; text-align: center; color: #666;">No products found</div>';
            return;
        }
        
        filteredProducts.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'autocomplete-item';
            productItem.style.cssText = `
                padding: 10px 15px;
                cursor: pointer;
                border-bottom: 1px solid #f5f5f5;
                transition: background-color 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            const productName = product.name || product.productName;
            
            // Build product details with stock and price info if available
            const productInfo = document.createElement('div');
            productInfo.innerHTML = `
                <div style="font-weight: bold;">${productName}</div>
                ${product.description ? `<div style="font-size: 12px; color: #666;">${product.description}</div>` : ''}
            `;
            
            const productStats = document.createElement('div');
            productStats.style.cssText = `
                text-align: right;
                font-size: 12px;
            `;
            
            // Show stock and price if available
            if (product.quantity !== undefined) {
                const stockDiv = document.createElement('div');
                stockDiv.textContent = `Stock: ${product.quantity}`;
                stockDiv.style.color = product.quantity > 10 ? '#27ae60' : product.quantity > 0 ? '#f39c12' : '#e74c3c';
                productStats.appendChild(stockDiv);
            }
            
            if (product.price !== undefined) {
                const priceDiv = document.createElement('div');
                priceDiv.textContent = `Price: ₹${product.price}`;
                priceDiv.style.color = '#3498db';
                productStats.appendChild(priceDiv);
            }
            
            productItem.appendChild(productInfo);
            productItem.appendChild(productStats);
            
            // Highlight selected product
            if (productName === inputElement.value) {
                productItem.style.backgroundColor = '#f0f7ff';
                productItem.style.borderLeft = '3px solid var(--primary-color)';
            }
            
            // Hover effect
            productItem.addEventListener('mouseover', () => {
                productItem.style.backgroundColor = '#f5f5f5';
            });
            
            productItem.addEventListener('mouseout', () => {
                if (productName === inputElement.value) {
                    productItem.style.backgroundColor = '#f0f7ff';
                } else {
                    productItem.style.backgroundColor = '';
                }
            });
            
            // Select product on click
            productItem.addEventListener('click', () => {
                inputElement.value = productName;
                hidePopup();
                
                // If there's a rate field associated with this product, update it
                const index = inputId.match(/orderProduct(\d+)/);
                if (index) {
                    const rateFieldId = `orderRate${index[1]}`;
                    const rateField = document.getElementById(rateFieldId);
                    if (rateField && product.price) {
                        rateField.value = product.price;
                        
                        // Also update amount field if there's a quantity
                        const qtyFieldId = `orderSupplyQty${index[1]}`;
                        const qtyField = document.getElementById(qtyFieldId);
                        if (qtyField && qtyField.value) {
                            const amountFieldId = `orderAmount${index[1]}`;
                            const amountField = document.getElementById(amountFieldId);
                            if (amountField) {
                                const amount = parseFloat(qtyField.value) * parseFloat(product.price);
                                amountField.value = amount.toFixed(2);
                                
                                // Update total
                                updateOrderTotal();
                            }
                        }
                    }
                }
                
                // Trigger change event
                const event = new Event('change');
                inputElement.dispatchEvent(event);
            });
            
            productsContainer.appendChild(productItem);
        });
    }
    
    // Add event listeners
    inputElement.addEventListener('click', (e) => {
        e.preventDefault();
        showPopup();
    });
    
    if (iconContainer) {
        iconContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showPopup();
        });
    }
    
    closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        hidePopup();
    });
    
    searchInput.addEventListener('input', (e) => {
        loadProducts(e.target.value);
    });
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== inputElement && !iconContainer.contains(e.target)) {
            hidePopup();
        }
    });
    
    // Close popup on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hidePopup();
        }
    });
    
    // Initial load if a value is selected
    if (selectedValue) {
        inputElement.value = selectedValue;
    }
} 

/**
 * Save the order data
 * @param {Object} editableOrder - Optional existing order to edit
 */
async function saveOrder(editableOrder = null) {
    try {
        // Get form data
        const orderId = document.getElementById('orderId').value;
        const date = document.getElementById('orderDate').value;
        const customer = document.getElementById('orderCustomer').value;
        const paymentType = document.getElementById('orderPaymentType').value;
        const shipToAddress = document.getElementById('orderShipToAddress').value;
        const transporter = document.getElementById('orderTransporter').value;
        const transportFare = parseFloat(document.getElementById('orderTransportFare').value) || 0;
        const total = parseFloat(document.getElementById('orderTotal').value) || 0;
        
        // Get product data
        const products = [];
        const productRows = document.querySelectorAll('.product-row');
        
        productRows.forEach(row => {
            const index = row.dataset.index;
            const product = document.getElementById(`orderProduct${index}`).value;
            const supplyQty = parseFloat(document.getElementById(`orderSupplyQty${index}`).value) || 0;
            const rate = parseFloat(document.getElementById(`orderRate${index}`).value) || 0;
            const amount = parseFloat(document.getElementById(`orderAmount${index}`).value) || 0;
            
            // Skip empty rows
            if (product && supplyQty > 0) {
                products.push({
                    product,
                    supplyQty,
                    rate,
                    amount
                });
            }
        });
        
        // Validate form
        if (!customer) {
            showError('Please select a customer');
            return;
        }
        
        if (!paymentType) {
            showError('Please select a payment type');
            return;
        }
        
        if (products.length === 0) {
            showError('Please add at least one product');
            return;
        }
        
        // Create order object
        const order = {
            id: orderId,
            orderId,
            date,
            customer,
            paymentType,
            shipToAddress,
            transporter,
            transportFare,
            products,
            total,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Get existing orders from localStorage
        let pendingOrders = JSON.parse(localStorage.getItem('pendingOrders')) || [];
        
        if (editableOrder) {
            // Update existing order
            const index = pendingOrders.findIndex(o => o.id === editableOrder.id);
            if (index !== -1) {
                pendingOrders[index] = order;
            } else {
                pendingOrders.push(order);
            }
            showSuccessMessage('Order updated successfully');
        } else {
            // Add new order
            pendingOrders.push(order);
            showSuccessMessage('Order added successfully');
        }
        
        // Save to localStorage
        localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
        
        // Close modal
        const modalBackground = document.querySelector('.order-form-modal-background');
        if (modalBackground) {
            document.body.removeChild(modalBackground);
        }
        
        // Refresh pending orders list
        loadPendingOrders();
    } catch (error) {
        console.error('Error saving order:', error);
        showError('Failed to save order. Please try again.');
    }
}

/**
 * Edit a pending order
 * @param {string} orderId - The ID of the order to edit
 */
function editPendingOrder(orderId) {
    try {
        // Get pending orders from localStorage
        const pendingOrders = JSON.parse(localStorage.getItem('pendingOrders')) || [];
        
        // Find the order to edit (check both id and orderId fields)
        const orderToEdit = pendingOrders.find(order => 
            (order.id === orderId) || (order.orderId === orderId)
        );
        
        if (!orderToEdit) {
            showError('Order not found');
            return;
        }
        
        // Show the order form with the order data
        showOrderForm(orderToEdit);
    } catch (error) {
        console.error('Error editing order:', error);
        showError('Failed to edit order. Please try again.');
    }
}

/**
 * Delete a pending order
 * @param {string} orderId - The ID of the order to delete
 */
function deletePendingOrder(orderId) {
    try {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this order?')) {
            return;
        }
        
        // Get pending orders from localStorage
        let pendingOrders = JSON.parse(localStorage.getItem('pendingOrders')) || [];
        
        // Remove the order (check both id and orderId fields)
        pendingOrders = pendingOrders.filter(order => 
            (order.id !== orderId) && (order.orderId !== orderId)
        );
        
        // Save to localStorage
        localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
        
        // Refresh pending orders list
        loadPendingOrders();
        
        showSuccessMessage('Order deleted successfully');
    } catch (error) {
        console.error('Error deleting order:', error);
        showError('Failed to delete order. Please try again.');
    }
}

/**
 * Initialize date period selector functionality
 */
function initDatePeriodSelector() {
    const datePeriodSelect = document.getElementById('datePeriod');
    if (!datePeriodSelect) return;
    
    datePeriodSelect.addEventListener('change', function() {
        const selectedPeriod = this.value;
        console.log('Date period changed:', selectedPeriod);
        
        // Get date range based on selected period
        const dateRange = getDateRangeForPeriod(selectedPeriod);
        
        // Refresh all dashboard widgets with the new date range
        refreshAllWidgets(dateRange);
    });
}

/**
 * Get date range based on selected period
 * @param {string} period - The selected time period
 * @returns {Object} Object with startDate and endDate
 */
function getDateRangeForPeriod(period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch(period) {
        case 'today':
            // Just today
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'week':
            // This week (starting from Sunday)
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'month':
            // This month
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'quarter':
            // This quarter
            const quarter = Math.floor(now.getMonth() / 3);
            startDate.setMonth(quarter * 3);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'year':
            // This year
            startDate.setMonth(0);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'custom':
            // Show date picker for custom range
            showCustomDatePicker();
            return null;
            
        default:
            // Default to this month
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
    }
    
    return {
        startDate: formatDateForAPI(startDate),
        endDate: formatDateForAPI(endDate)
    };
}

/**
 * Show a custom date picker for selecting a date range
 */
function showCustomDatePicker() {
    // This would be implemented with a date picker library
    alert('Custom date range picker would appear here.');
    
    // For now, just set it back to 'month'
    const datePeriodSelect = document.getElementById('datePeriod');
    if (datePeriodSelect) {
        datePeriodSelect.value = 'month';
    }
}

/**
 * Refresh all dashboard widgets with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
function refreshAllWidgets(dateRange) {
    if (!dateRange) return;
    
    console.log('Refreshing widgets with date range:', dateRange);
    
    // Refresh each widget type
    refreshWidget('sales-summary', dateRange);
    refreshWidget('inventory-status', dateRange);
    refreshWidget('purchase-summary', dateRange);
    refreshWidget('transporter-overview', dateRange);
    refreshWidget('recent-transactions', dateRange);
    refreshWidget('pending-orders', dateRange);
    
    // Update any charts
    refreshCharts(dateRange);
}

/**
 * Refresh all charts with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
function refreshCharts(dateRange) {
    if (!dateRange) return;
    
    // Update any charts that need date filtering
    updateMonthlySalesChart(dateRange);
    updateProductPerformanceChart(dateRange);
    updatePurchasesChart(dateRange);
    updateTransportersChart(dateRange);
}

/**
 * Update the monthly sales chart with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
async function updateMonthlySalesChart(dateRange) {
    try {
        // Get sales data filtered by date range
        const response = await fetch(`/api/sales/monthly?start=${dateRange.startDate}&end=${dateRange.endDate}`);
        
        if (!response.ok) {
            // If API call fails, generate sample data
            const sampleData = generateSampleSalesData();
            createMonthlySalesChart(sampleData);
            return;
        }
        
        const salesData = await response.json();
        createMonthlySalesChart(salesData);
    } catch (error) {
        console.error('Error updating monthly sales chart:', error);
        // Use sample data as fallback
        const sampleData = generateSampleSalesData();
        createMonthlySalesChart(sampleData);
    }
}

/**
 * Update the product performance chart with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
async function updateProductPerformanceChart(dateRange) {
    try {
        // Get product data filtered by date range
        const response = await fetch(`/api/products/performance?start=${dateRange.startDate}&end=${dateRange.endDate}`);
        
        if (!response.ok) {
            // If API call fails, use existing chart data or sample data
            return;
        }
        
        const productData = await response.json();
        createProductPerformanceChart(productData);
    } catch (error) {
        console.error('Error updating product performance chart:', error);
    }
}

/**
 * Update the purchases chart with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
async function updatePurchasesChart(dateRange) {
    try {
        // Get purchases data filtered by date range
        const response = await fetch(`/api/purchases/summary?start=${dateRange.startDate}&end=${dateRange.endDate}`);
        
        if (!response.ok) {
            // If API call fails, use sample data
            const sampleData = generateSamplePurchasesData();
            createPurchasesChart(sampleData);
            return;
        }
        
        const purchasesData = await response.json();
        createPurchasesChart(purchasesData);
    } catch (error) {
        console.error('Error updating purchases chart:', error);
        // Use sample data as fallback
        const sampleData = generateSamplePurchasesData();
        createPurchasesChart(sampleData);
    }
}

/**
 * Update the transporters chart with new date range
 * @param {Object} dateRange - Object with startDate and endDate
 */
async function updateTransportersChart(dateRange) {
    try {
        // Get transporter data filtered by date range
        const transporterResponse = await fetch(`/api/transporters/summary?start=${dateRange.startDate}&end=${dateRange.endDate}`);
        const salesResponse = await fetch(`/api/sales/summary?start=${dateRange.startDate}&end=${dateRange.endDate}`);
        
        if (!transporterResponse.ok || !salesResponse.ok) {
            // If API calls fail, use sample data
            const sampleTransporterData = generateSampleTransporterData();
            const sampleSalesData = generateSampleSalesData();
            createTransportersChart(sampleTransporterData, sampleSalesData);
            return;
        }
        
        const transporterData = await transporterResponse.json();
        const salesData = await salesResponse.json();
        createTransportersChart(transporterData, salesData);
    } catch (error) {
        console.error('Error updating transporters chart:', error);
        // Use sample data as fallback
        const sampleTransporterData = generateSampleTransporterData();
        const sampleSalesData = generateSampleSalesData();
        createTransportersChart(sampleTransporterData, sampleSalesData);
    }
}

/**
 * Mark a pending order as delivered - convert to a sale
 * @param {string} orderId - The ID of the order to mark as delivered
 */
async function markOrderAsDelivered(orderId) {
    if (!confirm('Mark this order as delivered? This will create a sales entry.')) return;
    
    // Get the order from localStorage
    const storedOrders = localStorage.getItem('pendingOrders');
    if (!storedOrders) return;
    
    const orders = JSON.parse(storedOrders);
    
    // Find the order (check both id and orderId fields)
    const orderIndex = orders.findIndex(o => 
        (o.id === orderId) || (o.orderId === orderId)
    );
    
    if (orderIndex === -1) {
        showError('Order not found');
        return;
    }
    
    const order = orders[orderIndex];
    
    try {
        // Create a sale from this order
        const saleData = {
            ...order,
            status: 'Delivered',
            deliveryDate: new Date().toISOString().split('T')[0]
        };
        
        // Ask for received quantities
        const receivedQtys = await promptForReceivedQuantities(order.products);
        if (!receivedQtys) return; // User cancelled
        
        // Update received quantities
        saleData.products = saleData.products.map((product, index) => ({
            ...product,
            receivedQty: receivedQtys[index]
        }));
        
        // Remove from pending orders
        orders.splice(orderIndex, 1);
        localStorage.setItem('pendingOrders', JSON.stringify(orders));
        
        // Send to server as a sale
        const response = await fetch('/api/sales/multi-product', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saleData)
        });
        
        if (!response.ok) {
            // If server API fails, still save as completed in localStorage
            let completedOrders = [];
            const storedCompletedOrders = localStorage.getItem('completedOrders');
            
            if (storedCompletedOrders) {
                completedOrders = JSON.parse(storedCompletedOrders);
            }
            
            completedOrders.push(saleData);
            localStorage.setItem('completedOrders', JSON.stringify(completedOrders));
            
            showSuccessMessage('Order marked as delivered (saved locally)');
        } else {
            showSuccessMessage('Order marked as delivered and added to sales');
        }
        
        // Refresh the pending orders display
        loadPendingOrders();
    } catch (error) {
        console.error('Error marking order as delivered:', error);
        showError('Failed to mark order as delivered');
    }
}

/**
 * Prompt the user for received quantities
 * @param {Array} products - The products in the order
 * @returns {Promise<Array>} - Array of received quantities
 */
function promptForReceivedQuantities(products) {
    return new Promise((resolve, reject) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'received-qty-modal';
        modal.style.cssText = `
            background-color: var(--card-bg);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            width: 90%;
            max-width: 600px;
            padding: 20px;
            position: relative;
        `;
        
        // Modal HTML
        modal.innerHTML = `
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Enter Received Quantities</h2>
                <button class="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="receivedQtyForm">
                <div class="products-list">
                    ${products.map((product, index) => `
                        <div class="product-item" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong>${product.product || product.productName || 'Unknown Product'}</strong>
                                <span>Supply Qty: ${product.supplyQty}</span>
                            </div>
                            <div class="form-group">
                                <label for="receivedQty${index}">Received Quantity</label>
                                <input type="number" id="receivedQty${index}" name="receivedQty${index}" 
                                       value="${product.supplyQty}" min="0" max="${product.supplyQty}" 
                                       style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-actions" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="cancel-btn" style="padding: 10px 20px; border-radius: 4px; border: 1px solid #ddd; background: none; cursor: pointer;">Cancel</button>
                    <button type="submit" class="save-btn" style="padding: 10px 20px; border-radius: 4px; border: none; background-color: var(--primary-color); color: white; cursor: pointer;">Confirm Delivery</button>
                </div>
            </form>
        `;
        
        // Add the modal to the DOM
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null); // User cancelled
        });
        
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null); // User cancelled
        });
        
        // Handle form submission
        const receivedQtyForm = document.getElementById('receivedQtyForm');
        if (receivedQtyForm) {
            receivedQtyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Collect received quantities
                const receivedQtys = products.map((_, index) => {
                    const input = document.getElementById(`receivedQty${index}`);
                    return parseInt(input.value) || 0;
                });
                
                // Close the modal
                document.body.removeChild(overlay);
                
                // Return the received quantities
                resolve(receivedQtys);
            });
        }
    });
}

// Replace the populateCustomersDropdown function
async function populateCustomersDropdown(selectedValue = null) {
    try {
        // Create custom dropdown if it doesn't exist yet
        setupCustomerAutocomplete(selectedValue);
    } catch (error) {
        console.error('Error populating customers dropdown:', error);
        showError('Failed to load customers');
    }
}

// Replace the populateTransportersDropdown function
async function populateTransportersDropdown(selectedValue = null) {
    try {
        // Create custom dropdown if it doesn't exist yet
        setupTransporterAutocomplete(selectedValue);
    } catch (error) {
        console.error('Error populating transporters dropdown:', error);
        showError('Failed to load transporters');
    }
}

// Replace the populateProductsDropdown function
async function populateProductsDropdown(productSelect, selectedValue = null) {
    try {
        // Create custom product dropdown
        setupProductAutocomplete(productSelect, selectedValue);
    } catch (error) {
        console.error('Error populating products dropdown:', error);
        showError('Failed to load products');
    }
}

/**
 * Setup customer autocomplete dropdown
 */
function setupCustomerAutocomplete(selectedValue = null) {
    // Get the select element
    const customerSelect = document.getElementById('customer');
    if (!customerSelect) return;

    // Hide the original select element
    customerSelect.style.display = 'none';

    // Create a container for the custom dropdown
    const container = document.createElement('div');
    container.className = 'custom-dropdown-container';
    container.style.cssText = `
        position: relative;
        width: 100%;
        margin-bottom: 15px;
    `;
    customerSelect.parentNode.insertBefore(container, customerSelect);

    // Create the selected display
    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'selected-display';
    selectedDisplay.setAttribute('data-value', '');
    selectedDisplay.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        background-color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    selectedDisplay.innerHTML = `
        <span class="selected-text">Select Customer</span>
        <i class="fas fa-chevron-down"></i>
    `;
    container.appendChild(selectedDisplay);

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'dropdown-container';
    dropdownContainer.style.cssText = `
        position: absolute;
        width: 100%;
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        z-index: 1000;
        display: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;
    container.appendChild(dropdownContainer);

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search';
    searchInput.placeholder = 'Search customers...';
    searchInput.style.cssText = `
        width: 94%;
        padding: 8px;
        border: none;
        border-bottom: 1px solid #ddd;
        outline: none;
        position: sticky;
        top: 0;
        background-color: white;
    `;
    dropdownContainer.appendChild(searchInput);

    // Create dropdown items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'dropdown-items';
    dropdownContainer.appendChild(itemsContainer);

    // Event to toggle dropdown
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdownContainer.style.display === 'block';
        dropdownContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            searchInput.focus();
            // Load customers if not already loaded
            if (itemsContainer.children.length === 0) {
                loadCustomers();
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdownContainer.style.display = 'none';
    });

    // Prevent closing when clicking inside the dropdown
    dropdownContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Search functionality
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        Array.from(itemsContainer.children).forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Function to load customers
    async function loadCustomers() {
        try {
            // Show loading indicator
            itemsContainer.innerHTML = '<div class="dropdown-item loading">Loading...</div>';
            
            // Fetch customers
            const response = await fetch('/api/accounts');
            if (!response.ok) throw new Error('Failed to fetch customers');
            
            const accounts = await response.json();
            const customers = accounts.filter(account => account.account_type === 'customer');
            
            // Clear loading
            itemsContainer.innerHTML = '';
            
            // Add customers to dropdown
            customers.forEach(customer => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.setAttribute('data-value', customer.id);
                item.textContent = customer.name;
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `;
                
                // Hover effect
                item.addEventListener('mouseover', () => {
                    item.style.backgroundColor = '#f0f0f0';
                });
                
                item.addEventListener('mouseout', () => {
                    item.style.backgroundColor = 'white';
                });
                
                // Selection
                item.addEventListener('click', () => {
                    const selectedText = item.textContent;
                    const selectedValue = item.getAttribute('data-value');
                    
                    selectedDisplay.querySelector('.selected-text').textContent = selectedText;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    
                    // Update the original select
                    customerSelect.value = selectedValue;
                    
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    customerSelect.dispatchEvent(event);
                    
                    // Hide dropdown
                    dropdownContainer.style.display = 'none';
                });
                
                itemsContainer.appendChild(item);
            });
            
            // Set selected value if provided
            if (selectedValue) {
                const selectedItem = Array.from(itemsContainer.children).find(
                    item => item.getAttribute('data-value') === selectedValue
                );
                
                if (selectedItem) {
                    selectedDisplay.querySelector('.selected-text').textContent = selectedItem.textContent;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    customerSelect.value = selectedValue;
                }
            }
        } catch (error) {
            console.error('Error loading customers:', error);
            itemsContainer.innerHTML = '<div class="dropdown-item error">Error loading customers</div>';
        }
    }
}

/**
 * Setup transporter autocomplete dropdown
 */
function setupTransporterAutocomplete(selectedValue = null) {
    // Get the select element
    const transporterSelect = document.getElementById('transporter');
    if (!transporterSelect) return;

    // Hide the original select element
    transporterSelect.style.display = 'none';

    // Create a container for the custom dropdown
    const container = document.createElement('div');
    container.className = 'custom-dropdown-container';
    container.style.cssText = `
        position: relative;
        width: 100%;
        margin-bottom: 15px;
    `;
    transporterSelect.parentNode.insertBefore(container, transporterSelect);

    // Create the selected display
    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'selected-display';
    selectedDisplay.setAttribute('data-value', '');
    selectedDisplay.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        background-color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    selectedDisplay.innerHTML = `
        <span class="selected-text">Select Transporter</span>
        <i class="fas fa-chevron-down"></i>
    `;
    container.appendChild(selectedDisplay);

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'dropdown-container';
    dropdownContainer.style.cssText = `
        position: absolute;
        width: 100%;
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        z-index: 1000;
        display: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;
    container.appendChild(dropdownContainer);

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search';
    searchInput.placeholder = 'Search transporters...';
    searchInput.style.cssText = `
        width: 94%;
        padding: 8px;
        border: none;
        border-bottom: 1px solid #ddd;
        outline: none;
        position: sticky;
        top: 0;
        background-color: white;
    `;
    dropdownContainer.appendChild(searchInput);

    // Create dropdown items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'dropdown-items';
    dropdownContainer.appendChild(itemsContainer);

    // Event to toggle dropdown
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdownContainer.style.display === 'block';
        dropdownContainer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            searchInput.focus();
            // Load transporters if not already loaded
            if (itemsContainer.children.length === 0) {
                loadTransporters();
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdownContainer.style.display = 'none';
    });

    // Prevent closing when clicking inside the dropdown
    dropdownContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Search functionality
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        Array.from(itemsContainer.children).forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Function to load transporters
    async function loadTransporters() {
        try {
            // Show loading indicator
            itemsContainer.innerHTML = '<div class="dropdown-item loading">Loading...</div>';
            
            // Fetch transporters
            const response = await fetch('/api/transporters');
            if (!response.ok) throw new Error('Failed to fetch transporters');
            
            const transporters = await response.json();
            
            // Clear loading
            itemsContainer.innerHTML = '';
            
            // Add transporters to dropdown
            transporters.forEach(transporter => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.setAttribute('data-value', transporter.id);
                item.textContent = transporter.name;
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `;
                
                // Hover effect
                item.addEventListener('mouseover', () => {
                    item.style.backgroundColor = '#f0f0f0';
                });
                
                item.addEventListener('mouseout', () => {
                    item.style.backgroundColor = 'white';
                });
                
                // Selection
                item.addEventListener('click', () => {
                    const selectedText = item.textContent;
                    const selectedValue = item.getAttribute('data-value');
                    
                    selectedDisplay.querySelector('.selected-text').textContent = selectedText;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    
                    // Update the original select
                    transporterSelect.value = selectedValue;
                    
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    transporterSelect.dispatchEvent(event);
                    
                    // Hide dropdown
                    dropdownContainer.style.display = 'none';
                });
                
                itemsContainer.appendChild(item);
            });
            
            // Set selected value if provided
            if (selectedValue) {
                const selectedItem = Array.from(itemsContainer.children).find(
                    item => item.getAttribute('data-value') === selectedValue
                );
                
                if (selectedItem) {
                    selectedDisplay.querySelector('.selected-text').textContent = selectedItem.textContent;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    transporterSelect.value = selectedValue;
                }
            }
        } catch (error) {
            console.error('Error loading transporters:', error);
            itemsContainer.innerHTML = '<div class="dropdown-item error">Error loading transporters</div>';
        }
    }
}

/**
 * Setup product autocomplete dropdown for a specific product select element
 */
function setupProductAutocomplete(productSelect, selectedValue = null) {
    if (!productSelect) return;

    // Get the parent container
    const parentContainer = productSelect.closest('.product-row');
    if (!parentContainer) return;

    // Hide the original select element
    productSelect.style.display = 'none';

    // Create a container for the custom dropdown
    const container = document.createElement('div');
    container.className = 'custom-dropdown-container';
    container.style.cssText = `
        position: relative;
        width: 100%;
    `;
    productSelect.parentNode.insertBefore(container, productSelect);

    // Create the selected display
    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'selected-display';
    selectedDisplay.setAttribute('data-value', '');
    selectedDisplay.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        background-color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    selectedDisplay.innerHTML = `
        <span class="selected-text">Select Product</span>
        <i class="fas fa-chevron-down"></i>
    `;
    container.appendChild(selectedDisplay);

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'dropdown-container';
    dropdownContainer.style.cssText = `
        position: absolute;
        width: 100%;
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        z-index: 1000;
        display: none;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;
    container.appendChild(dropdownContainer);

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search';
    searchInput.placeholder = 'Search products...';
    searchInput.style.cssText = `
        width: 94%;
        padding: 8px;
        border: none;
        border-bottom: 1px solid #ddd;
        outline: none;
        position: sticky;
        top: 0;
        background-color: white;
    `;
    dropdownContainer.appendChild(searchInput);

    // Create dropdown items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'dropdown-items';
    dropdownContainer.appendChild(itemsContainer);

    // Event to toggle dropdown
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close all other open dropdowns first
        document.querySelectorAll('.dropdown-container').forEach(dc => {
            if (dc !== dropdownContainer) {
                dc.style.display = 'none';
            }
        });
        
        const isVisible = dropdownContainer.style.display === 'block';
        dropdownContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            searchInput.focus();
            // Load products if not already loaded
            if (itemsContainer.children.length === 0) {
                loadProducts();
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdownContainer.style.display = 'none';
    });

    // Prevent closing when clicking inside the dropdown
    dropdownContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Search functionality
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        Array.from(itemsContainer.children).forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Function to load products
    async function loadProducts() {
        try {
            // Show loading indicator
            itemsContainer.innerHTML = '<div class="dropdown-item loading">Loading...</div>';
            
            // Fetch products
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            
            const products = await response.json();
            
            // Clear loading
            itemsContainer.innerHTML = '';
            
            // Add products to dropdown
            products.forEach(product => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.setAttribute('data-value', product.id);
                item.setAttribute('data-price', product.price || 0);
                item.textContent = product.name;
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `;
                
                // Hover effect
                item.addEventListener('mouseover', () => {
                    item.style.backgroundColor = '#f0f0f0';
                });
                
                item.addEventListener('mouseout', () => {
                    item.style.backgroundColor = 'white';
                });
                
                // Selection
                item.addEventListener('click', () => {
                    const selectedText = item.textContent;
                    const selectedValue = item.getAttribute('data-value');
                    const selectedPrice = item.getAttribute('data-price');
                    
                    selectedDisplay.querySelector('.selected-text').textContent = selectedText;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    
                    // Update the original select
                    productSelect.value = selectedValue;
                    
                    // Update the price field in the row
                    const priceInput = parentContainer.querySelector('.product-price');
                    if (priceInput) {
                        priceInput.value = selectedPrice;
                        
                        // Trigger calculation
                        const qtyInput = parentContainer.querySelector('.product-quantity');
                        if (qtyInput) {
                            updateRowTotal(parentContainer);
                            updateOrderTotal();
                        }
                    }
                    
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    productSelect.dispatchEvent(event);
                    
                    // Hide dropdown
                    dropdownContainer.style.display = 'none';
                });
                
                itemsContainer.appendChild(item);
            });
            
            // Set selected value if provided
            if (selectedValue) {
                const selectedItem = Array.from(itemsContainer.children).find(
                    item => item.getAttribute('data-value') === selectedValue
                );
                
                if (selectedItem) {
                    selectedDisplay.querySelector('.selected-text').textContent = selectedItem.textContent;
                    selectedDisplay.setAttribute('data-value', selectedValue);
                    productSelect.value = selectedValue;
                }
            }
        } catch (error) {
            console.error('Error loading products:', error);
            itemsContainer.innerHTML = '<div class="dropdown-item error">Error loading products</div>';
        }
    }
}

// Update the showOrderForm function to use the new dropdowns
function showOrderForm(editableOrder = null) {
    // ... existing code ...
    
    // Populate dropdowns with enhanced functionality
    populateCustomersDropdown(editableOrder ? editableOrder.customerId : null);
    populateTransportersDropdown(editableOrder ? editableOrder.transporterId : null);
    
    // Setup product dropdowns for existing products
    const productRows = document.querySelectorAll('.product-row');
    productRows.forEach((row, index) => {
        const productSelect = row.querySelector('.product-select');
        const selectedProduct = editableOrder && editableOrder.products[index] 
            ? editableOrder.products[index].productId 
            : null;
        populateProductsDropdown(productSelect, selectedProduct);
    });
    
    // ... existing code ...
}

/**
 * Load and display the total cylinders owned by the company
 * This includes filled (F) + empty (E) cylinders in stock + cylinders with customers
 */
async function loadTotalCylinders() {
    try {
        // Fetch product data
        const productsResponse = await fetch('/api/products');
        if (!productsResponse.ok) throw new Error('Failed to fetch products data');
        const products = await productsResponse.json();
        
        // Fetch stock data
        const stockResponse = await fetch('/api/stock');
        if (!stockResponse.ok) throw new Error('Failed to fetch stock data');
        const stockData = await stockResponse.json();
        
        // Fetch customer accounts to get cylinder data
        const accountsResponse = await fetch('/api/accounts');
        if (!accountsResponse.ok) throw new Error('Failed to fetch accounts data');
        const accounts = await accountsResponse.json();
        
        // Fetch all sales data to calculate customer stock
        const salesResponse = await fetch('/api/sales');
        if (!salesResponse.ok) throw new Error('Failed to fetch sales data');
        const sales = await salesResponse.json();
        
        // Calculate customer stock for each product
        const customerStockMap = {};
        
        // Process each customer's sales to calculate their cylinder holdings
        accounts.forEach(account => {
            // Filter sales for this customer
            const customerSales = sales.filter(sale => sale.accountName === account.name);
            
            // Process each sale
            customerSales.forEach(sale => {
                // Handle multi-product sales
                if (sale.products && Array.isArray(sale.products) && sale.products.length > 0) {
                    // Process each product in the sale
                    sale.products.forEach(product => {
                        const productName = product.productName || 'Unknown';
                        if (!customerStockMap[productName]) {
                            customerStockMap[productName] = {
                                supplied: 0,
                                received: 0,
                                net: 0
                            };
                        }
                        
                        const supplyQty = parseInt(product.supplyQty) || 0;
                        const receivedQty = parseInt(product.receivedQty) || 0;
                        
                        customerStockMap[productName].supplied += supplyQty;
                        customerStockMap[productName].received += receivedQty;
                        customerStockMap[productName].net = customerStockMap[productName].supplied - customerStockMap[productName].received;
                    });
                } else if (sale.productName) {
                    // Handle single-product sales
                    const productName = sale.productName;
                    if (!customerStockMap[productName]) {
                        customerStockMap[productName] = {
                            supplied: 0,
                            received: 0,
                            net: 0
                        };
                    }
                    
                    const supplyQty = parseInt(sale.supplyQty) || 0;
                    const receivedQty = parseInt(sale.receivedQty) || 0;
                    
                    customerStockMap[productName].supplied += supplyQty;
                    customerStockMap[productName].received += receivedQty;
                    customerStockMap[productName].net = customerStockMap[productName].supplied - customerStockMap[productName].received;
                }
            });
        });
        
        // Combine stock data: F (filled) + E (empty) + customer stock
        const totalCylindersByProduct = {};
        let overallTotal = 0;
        
        // Process each product
        products.forEach(product => {
            const productName = product.name;
            const stockItem = stockData.find(item => item.productName === productName);
            
            // Get filled and empty stock from inventory
            const filledStock = stockItem ? parseInt(stockItem.filledStock || stockItem.fullStock || 0) : 0;
            const emptyStock = stockItem ? parseInt(stockItem.emptyStock || 0) : 0;
            
            // Get customer stock for this product
            const customerStock = customerStockMap[productName] ? customerStockMap[productName].net : 0;
            
            // Calculate total cylinders for this product
            const total = filledStock + emptyStock + customerStock;
            totalCylindersByProduct[productName] = {
                filled: filledStock,
                empty: emptyStock,
                customer: customerStock,
                total: total
            };
            
            overallTotal += total;
        });
        
        // Update UI with the data
        const container = document.querySelector('#total-cylinders .stat-content');
        if (!container) return;
        
        // Clear loading state
        container.innerHTML = '';
        
        // Add the total count
        const totalCountElement = document.createElement('div');
        totalCountElement.className = 'stat-value';
        totalCountElement.textContent = overallTotal;
        container.appendChild(totalCountElement);
        
        // Add the label
        const labelElement = document.createElement('div');
        labelElement.className = 'stat-label';
        labelElement.textContent = 'Total Cylinders';
        container.appendChild(labelElement);
        
        // Add detailed breakdown by product
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'inventory-details';
        
        // Sort products by total cylinders (highest first)
        const sortedProducts = Object.entries(totalCylindersByProduct)
            .sort(([, a], [, b]) => b.total - a.total);
        
        sortedProducts.forEach(([productName, data]) => {
            const detailItem = document.createElement('div');
            detailItem.className = 'inventory-detail';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'detail-label';
            labelSpan.textContent = `${productName}:`;
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'detail-value';
            valueSpan.textContent = `${data.total} (F:${data.filled} E:${data.empty} C:${data.customer})`;
            
            detailItem.appendChild(labelSpan);
            detailItem.appendChild(valueSpan);
            detailsContainer.appendChild(detailItem);
        });
        
        container.appendChild(detailsContainer);
        
    } catch (error) {
        console.error('Error loading total cylinders data:', error);
        showWidgetError('total-cylinders', error.message);
    }
}