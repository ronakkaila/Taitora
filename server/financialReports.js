/**
 * Financial Reports Utility Functions
 * This module contains functions to generate financial reports based on different periods
 */

const { getUserDatabase } = require('./database');
// const Queue = require('bull');
// const ReportModel = require('./models/report');

/**
 * Get transactions for a specific financial year
 * Financial year is from April 1st to March 31st of the next year
 * 
 * @param {string} username - The username whose database to query
 * @param {number} year - The starting year of the financial year (e.g., 2023 for FY 2023-2024)
 * @param {string} transactionType - Type of transactions to retrieve ('sales', 'purchases', 'all')
 * @returns {Promise<Array>} - A promise that resolves to an array of transactions
 */
async function getFinancialYearTransactions(username, year, transactionType = 'all') {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate input
            if (!username) {
                return reject(new Error('Username is required'));
            }
            
            if (!year || isNaN(parseInt(year))) {
                return reject(new Error('Valid year is required'));
            }
            
            // Parse year as integer
            const startYear = parseInt(year);
            const endYear = startYear + 1;
            
            // Financial year: April 1st to March 31st
            const startDate = `${startYear}-04-01`;
            const endDate = `${endYear}-03-31`;
            
            // Get the user's database
            const { userDb } = await getUserDatabase(username);
            
            // Create an array to store all promises for database queries
            const queryPromises = [];
            
            // Function to create a promise for each database query
            const createQueryPromise = (tableName) => {
                return new Promise((resolveQuery, rejectQuery) => {
                    userDb.all(
                        `SELECT *, '${tableName}' as transaction_type FROM ${tableName} 
                         WHERE date >= ? AND date <= ? 
                         ORDER BY date ASC`,
                        [startDate, endDate],
                        (err, rows) => {
                            if (err) return rejectQuery(err);
                            resolveQuery(rows);
                        }
                    );
                });
            };
            
            // Add queries based on the transaction type requested
            if (transactionType === 'all' || transactionType === 'sales') {
                queryPromises.push(createQueryPromise('sales'));
            }
            
            if (transactionType === 'all' || transactionType === 'purchases') {
                queryPromises.push(createQueryPromise('purchases'));
            }
            
            // Execute all queries and combine results
            Promise.all(queryPromises)
                .then(results => {
                    // Flatten the results array
                    const allTransactions = results.flat();
                    
                    // Sort by date
                    allTransactions.sort((a, b) => {
                        return new Date(a.date) - new Date(b.date);
                    });
                    
                    resolve({
                        financialYear: `${startYear}-${endYear}`,
                        period: {
                            start: startDate,
                            end: endDate
                        },
                        transactions: allTransactions
                    });
                })
                .catch(error => {
                    reject(error);
                });
                
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get financial summary for a specific financial year
 * 
 * @param {string} username - The username whose database to query
 * @param {number} year - The starting year of the financial year
 * @returns {Promise<Object>} - A promise that resolves to a financial summary object
 */
async function getFinancialYearSummary(username, year) {
    try {
        // Get all transactions for the financial year
        const result = await getFinancialYearTransactions(username, year, 'all');
        const transactions = result.transactions;
        
        // Initialize summary object
        const summary = {
            financialYear: result.financialYear,
            period: result.period,
            sales: {
                totalCount: 0,
                totalAmount: 0,
                byPaymentMethod: {
                    cash: 0,
                    credit: 0
                }
            },
            purchases: {
                totalCount: 0,
                totalAmount: 0,
                byPaymentMethod: {
                    cash: 0,
                    credit: 0
                }
            },
            transport: {
                totalFare: 0
            },
            products: {}, // Will track by product name
            months: {} // Will track by month
        };
        
        // Process each transaction
        transactions.forEach(transaction => {
            const transactionType = transaction.transaction_type;
            const amount = calculateTransactionAmount(transaction);
            const monthKey = transaction.date.substring(0, 7); // Format: "YYYY-MM"
            
            // Increment counters based on transaction type
            if (transactionType === 'sales') {
                summary.sales.totalCount++;
                summary.sales.totalAmount += amount;
                
                // Count by payment method
                const paymentMethod = transaction.paymentOption || 'cash';
                summary.sales.byPaymentMethod[paymentMethod] = 
                    (summary.sales.byPaymentMethod[paymentMethod] || 0) + amount;
                
            } else if (transactionType === 'purchases') {
                summary.purchases.totalCount++;
                summary.purchases.totalAmount += amount;
                
                // Count by payment method
                const paymentMethod = transaction.paymentOption || 'cash';
                summary.purchases.byPaymentMethod[paymentMethod] = 
                    (summary.purchases.byPaymentMethod[paymentMethod] || 0) + amount;
            }
            
            // Add transport fare from both sales and purchases
            if (transaction.transporterFare) {
                summary.transport.totalFare += parseFloat(transaction.transporterFare);
            }
            
            // Track by product
            if (transaction.productName) {
                if (!summary.products[transaction.productName]) {
                    summary.products[transaction.productName] = {
                        sales: 0,
                        purchases: 0,
                        salesCount: 0,
                        purchasesCount: 0
                    };
                }
                
                summary.products[transaction.productName][`${transactionType}Count`]++;
                summary.products[transaction.productName][transactionType] += amount;
            }
            
            // Track by month
            if (!summary.months[monthKey]) {
                summary.months[monthKey] = {
                    sales: 0,
                    purchases: 0,
                    salesCount: 0,
                    purchasesCount: 0
                };
            }
            
            summary.months[monthKey][`${transactionType}Count`]++;
            summary.months[monthKey][transactionType] += amount;
        });
        
        // Calculate profit/loss
        summary.profitLoss = summary.sales.totalAmount - summary.purchases.totalAmount;
        
        return summary;
        
    } catch (error) {
        throw error;
    }
}

/**
 * Helper function to calculate the transaction amount
 * This is a placeholder - you'll need to adjust based on your actual transaction structure
 * 
 * @param {Object} transaction - The transaction object
 * @returns {number} - The calculated amount
 */
function calculateTransactionAmount(transaction) {
    // This is a placeholder - implement your own logic based on your database schema
    // For example, if you have a 'totalAmount' field, use that:
    if (transaction.totalAmount) {
        return parseFloat(transaction.totalAmount);
    }
    
    // Otherwise, you might need to calculate based on quantities and rates
    // This is just an example; adjust as needed
    const quantity = transaction.supplyQty || 0;
    const rate = 1; // You may need to retrieve the rate from another table
    
    return quantity * rate;
}

/* 
// Commented out Bull queue implementation to fix the module not found error
// Add job queue for processing financial reports
const reportQueue = new Queue('financial-reports', process.env.REDIS_URL);

// Instead of synchronous processing
exports.generateReport = async (req, res) => {
  const { userId, reportType, dateRange } = req.body;
  
  // Add job to queue instead of processing immediately
  const job = await reportQueue.add({
    userId,
    reportType,
    dateRange,
    createdAt: new Date()
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });
  
  res.json({ jobId: job.id, status: 'processing' });
};
*/

// Synchronous version of report generation
function generateReport(req, res) {
  const { userId, reportType, dateRange } = req.body;
  
  try {
    // Process report synchronously
    const reportData = processReport(userId, reportType, dateRange);
    res.json({ status: 'completed', data: reportData });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}

// Helper function to process reports
function processReport(userId, reportType, dateRange) {
  // Implementation depends on your existing logic
  // This is a placeholder function
  return { 
    userId, 
    reportType, 
    dateRange, 
    generatedAt: new Date(),
    // Add actual report data here
  };
}

// Export the core reporting functions
module.exports = {
  getFinancialYearTransactions,
  getFinancialYearSummary,
  calculateTransactionAmount,
  generateReport
}; 