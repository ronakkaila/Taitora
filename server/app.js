const express = require('express');
const path = require('path');
const { 
    authDb, 
    getUserDatabase, 
    createUserDatabase,
    migrateUserData,
    getFinancialYears,
    getCurrentFinancialYear,
    getAllUserDatabases,
    backupUserDatabases
} = require('./database');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const { getFinancialYearTransactions, getFinancialYearSummary } = require('./financialReports');
const rateLimit = require('express-rate-limit');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed for Render deployment)
app.set('trust proxy', 1);

// Add rate limiting
const apiLimiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // Default 15 minutes in milliseconds
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // Default limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiter to all API endpoints
app.use('/api/', apiLimiter);

// Email configuration
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Configure multer for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // If we have a user in session, store in their directory
        if (req.session && req.session.username) {
            const userDir = path.join(__dirname, 'user_databases', req.session.username);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            cb(null, userDir);
        } else {
            // Fallback to uploads directory
            const uploadDir = process.env.UPLOAD_DIR || './uploads';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        }
    },
    filename: function (req, file, cb) {
        const username = req.session && req.session.username ? req.session.username : 'guest';
        cb(null, `restore_${username}_${Date.now()}.db`);
    }
});
const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Add debugging logs
console.log('Starting application...');

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE === 'true',
        maxAge: parseInt(process.env.SESSION_DURATION) || 30 * 60 * 1000, // Default: 30 minutes
        httpOnly: true
    },
    store: process.env.NODE_ENV === 'production' ? 
        new SQLiteStore({
            dir: sessionsDir,
            db: 'sessions.db'
        }) : undefined
}));

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - User: ${req.session.username || 'Guest'}`);
    next();
});

// Database connection check
authDb.get("SELECT 1", [], (err) => {
    if (err) {
        console.error('Auth database connection error:', err);
    } else {
        console.log('Auth database connected successfully');
    }
});

// Add test data endpoint
app.get('/api/seed-test-data', (req, res) => {
    console.log('Seed test data endpoint called');
    // Check if test account already exists
    authDb.get("SELECT * FROM users WHERE username = 'Test Customer'", [], (err, account) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (account) {
            return res.json({ message: 'Test account already exists', account });
        }
        
        // Add test account
        const testAccount = {
            name: 'Test Customer',
            address: '123 Test Street, Test City',
            mobile: '9876543210',
            email: 'test@example.com',
            details: 'This is a test customer account created for demonstration purposes.'
        };
        
        authDb.run(
            'INSERT INTO users (username, address, mobile, email, details) VALUES (?, ?, ?, ?, ?)',
            [testAccount.name, testAccount.address, testAccount.mobile, testAccount.email, testAccount.details],
            function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: 'Failed to create test account' });
                }
                
                testAccount.id = this.lastID;
                
                // Add some test product rates for this customer
                const products = ['Oxygen', 'Nitrogen', 'Argon', 'Carbon Dioxide', 'Helium'];
                const ratePromises = [];
                
                products.forEach((product, index) => {
                    const productRate = (index + 1) * 100;
                    const emptyRate = (index + 1) * 10;
                    
                    ratePromises.push(
                        new Promise((resolve, reject) => {
                            authDb.run(
                                'INSERT INTO customer_rates (customer_name, product_name, rate, empty_rate) VALUES (?, ?, ?, ?)',
                                [testAccount.name, product, productRate, emptyRate],
                                function(err) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve();
                                    }
                                }
                            );
                        })
                    );
                });
                
                // Add test products if they don't exist
                const productPromises = [];
                products.forEach((product, index) => {
                    productPromises.push(
                        new Promise((resolve, reject) => {
                            authDb.get('SELECT * FROM customer_rates WHERE customer_name = ? AND product_name = ?', [testAccount.name, product], (err, existingRate) => {
                                if (err) {
                                    reject(err);
                                } else if (existingRate) {
                                    resolve();
                                } else {
                                    authDb.run(
                                        'INSERT INTO customer_rates (customer_name, product_name, rate, empty_rate) VALUES (?, ?, ?, ?)',
                                        [testAccount.name, product, (index + 1) * 100, (index + 1) * 10],
                                        function(err) {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve();
                                            }
                                        }
                                    );
                                }
                            });
                        })
                    );
                });
                
                // Wait for all promises to resolve
                Promise.all([...ratePromises, ...productPromises])
                    .then(() => {
                        res.json({ 
                            message: 'Test data created successfully', 
                            account: testAccount,
                            products
                        });
                    })
                    .catch(error => {
                        console.error('Error creating test data:', error);
                        res.status(500).json({ error: 'Failed to create complete test data' });
                    });
            }
        );
    });
});

// API Routes begin here
// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/signup.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Serve user dashboard page
app.get('/user-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pages/user-dashboard.html'));
});

// User Routes
app.post('/api/register', (req, res) => {
    const { username, password, company_name, phone, email, address } = req.body;
    
    // Validate input
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Username, password, and email are required' });
    }
    
    // Begin a transaction to ensure consistency
    authDb.serialize(() => {
        authDb.run('BEGIN TRANSACTION');
        
        // First, check if the user already exists
        authDb.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, existingUser) => {
            if (err) {
                authDb.run('ROLLBACK');
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Database error occurred' });
            }
            
            if (existingUser) {
                authDb.run('ROLLBACK');
                const field = existingUser.username === username ? 'Username' : 'Email';
                return res.status(409).json({ error: `${field} already exists` });
            }
            
            // Hash the password with bcrypt
            const bcrypt = require('bcryptjs');
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) {
                    authDb.run('ROLLBACK');
                    console.error('Password hashing error:', err);
                    return res.status(500).json({ error: 'Error creating account' });
                }
                
                // Insert new user with hashed password
                authDb.run(
                    'INSERT INTO users (username, password, company_name, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
                    [username, hashedPassword, company_name, phone, email, address],
                    function(err) {
                        if (err) {
                            authDb.run('ROLLBACK');
                            console.error('Database insert error:', err.message);
                            return res.status(500).json({ error: 'Failed to create account' });
                        }
                        
                        const userId = this.lastID;
                        
                        // Create user directory
                        const userDir = path.join(__dirname, 'user_databases', username);
                        if (!fs.existsSync(userDir)) {
                            fs.mkdirSync(userDir, { recursive: true });
                            console.log(`Created user directory for ${username} at ${userDir}`);
                        }
                        
                        // Update user record with directory path
                        authDb.run(
                            'UPDATE users SET user_dir = ? WHERE username = ?',
                            [userDir, username],
                            (err) => {
                                if (err) {
                                    authDb.run('ROLLBACK');
                                    console.error('Error updating user directory:', err.message);
                                    return res.status(500).json({ error: 'Failed to create account' });
                                }
                                
                                authDb.run('COMMIT');
                                
                                // Create financial year database
                                createFinancialYearDatabase(username, userDir)
                                    .then(() => {
                                        res.status(201).json({ 
                                            success: true, 
                                            message: 'Account created successfully' 
                                        });
                                    })
                                    .catch(err => {
                                        console.error('Error creating financial year database:', err);
                                        res.status(201).json({ 
                                            success: true, 
                                            message: 'Account created successfully, but there was an error setting up user data'
                                        });
                                    });
                            }
                        );
                    }
                );
            });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // First, find the user by username only
    authDb.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Now check the password using bcrypt
        const bcrypt = require('bcryptjs');
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Password comparison error:', err);
                return res.status(500).json({ error: 'Authentication error' });
            }
            
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Set user in session
            req.session.userId = user.id;
            req.session.username = user.username;
            
            // Save session explicitly to ensure it's stored before response
            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Session error occurred' });
                }
                
                // Remove sensitive data from user object
                delete user.password;
                
                // Log successful login
                console.log(`User ${username} logged in successfully`);
                
                res.json({ 
                    success: true, 
                    user,
                    redirectTo: '/pages/user-dashboard.html'
                });
            });
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Middleware to get user database and attach to request
function withUserDb(req, res, next) {
    // Check if we have a valid user in session
    if (!req.session || !req.session.userId || !req.session.username) {
        console.error('No valid user session found in withUserDb middleware');
        return res.status(401).json({ error: 'Unauthorized - session invalid' });
    }
    
    // Get the requested financial year ID from query params, body, or use current
    const financialYearId = req.query.financialYearId || req.body.financialYearId || null;
    
    // Get a database connection for the user's current financial year
    getUserDatabase(req.session.username, financialYearId)
        .then(async (userDb) => {
            req.userDb = userDb;
            
            // Check if the required tables exist, create them if they don't
            try {
                // Check for products table
                const productTableExists = await new Promise((resolve) => {
                    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'", [], (err, result) => {
                        resolve(!!result);
                    });
                });
                
                if (!productTableExists) {
                    console.log(`Products table does not exist for user: ${req.session.username}, creating it now...`);
                    await new Promise((resolve, reject) => {
                        userDb.run(`CREATE TABLE IF NOT EXISTS products (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            description TEXT,
                            fullStock INTEGER DEFAULT 0,
                            emptyStock INTEGER DEFAULT 0
                        )`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
                
                // Check for sales table
                const salesTableExists = await new Promise((resolve) => {
                    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, result) => {
                        resolve(!!result);
                    });
                });
                
                if (!salesTableExists) {
                    console.log(`Sales table does not exist for user: ${req.session.username}, creating it now...`);
                    await new Promise((resolve, reject) => {
                        userDb.run(`CREATE TABLE IF NOT EXISTS sales (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            invoiceNo TEXT NOT NULL,
                            date TEXT NOT NULL,
                            accountName TEXT NOT NULL,
                            shipToAddress TEXT,
                            productName TEXT NOT NULL,
                            supplyQty INTEGER,
                            receivedQty INTEGER,
                            transporterName TEXT,
                            transporterFare REAL,
                            paymentOption TEXT,
                            remark TEXT,
                            container TEXT,
                            financial_year_id TEXT
                        )`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } else {
                    // Check if financial_year_id column exists in sales table
                    const salesFinancialYearColumnExists = await new Promise((resolve) => {
                        userDb.all("PRAGMA table_info(sales)", [], (err, columns) => {
                            if (err) {
                                console.error('Error checking sales table columns:', err);
                                resolve(false);
                            } else {
                                const hasColumn = Array.isArray(columns) && columns.some(col => col.name === 'financial_year_id');
                                resolve(hasColumn);
                            }
                        });
                    });
                    
                    // Add financial_year_id column if it doesn't exist
                    if (!salesFinancialYearColumnExists) {
                        console.log(`Adding financial_year_id column to sales table for user: ${req.session.username}`);
                        await new Promise((resolve, reject) => {
                            userDb.run(`ALTER TABLE sales ADD COLUMN financial_year_id TEXT`, (err) => {
                                if (err) {
                                    console.error('Error adding financial_year_id column to sales:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }
                }
                
                // Check for purchases table
                const purchasesTableExists = await new Promise((resolve) => {
                    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='purchases'", [], (err, result) => {
                        resolve(!!result);
                    });
                });
                
                if (!purchasesTableExists) {
                    console.log(`Purchases table does not exist for user: ${req.session.username}, creating it now...`);
                    await new Promise((resolve, reject) => {
                        userDb.run(`CREATE TABLE IF NOT EXISTS purchases (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            invoiceNo TEXT NOT NULL,
                            date TEXT NOT NULL,
                            accountName TEXT NOT NULL,
                            shipToAddress TEXT,
                            productName TEXT NOT NULL,
                            supplyQty INTEGER,
                            receivedQty INTEGER,
                            transporterName TEXT,
                            transporterFare REAL,
                            paymentOption TEXT,
                            remark TEXT,
                            container TEXT,
                            financial_year_id TEXT
                        )`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } else {
                    // Check if financial_year_id column exists in purchases table
                    const purchasesFinancialYearColumnExists = await new Promise((resolve) => {
                        userDb.all("PRAGMA table_info(purchases)", [], (err, columns) => {
                            if (err) {
                                console.error('Error checking purchases table columns:', err);
                                resolve(false);
                            } else {
                                const hasColumn = Array.isArray(columns) && columns.some(col => col.name === 'financial_year_id');
                                resolve(hasColumn);
                            }
                        });
                    });
                    
                    // Add financial_year_id column if it doesn't exist
                    if (!purchasesFinancialYearColumnExists) {
                        console.log(`Adding financial_year_id column to purchases table for user: ${req.session.username}`);
                        await new Promise((resolve, reject) => {
                            userDb.run(`ALTER TABLE purchases ADD COLUMN financial_year_id TEXT`, (err) => {
                                if (err) {
                                    console.error('Error adding financial_year_id column to purchases:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }
                }
                
                // Check for accounts table
                const accountsTableExists = await new Promise((resolve) => {
                    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'", [], (err, result) => {
                        resolve(!!result);
                    });
                });
                
                if (!accountsTableExists) {
                    console.log(`Accounts table does not exist for user: ${req.session.username}, creating it now...`);
                    await new Promise((resolve, reject) => {
                        userDb.run(`CREATE TABLE IF NOT EXISTS accounts (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            mobile TEXT,
                            email TEXT,
                            address TEXT,
                            details TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
                
                // Check for invoice_counters table
                const countersTableExists = await new Promise((resolve) => {
                    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_counters'", [], (err, result) => {
                        resolve(!!result);
                    });
                });
                
                if (!countersTableExists) {
                    console.log(`Invoice counters table does not exist for user: ${req.session.username}, creating it now...`);
                    await new Promise((resolve, reject) => {
                        userDb.run(`CREATE TABLE IF NOT EXISTS invoice_counters (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            sales_counter INTEGER DEFAULT 1,
                            purchase_counter INTEGER DEFAULT 1
                        )`, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                // Insert default counter values
                                userDb.run('INSERT INTO invoice_counters (sales_counter, purchase_counter) VALUES (1, 1)', (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            }
                        });
                    });
                }
                
                // Continue with the request
                next();
            } catch (error) {
                console.error('Error checking/creating tables:', error);
                next(); // Continue anyway to prevent blocking requests
            }
        })
        .catch(error => {
            console.error('Error getting user database:', error);
            res.status(500).json({ error: 'Database connection error' });
        });
}

// User profile and dashboard
app.get('/api/user/profile', isAuthenticated, (req, res) => {
    const query = `SELECT id, username, company_name, phone, email, address FROM users WHERE id = ?`;
    authDb.get(query, [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    });
});

// Dashboard data (summary of user's data)
app.get('/api/user/dashboard', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Get summary of user's data (count of products, sales, purchases)
    Promise.all([
        new Promise((resolve, reject) => {
            userDb.get('SELECT COUNT(*) as count FROM products', [], (err, result) => {
                if (err) reject(err);
                else resolve(result ? result.count : 0);
            });
        }),
        new Promise((resolve, reject) => {
            userDb.get('SELECT COUNT(*) as count FROM sales', [], (err, result) => {
                if (err) reject(err);
                else resolve(result ? result.count : 0);
            });
        }),
        new Promise((resolve, reject) => {
            userDb.get('SELECT COUNT(*) as count FROM purchases', [], (err, result) => {
                if (err) reject(err);
                else resolve(result ? result.count : 0);
            });
        })
    ])
    .then(([productCount, salesCount, purchasesCount]) => {
        res.json({
            productCount,
            salesCount,
            purchasesCount,
            username: req.session.username
        });
    })
    .catch(err => {
        console.error('Error getting dashboard data:', err);
        res.status(500).json({ error: 'Database error' });
    })
    .finally(() => {
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Product Routes - updated to use user-specific database
app.post('/api/products', isAuthenticated, withUserDb, (req, res) => {
    const { name, description, fullStock, emptyStock } = req.body;
    const userDb = req.userDb;
    
    // Check if a product with the same name already exists
    userDb.get('SELECT id FROM products WHERE LOWER(name) = LOWER(?)', [name], (err, existingProduct) => {
        if (err) {
            console.error('Error checking for duplicate product:', err);
            return res.status(500).json({ error: 'Failed to check for duplicate product' });
        }
        
        if (existingProduct) {
            return res.status(409).json({ error: 'A product with this name already exists' });
        }
        
        // First check if the fullStock column exists
        userDb.all(`PRAGMA table_info(products)`, [], (err, columns) => {
            if (err) {
                console.error('Error checking products table schema:', err);
                return res.status(500).json({ error: 'Failed to check product schema' });
            }
            
            const columnNames = columns.map(col => col.name);
            const hasFullStock = columnNames.includes('fullStock');
            const hasEmptyStock = columnNames.includes('emptyStock');
            
            if (hasFullStock && hasEmptyStock) {
                // New schema
                userDb.run(
                    'INSERT INTO products (name, description, fullStock, emptyStock) VALUES (?, ?, ?, ?)', 
                    [name, description, fullStock || 0, emptyStock || 0], 
                    function(err) {
                        if (err) {
                            console.error('Error creating product:', err);
                            return res.status(500).json({ error: 'Failed to create product' });
                        }
                        
                        const productId = this.lastID;
                        
                        // Create a stock movement record for the opening stock
                        userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            date TEXT NOT NULL,
                            productName TEXT NOT NULL,
                            filledStock INTEGER DEFAULT 0,
                            emptyStock INTEGER DEFAULT 0,
                            filledReceived INTEGER DEFAULT 0,
                            filledSupplied INTEGER DEFAULT 0,
                            emptyReceived INTEGER DEFAULT 0,
                            emptySupplied INTEGER DEFAULT 0,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )`, (err) => {
                            if (err) {
                                console.error('Error creating stock movements table:', err);
                                return res.json({ id: productId, name, description, fullStock: fullStock || 0, emptyStock: emptyStock || 0 });
                            }
                            
                            // Add opening stock record
                            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                            
                            userDb.run(`
                                INSERT INTO stock_movements (
                                    date,
                                    productName,
                                    filledStock,
                                    emptyStock,
                                    filledReceived,
                                    filledSupplied,
                                    emptyReceived,
                                    emptySupplied
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [today, name, fullStock || 0, emptyStock || 0, fullStock || 0, 0, emptyStock || 0, 0],
                                (err) => {
                                    if (err) {
                                        console.error('Error creating stock movement record:', err);
                                    }
                                    
                                    res.json({ 
                                        id: productId, 
                                        name, 
                                        description, 
                                        fullStock: fullStock || 0, 
                                        emptyStock: emptyStock || 0 
                                    });
                                }
                            );
                        });
                    }
                );
            } else {
                // Old schema with openingStock or minimal columns
                const hasOpeningStock = columnNames.includes('openingStock');
                
                if (hasOpeningStock) {
                    userDb.run(
                        'INSERT INTO products (name, description, openingStock) VALUES (?, ?, ?)', 
                        [name, description, fullStock || 0], 
                        function(err) {
                            if (err) {
                                console.error('Error creating product with old schema:', err);
                                return res.status(500).json({ error: 'Failed to create product' });
                            }
                            
                            const productId = this.lastID;
                            
                            // Create a stock movement record for the opening stock
                            userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                date TEXT NOT NULL,
                                productName TEXT NOT NULL,
                                filledStock INTEGER DEFAULT 0,
                                emptyStock INTEGER DEFAULT 0,
                                filledReceived INTEGER DEFAULT 0,
                                filledSupplied INTEGER DEFAULT 0,
                                emptyReceived INTEGER DEFAULT 0,
                                emptySupplied INTEGER DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )`, (err) => {
                                if (err) {
                                    console.error('Error creating stock movements table:', err);
                                    return res.json({ id: productId, name, description, openingStock: fullStock || 0 });
                                }
                                
                                // Add opening stock record
                                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                                
                                userDb.run(`
                                    INSERT INTO stock_movements (
                                        date,
                                        productName,
                                        filledStock,
                                        emptyStock,
                                        filledReceived,
                                        filledSupplied,
                                        emptyReceived,
                                        emptySupplied
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [today, name, fullStock || 0, emptyStock || 0, fullStock || 0, 0, emptyStock || 0, 0],
                                    (err) => {
                                        if (err) {
                                            console.error('Error creating stock movement record:', err);
                                        }
                                        
                                        res.json({ 
                                            id: productId, 
                                            name, 
                                            description, 
                                            openingStock: fullStock || 0 
                                        });
                                    }
                                );
                            });
                        }
                    );
                } else {
                    // No stock columns at all
                    userDb.run(
                        'INSERT INTO products (name, description) VALUES (?, ?)', 
                        [name, description], 
                        function(err) {
                            if (err) {
                                console.error('Error creating product with minimal schema:', err);
                                return res.status(500).json({ error: 'Failed to create product' });
                            }
                            res.json({ id: this.lastID, name, description });
                        }
                    );
                }
            }
        });
    });
});

app.get('/api/products', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    userDb.all('SELECT * FROM products', [], (err, products) => {
        if (err) {
            // Only log error type, not the full stack trace
            console.log(`Error fetching products for user ${req.session.username}: ${err.code}`);
            return res.json([]); // Return empty array instead of error to avoid disrupting UI
        }
        
        res.json(products || []);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Product Routes - updated to use user-specific database
app.get('/api/products/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `SELECT * FROM products WHERE id = ?`;
    userDb.get(query, [req.params.id], (err, product) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.put('/api/products/:id', isAuthenticated, withUserDb, (req, res) => {
    const { name, description, fullStock, emptyStock } = req.body;
    const productId = req.params.id;
    const userDb = req.userDb;
    
    // Check if a product with the same name already exists (excluding this product)
    userDb.get('SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id != ?', [name, productId], (err, existingProduct) => {
        if (err) {
            console.error('Error checking for duplicate product:', err);
            return res.status(500).json({ error: 'Failed to check for duplicate product' });
        }
        
        if (existingProduct) {
            return res.status(409).json({ error: 'Another product with this name already exists' });
        }
        
        // First get the current product to compare values
        userDb.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
            if (err) {
                console.error('Error fetching product:', err);
                return res.status(500).json({ error: 'Failed to fetch product' });
            }
            
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            
            const oldName = product.name;
            
            // Check if the fullStock column exists
            userDb.all(`PRAGMA table_info(products)`, [], (err, columns) => {
                if (err) {
                    console.error('Error checking products table schema:', err);
                    return res.status(500).json({ error: 'Failed to check product schema' });
                }
                
                const columnNames = columns.map(col => col.name);
                const hasFullStock = columnNames.includes('fullStock');
                const hasEmptyStock = columnNames.includes('emptyStock');
                
                if (hasFullStock && hasEmptyStock) {
                    // New schema
                    userDb.run(
                        'UPDATE products SET name = ?, description = ?, fullStock = ?, emptyStock = ? WHERE id = ?', 
                        [name, description, fullStock || 0, emptyStock || 0, productId], 
                        function(err) {
                            if (err) {
                                console.error('Error updating product:', err);
                                return res.status(500).json({ error: 'Failed to update product' });
                            }
                            
                            if (this.changes === 0) {
                                return res.status(404).json({ error: 'Product not found' });
                            }
                            
                            // Check if fullStock or emptyStock values have changed
                            const oldFullStock = product.fullStock || 0;
                            const oldEmptyStock = product.emptyStock || 0;
                            const newFullStock = fullStock || 0;
                            const newEmptyStock = emptyStock || 0;
                            
                            // If stock values have changed, update the stock movements table
                            if (oldFullStock !== newFullStock || oldEmptyStock !== newEmptyStock) {
                                // Ensure the stock_movements table exists
                                userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    date TEXT NOT NULL,
                                    productName TEXT NOT NULL,
                                    filledStock INTEGER DEFAULT 0,
                                    emptyStock INTEGER DEFAULT 0,
                                    filledReceived INTEGER DEFAULT 0,
                                    filledSupplied INTEGER DEFAULT 0,
                                    emptyReceived INTEGER DEFAULT 0,
                                    emptySupplied INTEGER DEFAULT 0,
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                                )`, (err) => {
                                    if (err) {
                                        console.error('Error creating stock movements table:', err);
                                        return res.json({ id: productId, name, description, fullStock: newFullStock, emptyStock: newEmptyStock });
                                    }
                                    
                                    // Add updated stock record
                                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                                    
                                    // Calculate the differences for received values
                                    const filledReceived = newFullStock > oldFullStock ? newFullStock - oldFullStock : 0;
                                    const emptyReceived = newEmptyStock > oldEmptyStock ? newEmptyStock - oldEmptyStock : 0;
                                    
                                    userDb.run(`
                                        INSERT INTO stock_movements (
                                            date,
                                            productName,
                                            filledStock,
                                            emptyStock,
                                            filledReceived,
                                            filledSupplied,
                                            emptyReceived,
                                            emptySupplied
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                        [today, name, newFullStock, newEmptyStock, filledReceived, 0, emptyReceived, 0],
                                        (err) => {
                                            if (err) {
                                                console.error('Error creating stock movement record:', err);
                                            }
                                            
                                            // If the product name changed, update all previous stock movement records
                                            if (oldName !== name) {
                                                userDb.run(
                                                    'UPDATE stock_movements SET productName = ? WHERE productName = ?',
                                                    [name, oldName],
                                                    (err) => {
                                                        if (err) {
                                                            console.error('Error updating stock movement records with new product name:', err);
                                                        }
                                                    }
                                                );
                                            }
                                            
                                            res.json({ 
                                                id: productId, 
                                                name, 
                                                description, 
                                                fullStock: newFullStock, 
                                                emptyStock: newEmptyStock 
                                            });
                                        }
                                    );
                                });
                            } else {
                                // If only the name or description changed, but not stock values
                                if (oldName !== name) {
                                    // Update all previous stock movement records with the new name
                                    userDb.run(
                                        'UPDATE stock_movements SET productName = ? WHERE productName = ?',
                                        [name, oldName],
                                        (err) => {
                                            if (err) {
                                                console.error('Error updating stock movement records with new product name:', err);
                                            }
                                        }
                                    );
                                }
                                
                                res.json({ 
                                    id: productId, 
                                    name, 
                                    description, 
                                    fullStock: newFullStock, 
                                    emptyStock: newEmptyStock 
                                });
                            }
                        }
                    );
                } else {
                    // Old schema with openingStock or no stock columns
                    const hasOpeningStock = columnNames.includes('openingStock');
                    
                    if (hasOpeningStock) {
                        userDb.run(
                            'UPDATE products SET name = ?, description = ?, openingStock = ? WHERE id = ?', 
                            [name, description, fullStock || 0, productId], 
                            function(err) {
                                if (err) {
                                    console.error('Error updating product with old schema:', err);
                                    return res.status(500).json({ error: 'Failed to update product' });
                                }
                                
                                if (this.changes === 0) {
                                    return res.status(404).json({ error: 'Product not found' });
                                }
                                
                                // Get old opening stock value
                                const oldOpeningStock = product.openingStock || 0;
                                const newOpeningStock = fullStock || 0;
                                
                                // If openingStock value has changed, update the stock movements table
                                if (oldOpeningStock !== newOpeningStock) {
                                    // Ensure the stock_movements table exists
                                    userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        date TEXT NOT NULL,
                                        productName TEXT NOT NULL,
                                        filledStock INTEGER DEFAULT 0,
                                        emptyStock INTEGER DEFAULT 0,
                                        filledReceived INTEGER DEFAULT 0,
                                        filledSupplied INTEGER DEFAULT 0,
                                        emptyReceived INTEGER DEFAULT 0,
                                        emptySupplied INTEGER DEFAULT 0,
                                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                                    )`, (err) => {
                                        if (err) {
                                            console.error('Error creating stock movements table:', err);
                                            return res.json({ id: productId, name, description, openingStock: newOpeningStock });
                                        }
                                        
                                        // Add updated stock record
                                        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                                        
                                        // Calculate the differences for received values
                                        const filledReceived = newOpeningStock > oldOpeningStock ? newOpeningStock - oldOpeningStock : 0;
                                        
                                        userDb.run(`
                                            INSERT INTO stock_movements (
                                                date,
                                                productName,
                                                filledStock,
                                                emptyStock,
                                                filledReceived,
                                                filledSupplied,
                                                emptyReceived,
                                                emptySupplied
                                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                            [today, name, newOpeningStock, emptyStock || 0, filledReceived, 0, emptyStock || 0, 0],
                                            (err) => {
                                                if (err) {
                                                    console.error('Error creating stock movement record:', err);
                                                }
                                                
                                                // If the product name changed, update all previous stock movement records
                                                if (oldName !== name) {
                                                    userDb.run(
                                                        'UPDATE stock_movements SET productName = ? WHERE productName = ?',
                                                        [name, oldName],
                                                        (err) => {
                                                            if (err) {
                                                                console.error('Error updating stock movement records with new product name:', err);
                                                            }
                                                        }
                                                    );
                                                }
                                                
                                                res.json({ id: productId, name, description, openingStock: newOpeningStock });
                                            }
                                        );
                                    });
                                } else {
                                    // If only the name or description changed, but not stock values
                                    if (oldName !== name) {
                                        // Update all previous stock movement records with the new name
                                        userDb.run(
                                            'UPDATE stock_movements SET productName = ? WHERE productName = ?',
                                            [name, oldName],
                                            (err) => {
                                                if (err) {
                                                    console.error('Error updating stock movement records with new product name:', err);
                                                }
                                            }
                                        );
                                    }
                                    
                                    res.json({ id: productId, name, description, openingStock: newOpeningStock });
                                }
                            }
                        );
                    } else {
                        // No stock columns at all
                        userDb.run(
                            'UPDATE products SET name = ?, description = ? WHERE id = ?', 
                            [name, description, productId], 
                            function(err) {
                                if (err) {
                                    console.error('Error updating product with minimal schema:', err);
                                    return res.status(500).json({ error: 'Failed to update product' });
                                }
                                
                                if (this.changes === 0) {
                                    return res.status(404).json({ error: 'Product not found' });
                                }
                                
                                res.json({ id: productId, name, description });
                            }
                        );
                    }
                }
            });
        });
    });
});

app.delete('/api/products/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `DELETE FROM products WHERE id = ?`;
    userDb.run(query, [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ changes: this.changes });
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Account Routes
app.post('/api/accounts', isAuthenticated, withUserDb, (req, res) => {
    const { name, address, mobile, email } = req.body;
    const userDb = req.userDb;
    
    // Check if an account with the same name already exists
    userDb.get('SELECT id FROM accounts WHERE LOWER(name) = LOWER(?)', [name], (err, existingAccount) => {
        if (err) {
            console.error('Error checking for duplicate account:', err);
            return res.status(500).json({ error: 'Failed to check for duplicate account' });
        }
        
        if (existingAccount) {
            return res.status(409).json({ error: 'An account with this name already exists' });
        }
        
        userDb.run(
            'INSERT INTO accounts (name, address, mobile, email) VALUES (?, ?, ?, ?)',
            [name, address, mobile, email],
            function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID });
                
                // Close the database connection
                userDb.close(err => {
                    if (err) console.error('Error closing user database:', err);
                });
            }
        );
    });
});

app.get('/api/accounts', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    let query = 'SELECT * FROM accounts';
    let params = [];

    if (req.query.name) {
        query += ' WHERE name = ?';
        params.push(req.query.name);
    }

    query += ' ORDER BY name';

    userDb.all(query, params, (err, accounts) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(accounts);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.get('/api/accounts/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `SELECT * FROM accounts WHERE id = ?`;
    userDb.get(query, [req.params.id], (err, account) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json(account);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.put('/api/accounts/:id', isAuthenticated, withUserDb, (req, res) => {
    const { name, address, mobile, email } = req.body;
    const accountId = req.params.id;
    const userDb = req.userDb;
    
    // Check if an account with the same name already exists (excluding this account)
    userDb.get('SELECT id FROM accounts WHERE LOWER(name) = LOWER(?) AND id != ?', [name, accountId], (err, existingAccount) => {
        if (err) {
            console.error('Error checking for duplicate account:', err);
            return res.status(500).json({ error: 'Failed to check for duplicate account' });
        }
        
        if (existingAccount) {
            return res.status(409).json({ error: 'Another account with this name already exists' });
        }
        
        const query = `UPDATE accounts SET name = ?, address = ?, mobile = ?, email = ? WHERE id = ?`;
        userDb.run(query, [name, address, mobile, email, accountId], function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ changes: this.changes });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.delete('/api/accounts/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `DELETE FROM accounts WHERE id = ?`;
    userDb.run(query, [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ changes: this.changes });
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Sales Routes
app.post('/api/sales', isAuthenticated, withUserDb, (req, res) => {
    const { 
        invoiceNo, date, accountName, shipToAddress, productName, 
        supplyQty, receivedQty, transporterName, transporterFare, 
        paymentOption, remark, container, financial_year_id 
    } = req.body;
    const userDb = req.userDb;
    
    // Get financial year ID from request, or use the current date to determine it
    let financialYearId = financial_year_id;
    if (!financialYearId) {
        const saleDate = new Date(date);
        const year = saleDate.getFullYear();
        const month = saleDate.getMonth() + 1;
        
        // If between April and December, use current year, otherwise use previous year
        const fyStartYear = month >= 4 ? year : year - 1;
        const fyEndYear = fyStartYear + 1;
        financialYearId = `FY${fyStartYear}-${fyEndYear}`;
    }
    
    // Function to get next invoice number for the financial year
    const getNextInvoiceNumber = (callback) => {
        // Check if we have an invoice counter
        userDb.get('SELECT sales_counter FROM invoice_counters LIMIT 1', [], (err, row) => {
            if (err) {
                console.error('Error getting invoice counter:', err);
                return callback(err, null);
            }
            
            if (row) {
                // Increment the counter
                const nextInvoice = row.sales_counter;
                userDb.run('UPDATE invoice_counters SET sales_counter = sales_counter + 1', [], (err) => {
                    if (err) {
                        console.error('Error updating invoice counter:', err);
                        return callback(err, null);
                    }
                    callback(null, nextInvoice);
                });
            } else {
                // Create a new counter entry, starting at 1
                userDb.run('INSERT INTO invoice_counters (sales_counter, purchase_counter) VALUES (1, 1)', [], function(err) {
                    if (err) {
                        console.error('Error creating invoice counter:', err);
                        return callback(err, null);
                    }
                    callback(null, 1);
                });
            }
        });
    };
    
    // Handle the invoice number logic - use provided or generate next in sequence
    if (invoiceNo) {
        // Use provided invoice number
        insertSaleRecord(invoiceNo);
    } else {
        // Generate next invoice number in sequence for this financial year
        getNextInvoiceNumber((err, nextInvoice) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to generate invoice number' });
            }
            insertSaleRecord(nextInvoice);
        });
    }
    
    function insertSaleRecord(finalInvoiceNo) {
        const query = `INSERT INTO sales (
            invoiceNo, date, accountName, shipToAddress, productName, 
            supplyQty, receivedQty, transporterName, transporterFare, 
            paymentOption, remark, container
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        userDb.run(query, [
            finalInvoiceNo, date, accountName, shipToAddress, productName, 
            supplyQty || 0, receivedQty || 0, transporterName || null, transporterFare || 0, 
            paymentOption || 'cash', remark || null, container || null
        ], function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, invoiceNo: finalInvoiceNo });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    }
});

app.get('/api/sales', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // First check if the sales table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, tableExists) => {
        if (err || !tableExists) {
            console.log(`Sales table does not exist for user: ${req.session.username}`);
            return res.json([]); // Return empty array instead of error
        }
        
        userDb.all('SELECT * FROM sales ORDER BY date DESC, invoiceNo DESC', [], (err, sales) => {
            if (err) {
                // Only log error type, not the full stack trace
                console.log(`Error fetching sales for user ${req.session.username}: ${err.code}`);
                return res.json([]); // Return empty array instead of error
            }
            
            res.json(sales || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/sales/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `SELECT * FROM sales WHERE id = ?`;
    userDb.get(query, [req.params.id], (err, sale) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        res.json(sale);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.put('/api/sales/:id', isAuthenticated, withUserDb, (req, res) => {
    const { invoiceNo, date, accountName, shipToAddress, productName, supplyQty, receivedQty, transporterName, transporterFare, paymentOption, remark, container } = req.body;
    const userDb = req.userDb;

    // Validate required fields
    if (!invoiceNo || !date || !accountName || !productName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `UPDATE sales SET 
                  invoiceNo = ?, 
                  date = ?, 
                  accountName = ?, 
                  shipToAddress = ?, 
                  productName = ?, 
                  supplyQty = ?, 
                  receivedQty = ?, 
                  transporterName = ?, 
                  transporterFare = ?, 
                  paymentOption = ?, 
                  remark = ?,
                  container = ?
                  WHERE id = ?`;
    userDb.run(query, [invoiceNo, date, accountName, shipToAddress, productName, supplyQty, receivedQty, transporterName, transporterFare, paymentOption, remark, container, req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message); // Log the error
            return res.status(500).json({ error: err.message });
        }
        res.json({ changes: this.changes });
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.delete('/api/sales/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `DELETE FROM sales WHERE id = ?`;
    userDb.run(query, [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ changes: this.changes });
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Purchase Routes
app.post('/api/purchases', isAuthenticated, withUserDb, (req, res) => {
    const { invoiceNo, date, accountName, productName, supplyQty, receivedQty, transporterName, transporterFare, container, shipToAddress, paymentOption, remark, financial_year_id } = req.body;
    const userDb = req.userDb;
    
    // Check if a purchase with the same invoice number and account name already exists
    const financialYearFilter = financial_year_id ? 'AND financial_year_id = ?' : '';
    const params = financial_year_id ? [invoiceNo, accountName, financial_year_id] : [invoiceNo, accountName];
    
    userDb.get(
        `SELECT id FROM purchases WHERE invoiceNo = ? AND LOWER(accountName) = LOWER(?) ${financialYearFilter}`, 
        params, 
        (err, existingPurchase) => {
            if (err) {
                console.error('Error checking for duplicate purchase:', err);
                return res.status(500).json({ error: 'Failed to check for duplicate purchase' });
            }
            
            if (existingPurchase) {
                return res.status(409).json({ error: 'A purchase with this invoice number already exists for this account' });
            }
            
            // Insert purchase record
            const query = `INSERT INTO purchases (
                invoiceNo, date, accountName, shipToAddress, productName, 
                supplyQty, receivedQty, transporterName, transporterFare, 
                paymentOption, remark, container, financial_year_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            userDb.run(query, [
                invoiceNo, date, accountName, shipToAddress, productName, 
                supplyQty || 0, receivedQty || 0, transporterName || null, transporterFare || 0, 
                paymentOption || 'cash', remark || null, container || null, financial_year_id || null
            ], function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID });
                
                // Close the database connection
                userDb.close(err => {
                    if (err) console.error('Error closing user database:', err);
                });
            });
        }
    );
});

app.get('/api/purchases', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // First check if the purchases table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='purchases'", [], (err, tableExists) => {
        if (err || !tableExists) {
            console.log(`Purchases table does not exist for user: ${req.session.username}`);
            return res.json([]); // Return empty array instead of error
        }
        
        userDb.all('SELECT * FROM purchases ORDER BY date DESC, invoiceNo DESC', [], (err, purchases) => {
            if (err) {
                // Only log error type, not the full stack trace
                console.log(`Error fetching purchases for user ${req.session.username}: ${err.code}`);
                return res.json([]); // Return empty array instead of error
            }
            
            res.json(purchases || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/purchases/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `SELECT * FROM purchases WHERE id = ?`;
    userDb.get(query, [req.params.id], (err, purchase) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        res.json(purchase);
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

app.put('/api/purchases/:id', isAuthenticated, withUserDb, (req, res) => {
    const { invoiceNo, date, accountName, productName, supplyQty, receivedQty, transporterName, transporterFare, container, shipToAddress, paymentOption, remark, financial_year_id } = req.body;
    const purchaseId = req.params.id;
    const userDb = req.userDb;
    
    // First, get the original purchase to check if invoice or account has changed
    userDb.get('SELECT invoiceNo, accountName, financial_year_id FROM purchases WHERE id = ?', [purchaseId], (err, originalPurchase) => {
        if (err) {
            console.error('Error getting original purchase:', err);
            return res.status(500).json({ error: 'Failed to get original purchase data' });
        }
        
        if (!originalPurchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        // If invoice number or account name has changed, check for duplicates
        if (originalPurchase.invoiceNo !== invoiceNo || originalPurchase.accountName !== accountName) {
            const financialYearFilter = financial_year_id ? 'AND financial_year_id = ?' : '';
            const params = financial_year_id 
                ? [invoiceNo, accountName, financial_year_id, purchaseId] 
                : [invoiceNo, accountName, purchaseId];
                
            userDb.get(
                `SELECT id FROM purchases WHERE invoiceNo = ? AND LOWER(accountName) = LOWER(?) ${financialYearFilter} AND id != ?`, 
                params, 
                (err, existingPurchase) => {
                    if (err) {
                        console.error('Error checking for duplicate purchase:', err);
                        return res.status(500).json({ error: 'Failed to check for duplicate purchase' });
                    }
                    
                    if (existingPurchase) {
                        return res.status(409).json({ error: 'Another purchase with this invoice number already exists for this account' });
                    }
                    
                    updatePurchase();
                }
            );
        } else {
            // No need to check for duplicates if invoice and account haven't changed
            updatePurchase();
        }
        
        function updatePurchase() {
            const query = `UPDATE purchases SET
                invoiceNo = ?,
                date = ?,
                accountName = ?,
                shipToAddress = ?,
                productName = ?,
                supplyQty = ?,
                receivedQty = ?,
                transporterName = ?,
                transporterFare = ?,
                paymentOption = ?,
                remark = ?,
                container = ?,
                financial_year_id = ?
                WHERE id = ?`;
            
            userDb.run(query, [
                invoiceNo,
                date,
                accountName,
                shipToAddress,
                productName,
                supplyQty,
                receivedQty,
                transporterName,
                transporterFare,
                paymentOption,
                remark,
                container,
                financial_year_id,
                purchaseId
            ], function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ changes: this.changes });
                
                // Close the database connection
                userDb.close(err => {
                    if (err) console.error('Error closing user database:', err);
                });
            });
        }
    });
});

app.delete('/api/purchases/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    const query = `DELETE FROM purchases WHERE id = ?`;
    userDb.run(query, [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ changes: this.changes });
        
        // Close the database connection
        userDb.close(err => {
            if (err) console.error('Error closing user database:', err);
        });
    });
});

// Stock Management Routes
app.get('/api/stock/movements', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // First, check if the stock_movements table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'", [], (err, tableExists) => {
        if (err) {
            console.error('Error checking for stock_movements table:', err);
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        
        if (!tableExists) {
            // Table doesn't exist yet, create it
            userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                productName TEXT NOT NULL,
                filledStock INTEGER DEFAULT 0,
                emptyStock INTEGER DEFAULT 0,
                filledReceived INTEGER DEFAULT 0,
                filledSupplied INTEGER DEFAULT 0,
                emptyReceived INTEGER DEFAULT 0,
                emptySupplied INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (createErr) => {
                if (createErr) {
                    console.error('Error creating stock_movements table:', createErr);
                    return res.status(500).json({ error: 'Failed to create stock movements table', details: createErr.message });
                }
                
                // Return empty array since table was just created
                res.json([]);
                
                // Close the database connection
                userDb.close(err => {
                    if (err) console.error('Error closing user database:', err);
                });
            });
        } else {
            // Table exists, fetch the data
            const query = `
                SELECT * FROM stock_movements 
                ORDER BY productName ASC
            `;
            
            userDb.all(query, [], (queryErr, movements) => {
                if (queryErr) {
                    console.error('Database error fetching stock movements:', queryErr.message);
                    return res.status(500).json({ error: 'Failed to fetch stock movements', details: queryErr.message });
                }
                res.json(movements || []);
                
                // Close the database connection
                userDb.close(err => {
                    if (err) console.error('Error closing user database:', err);
                });
            });
        }
    });
});

app.post('/api/stock/movements', isAuthenticated, withUserDb, (req, res) => {
    const {
        date,
        productName,
        filledStock,
        emptyStock,
        filledReceived,
        filledSupplied,
        emptyReceived,
        emptySupplied
    } = req.body;
    
    const userDb = req.userDb;

    // First, ensure the stock_movements table exists
    userDb.run(`CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        productName TEXT NOT NULL,
        filledStock INTEGER DEFAULT 0,
        emptyStock INTEGER DEFAULT 0,
        filledReceived INTEGER DEFAULT 0,
        filledSupplied INTEGER DEFAULT 0,
        emptyReceived INTEGER DEFAULT 0,
        emptySupplied INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (createErr) => {
        if (createErr) {
            console.error('Error creating stock_movements table:', createErr);
            return res.status(500).json({ error: 'Failed to create stock movements table' });
        }
        
        // Now insert the new stock movement record
        const query = `
            INSERT INTO stock_movements (
                date,
                productName,
                filledStock,
                emptyStock,
                filledReceived,
                filledSupplied,
                emptyReceived,
                emptySupplied
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        userDb.run(query, [
            date,
            productName,
            filledStock || 0,
            emptyStock || 0,
            filledReceived || 0,
            filledSupplied || 0,
            emptyReceived || 0,
            emptySupplied || 0
        ], function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to create stock movement' });
            }
            res.json({ id: this.lastID });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/stock/summary', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // First, check if the stock_movements table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'", [], (err, tableExists) => {
        if (err) {
            console.error('Error checking for stock_movements table:', err);
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        
        if (!tableExists) {
            // Table doesn't exist yet, return empty array
            return res.json([]);
        }
        
        const query = `
            SELECT 
                productName,
                MAX(filledStock) as filledStock,
                MAX(emptyStock) as emptyStock,
                SUM(filledReceived) as totalFilledReceived,
                SUM(filledSupplied) as totalFilledSupplied,
                SUM(emptyReceived) as totalEmptyReceived,
                SUM(emptySupplied) as totalEmptySupplied
            FROM stock_movements
            GROUP BY productName
            ORDER BY productName ASC
        `;
        
        userDb.all(query, [], (err, summary) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to fetch stock summary' });
            }
            res.json(summary || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

// Update stock movement when a sale is made
app.post('/api/stock/update-from-sale', (req, res) => {
    const { date, productName, filledSupplied, emptyReceived } = req.body;
    
    // First get current stock levels
    authDb.get(
        'SELECT filledStock, emptyStock FROM stock_movements WHERE productName = ? ORDER BY id DESC LIMIT 1',
        [productName],
        (err, currentStock) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const newFilledStock = (currentStock?.filledStock || 0) - (filledSupplied || 0);
            const newEmptyStock = (currentStock?.emptyStock || 0) + (emptyReceived || 0);

            const query = `
                INSERT INTO stock_movements (
                    date,
                    productName,
                    filledStock,
                    emptyStock,
                    filledSupplied,
                    emptyReceived
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            authDb.run(query, [
                date,
                productName,
                newFilledStock,
                newEmptyStock,
                filledSupplied || 0,
                emptyReceived || 0
            ], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID });
            });
        }
    );
});

// Update stock movement when a purchase is made
app.post('/api/stock/update-from-purchase', (req, res) => {
    const { date, productName, filledReceived, emptySupplied } = req.body;
    
    // First get current stock levels
    authDb.get(
        'SELECT filledStock, emptyStock FROM stock_movements WHERE productName = ? ORDER BY id DESC LIMIT 1',
        [productName],
        (err, currentStock) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const newFilledStock = (currentStock?.filledStock || 0) + (filledReceived || 0);
            const newEmptyStock = (currentStock?.emptyStock || 0) - (emptySupplied || 0);

            const query = `
                INSERT INTO stock_movements (
                    date,
                    productName,
                    filledStock,
                    emptyStock,
                    filledReceived,
                    emptySupplied
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            authDb.run(query, [
                date,
                productName,
                newFilledStock,
                newEmptyStock,
                filledReceived || 0,
                emptySupplied || 0
            ], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID });
            });
        }
    );
});

// Dashboard Routes
app.get('/api/dashboard/sales-summary', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if sales table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, table) => {
        if (err || !table) {
            console.log('Sales table does not exist for user:', req.session.username);
            return res.json([]);
        }
        
    const query = `
        SELECT 
            strftime('%Y-%m', date) as month,
            COUNT(*) as totalSales,
            SUM(supplyQty) as totalSupplyQty,
            SUM(receivedQty) as totalReceivedQty,
            SUM(transporterFare) as totalTransportFare,
            SUM(CASE WHEN paymentOption = 'cash' THEN 1 ELSE 0 END) as cashSales,
            SUM(CASE WHEN paymentOption = 'credit' THEN 1 ELSE 0 END) as creditSales
        FROM sales
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month DESC
        LIMIT 12
    `;
    
        userDb.all(query, [], (err, summary) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(summary || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/dashboard/top-customers', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if sales table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, table) => {
        if (err || !table) {
            console.log('Sales table does not exist for user:', req.session.username);
            return res.json([]);
        }
        
    const query = `
        SELECT 
            accountName,
            COUNT(*) as totalTransactions,
            SUM(supplyQty) as totalSupplyQty,
            SUM(receivedQty) as totalReceivedQty,
            SUM(transporterFare) as totalTransportFare
        FROM sales
        GROUP BY accountName
        ORDER BY totalTransactions DESC
        LIMIT 10
    `;
    
        userDb.all(query, [], (err, customers) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(customers || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/dashboard/product-performance', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if sales table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, table) => {
        if (err || !table) {
            console.log('Sales table does not exist for user:', req.session.username);
            return res.json([]);
        }
        
    const query = `
        SELECT 
            productName,
            COUNT(*) as totalSales,
            SUM(supplyQty) as totalSupplyQty,
            SUM(receivedQty) as totalReceivedQty,
            AVG(supplyQty) as avgSupplyQty
        FROM sales
        GROUP BY productName
        ORDER BY totalSales DESC
        LIMIT 10
    `;
    
        userDb.all(query, [], (err, products) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(products || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/dashboard/recent-sales', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if sales table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'", [], (err, table) => {
        if (err || !table) {
            console.log('Sales table does not exist for user:', req.session.username);
            return res.json([]);
        }
        
    const query = `
        SELECT *
        FROM sales
        ORDER BY date DESC, invoiceNo DESC
        LIMIT 10
    `;
    
        userDb.all(query, [], (err, sales) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(sales || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

// Transporter Routes
app.post('/api/transporters', isAuthenticated, withUserDb, (req, res) => {
    const { name, mobile, address, details } = req.body;
    const userDb = req.userDb;
    
    if (!name.trim()) {
        return res.status(400).json({ error: 'Transporter name is required' });
    }

    // Check if transporters table exists, if not create it
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transporters'", [], (err, table) => {
        if (err) {
            console.error('Database error:', err.message);
            userDb.close();
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        // Create transporters table if it doesn't exist
        if (!table) {
            console.log(`Creating transporters table for user: ${req.session.username}`);
            userDb.run(`CREATE TABLE IF NOT EXISTS transporters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mobile TEXT,
                address TEXT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating transporters table:', err.message);
                    userDb.close();
                    return res.status(500).json({ error: 'Failed to create transporters table' });
                }
                
                // Now insert the transporter
                insertTransporter();
            });
        } else {
            // Table exists, insert the transporter
            insertTransporter();
        }
    });
    
    function insertTransporter() {
    const query = `INSERT INTO transporters (name, mobile, address, details) VALUES (?, ?, ?, ?)`;
        userDb.run(query, [name, mobile || null, address || null, details || null], function(err) {
        if (err) {
            console.error('Database error:', err.message);
                userDb.close();
            return res.status(500).json({ error: err.message });
        }
            
        res.json({ id: this.lastID });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    }
});

app.get('/api/transporters', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if transporters table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transporters'", [], (err, table) => {
        if (err) {
            console.error('Database error:', err.message);
            userDb.close();
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        // If table doesn't exist, return empty array
        if (!table) {
            console.log(`Transporters table does not exist for user: ${req.session.username}`);
            userDb.close();
            return res.json([]);
        }
        
        // Table exists, get transporters
    const query = `SELECT * FROM transporters ORDER BY name`;
        userDb.all(query, [], (err, transporters) => {
        if (err) {
            console.error('Database error:', err.message);
                userDb.close();
            return res.status(500).json({ error: err.message });
        }
            
            res.json(transporters || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.get('/api/transporters/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if transporters table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transporters'", [], (err, table) => {
        if (err || !table) {
            if (err) console.error('Database error:', err.message);
            userDb.close();
            return res.status(404).json({ error: 'Transporters table not found' });
        }
        
        // Table exists, get transporter by ID
    const query = `SELECT * FROM transporters WHERE id = ?`;
        userDb.get(query, [req.params.id], (err, transporter) => {
        if (err) {
            console.error('Database error:', err.message);
                userDb.close();
            return res.status(500).json({ error: err.message });
        }
            
        if (!transporter) {
                userDb.close();
            return res.status(404).json({ error: 'Transporter not found' });
        }
            
        res.json(transporter);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.put('/api/transporters/:id', isAuthenticated, withUserDb, (req, res) => {
    const { name, mobile, address, details } = req.body;
    const userDb = req.userDb;
    
    if (!name.trim()) {
        userDb.close();
        return res.status(400).json({ error: 'Transporter name is required' });
    }

    // Check if transporters table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transporters'", [], (err, table) => {
        if (err || !table) {
            if (err) console.error('Database error:', err.message);
            userDb.close();
            return res.status(404).json({ error: 'Transporters table not found' });
        }
        
        // Table exists, update transporter
    const query = `UPDATE transporters SET name = ?, mobile = ?, address = ?, details = ? WHERE id = ?`;
        userDb.run(query, [name, mobile || null, address || null, details || null, req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
                userDb.close();
            return res.status(500).json({ error: err.message });
        }
            
        res.json({ changes: this.changes });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

app.delete('/api/transporters/:id', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Check if transporters table exists
    userDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transporters'", [], (err, table) => {
        if (err || !table) {
            if (err) console.error('Database error:', err.message);
            userDb.close();
            return res.status(404).json({ error: 'Transporters table not found' });
        }
        
        // Table exists, delete transporter
    const query = `DELETE FROM transporters WHERE id = ?`;
        userDb.run(query, [req.params.id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
                userDb.close();
            return res.status(500).json({ error: err.message });
        }
            
        res.json({ changes: this.changes });
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    });
});

// Backup endpoint
app.get('/api/backup', isAuthenticated, (req, res) => {
    const username = req.session.username;
    
    // Get the user's database path from the auth database
    authDb.get('SELECT user_dir FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Error fetching user database path:', err);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'User database not found' });
        }
        
        // Create a standardized backup
        const fileName = `backup_${username}_${new Date().toISOString().split('T')[0]}.db`;
        const backupPath = path.join(__dirname, 'temp_backups');

        // Create temp directory if it doesn't exist
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        const tempBackupFile = path.join(backupPath, fileName);
        console.log(`Creating backup at ${tempBackupFile}`);

        // Get all user databases first
        getAllUserDatabases(username)
            .then(databases => {
                if (Object.keys(databases).length === 0) {
                    return res.status(404).json({ error: 'No databases found to backup' });
                }
                
                // Create the backup using the database.js function
                return backupUserDatabases(username, tempBackupFile);
            })
            .then(backupResult => {
                // Check if the file was created successfully
                if (!fs.existsSync(tempBackupFile)) {
                    throw new Error('Backup file was not created');
                }
                
                // Send the backup file
                res.download(tempBackupFile, fileName, (err) => {
                    if (err) {
                        console.error('Error downloading backup:', err);
                        // Don't try to send response here as headers might have been sent
                    }
                    
                    // Delete the temporary file after download (with a delay to ensure download completes)
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(tempBackupFile)) {
                                fs.unlinkSync(tempBackupFile);
                                console.log(`Deleted temporary backup file: ${tempBackupFile}`);
                            }
                        } catch (unlinkErr) {
                            console.error('Error deleting temporary backup file:', unlinkErr);
                        }
                    }, 5000);
                });
            })
            .catch(error => {
                console.error('Error creating backup:', error);
                // Check if headers have been sent before sending error response
                if (!res.headersSent) {
                    return res.status(500).json({ error: 'Error creating backup: ' + error.message });
                }
            });
    });
});

// Function to restore databases from a backup file
function restoreFromBackup(username, backupFile, userDir) {
    return new Promise((resolve, reject) => {
        try {
            // Open the backup database
            const backupDb = new sqlite3.Database(backupFile, sqlite3.OPEN_READONLY);
            
            // First check if this is a valid backup file
            backupDb.get('SELECT value FROM backup_meta WHERE key = ?', ['username'], (err, row) => {
                if (err) {
                    backupDb.close();
                    return reject(new Error('Invalid backup file format or not a valid backup file'));
                }
                
                const backupUsername = row?.value;
                
                // Log the usernames for debugging
                console.log(`Restoring backup for user ${backupUsername} to ${username}'s account`);
                
                // Strict validation: Warn if usernames don't match
                if (backupUsername && backupUsername !== username) {
                    console.warn(`WARNING: Backup username '${backupUsername}' doesn't match current user '${username}'`);
                    
                    // You can uncomment the following to enforce strict username matching
                    // backupDb.close();
                    // return reject(new Error(`This backup belongs to user '${backupUsername}' and cannot be restored to '${username}'s account. Please contact an administrator for assistance.`));
                }
                
                // Get the database information
                backupDb.all('SELECT * FROM backup_databases', [], async (err, databases) => {
                    if (err) {
                        backupDb.close();
                        return reject(new Error('Could not read database information from backup'));
                    }
                    
                    try {
                        // Create a backup of current databases
                        const backupDir = path.join(userDir, '_backup_before_restore_' + new Date().toISOString().replace(/:/g, '-'));
                        fs.mkdirSync(backupDir, { recursive: true });
                        
                        // Get all current database files
                        const currentDatabases = await getAllUserDatabases(username);
                        
                        // Back up current databases
                        for (const db of Object.values(currentDatabases)) {
                            if (fs.existsSync(db.path)) {
                                const dbName = path.basename(db.path);
                                fs.copyFileSync(db.path, path.join(backupDir, dbName));
                            }
                        }
                        
                        // For each database in the backup, restore it
                        for (const dbInfo of databases) {
                            // Path for the restored database
                            const dbPath = path.join(userDir, dbInfo.file_name || `${dbInfo.id}.db`);
                            
                            // Create a new database file with the schema
                            const newDb = new sqlite3.Database(dbPath);
                            
                            // Initialize the schema properly - this is important!
                            await initializeDatabaseSchema(newDb, dbInfo.id);
                            
                            // Close it properly to ensure it's created
                            await new Promise(resolve => {
                                newDb.close(resolve);
                            });
                            
                            console.log(`Created restored database at ${dbPath} with schema initialized`);
                        }
                        
                        // Close the backup database
                        backupDb.close();
                        
                        resolve({ 
                            success: true, 
                            message: `Database restored successfully for user "${username}". Application restart required.`,
                            backupDir,
                            requiresRestart: true
                        });
                    } catch (err) {
                        backupDb.close();
                        reject(err);
                    }
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

// Helper function to initialize database schema
async function initializeDatabaseSchema(db, databaseId) {
    return new Promise((resolve, reject) => {
        try {
            // Create all the necessary tables
            db.serialize(() => {
                // Create products table
                db.run(`CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    fullStock INTEGER DEFAULT 0,
                    emptyStock INTEGER DEFAULT 0
                )`, (err) => {
                    if (err) console.error('Error creating products table:', err);
                });

                // Create sales table
                db.run(`CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoiceNo TEXT NOT NULL,
                    date TEXT NOT NULL,
                    accountName TEXT NOT NULL,
                    shipToAddress TEXT,
                    productName TEXT NOT NULL,
                    supplyQty INTEGER,
                    receivedQty INTEGER,
                    transporterName TEXT,
                    transporterFare REAL,
                    paymentOption TEXT,
                    remark TEXT,
                    container TEXT,
                    financial_year_id TEXT
                )`, (err) => {
                    if (err) console.error('Error creating sales table:', err);
                });

                // Create purchases table
                db.run(`CREATE TABLE IF NOT EXISTS purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoiceNo TEXT NOT NULL,
                    date TEXT NOT NULL,
                    accountName TEXT NOT NULL,
                    shipToAddress TEXT,
                    productName TEXT NOT NULL,
                    supplyQty INTEGER,
                    receivedQty INTEGER,
                    transporterName TEXT,
                    transporterFare REAL,
                    paymentOption TEXT,
                    remark TEXT,
                    container TEXT,
                    financial_year_id TEXT
                )`, (err) => {
                    if (err) console.error('Error creating purchases table:', err);
                });

                // Create stock_movements table
                db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    productName TEXT NOT NULL,
                    filledStock INTEGER DEFAULT 0,
                    emptyStock INTEGER DEFAULT 0,
                    filledReceived INTEGER DEFAULT 0,
                    filledSupplied INTEGER DEFAULT 0,
                    emptyReceived INTEGER DEFAULT 0,
                    emptySupplied INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) console.error('Error creating stock_movements table:', err);
                });

                db.run(`CREATE TABLE IF NOT EXISTS transporters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    mobile TEXT,
                    address TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) console.error('Error creating transporters table:', err);
                });
                
                db.run(`CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    mobile TEXT,
                    email TEXT,
                    address TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) console.error('Error creating accounts table:', err);
                });
                
                // Create invoice counters table
                db.run(`CREATE TABLE IF NOT EXISTS invoice_counters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sales_counter INTEGER DEFAULT 1,
                    purchase_counter INTEGER DEFAULT 1
                )`, (err) => {
                    if (err) {
                        console.error('Error creating invoice_counters table:', err);
                    } else {
                        // Insert initial counter values if table is empty
                        db.get('SELECT COUNT(*) as count FROM invoice_counters', [], (err, row) => {
                            if (err) {
                                console.error('Error checking invoice counters:', err);
                                return;
                            }
                            
                            if (row.count === 0) {
                                db.run('INSERT INTO invoice_counters (sales_counter, purchase_counter) VALUES (1, 1)', (err) => {
                                    if (err) {
                                        console.error('Error inserting default counters:', err);
                                    }
                                });
                            }
                        });
                    }

                    // Signal completion
                    resolve();
                });
            });
        } catch (err) {
            console.error('Error initializing database schema:', err);
            reject(err);
        }
    });
}

// Restore endpoint
app.post('/api/restore', isAuthenticated, upload.single('backup'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file provided' });
    }

    const username = req.session.username;
    const tempPath = req.file.path;
    
    // Get the user's database path from the auth database
    authDb.get('SELECT user_dir FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Error fetching user database path:', err);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!row || !row.user_dir) {
            return res.status(404).json({ error: 'User database not found' });
        }
        
        const userDir = row.user_dir;
        
        try {
            // Use the restoreFromBackup function
            restoreFromBackup(username, tempPath, userDir)
                .then(result => {
                    // Delete the temporary uploaded file
                    fs.unlink(tempPath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Error deleting temporary file:', unlinkErr);
                        }
                    });
                    
                    console.log(`Database restored successfully for user: ${username}`);
                    res.json({
                        success: true,
                        message: result.message,
                        username: username,
                        timestamp: new Date().toISOString(),
                        requiresRestart: true
                    });
                })
                .catch(err => {
                    console.error('Error during restore process:', err);
                    return res.status(500).json({ error: 'Error during restore: ' + err.message });
                });
        } catch (err) {
            console.error('Error processing restore request:', err);
            return res.status(500).json({ error: 'Server error processing restore request' });
        }
    });
});

// Restart server endpoint (admin only)
app.post('/api/restart', isAuthenticated, (req, res) => {
    // Only allow admins to restart the server
    const username = req.session.username;
    
    // Get the user's role from the database
    authDb.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is admin (you may need to add an admin field to your users table)
        if (user.is_admin === 1) {
            res.json({ success: true, message: 'Server restart initiated' });
    
    // Wait for response to be sent before restarting
    setTimeout(() => {
                console.log('Restarting server by admin request');
                process.exit(0); // Process manager should restart the server
    }, 1000);
        } else {
            return res.status(403).json({ error: 'Permission denied. Admin access required.' });
        }
    });
});

// Password Reset Route
app.post('/api/reset-password', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    
    // Update user with reset token
    authDb.run(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
        [resetToken, resetTokenExpiry, email],
        function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Database error occurred' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Email not found' });
            }
            
            // Send email with reset link
            const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
            const mailOptions = {
                from: 'patidargastraders@gmail.com',
                to: email,
                subject: 'Password Reset OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #4a4a4a; text-align: center;">Password Reset Request</h2>
                        <p>Hello ${user.username},</p>
                        <p>You requested to reset your password. Please use the following OTP (One-Time Password) to complete the process:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <h1 style="font-size: 32px; margin: 0; color: #0a6e81;">${otp}</h1>
                        </div>
                        <p>This OTP will expire in 10 minutes.</p>
                        <p>If you did not request this password reset, please ignore this email or contact support.</p>
                        <p style="text-align: center; margin-top: 30px; color: #777; font-size: 12px;">This is an automated message from Patidar Gas Traders.</p>
                    </div>
                `
            };
            
            console.log(`Sending OTP email to ${email}`);
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Email sending error:', error);
                    return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
                }
                
                console.log(`OTP email sent successfully: ${info.response}`);
                res.json({ message: 'OTP sent successfully to your email' });
            });
        }
    );
});

// Verify OTP and update password
app.post('/api/verify-otp', (req, res) => {
    const { identifier, otp, newPassword } = req.body;
    
    console.log(`Verifying OTP for identifier: ${identifier}`);
    
    if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ error: 'Identifier, OTP, and new password are required' });
    }
    
    // Find the user by username or email
    const query = 'SELECT * FROM users WHERE (username = ? OR email = ?) AND otp = ? AND reset_token_expiry > ?';
    authDb.get(query, [identifier, identifier, otp, Date.now()], (err, user) => {
        if (err) {
            console.error('Database error checking OTP:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            console.log(`Invalid or expired OTP for identifier: ${identifier}`);
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        console.log(`Valid OTP for user ${user.username}, updating password`);
        
        // Hash the new password with bcrypt
        const bcrypt = require('bcryptjs');
        bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Password hashing error:', err);
                return res.status(500).json({ error: 'Error processing password' });
            }
            
            // Update password and clear reset tokens and OTP
            const updateQuery = 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, otp = NULL WHERE id = ?';
            authDb.run(updateQuery, [hashedPassword, user.id], function(err) {
                if (err) {
                    console.error('Database error updating password:', err.message);
                    return res.status(500).json({ error: 'Failed to update password' });
                }
                
                console.log(`Password updated successfully for user ${user.username}`);
                res.json({ success: true, message: 'Password updated successfully' });
            });
        });
    });
});

// Customer Rates APIs
app.get('/api/customer-rates', isAuthenticated, (req, res) => {
    const { customer_name } = req.query;
    
    if (!customer_name) {
        return res.status(400).json({ error: 'Customer name is required' });
    }
    
    authDb.all('SELECT * FROM customer_rates WHERE customer_name = ?', [customer_name], (err, rates) => {
            if (err) {
            console.error('Error fetching customer rates:', err);
                return res.status(500).json({ error: 'Database error occurred' });
            }
        
        res.json(rates || []);
    });
});

app.post('/api/customer-rates', isAuthenticated, (req, res) => {
    const { customer_name, product_name, rate, empty_rate } = req.body;
    
    if (!customer_name || !product_name) {
        return res.status(400).json({ error: 'Customer name and product name are required' });
    }
    
    // Check if this rate already exists
    authDb.get('SELECT * FROM customer_rates WHERE customer_name = ? AND product_name = ?', 
        [customer_name, product_name], (err, existingRate) => {
            if (err) {
            console.error('Error checking customer rate:', err);
                return res.status(500).json({ error: 'Database error occurred' });
            }
            
            if (existingRate) {
                // Update existing rate
            authDb.run('UPDATE customer_rates SET rate = ?, empty_rate = ? WHERE customer_name = ? AND product_name = ?',
                [rate, empty_rate, customer_name, product_name], function(err) {
                        if (err) {
                    console.error('Error updating customer rate:', err);
                            return res.status(500).json({ error: 'Failed to update rate' });
                        }
                
                res.json({ 
                    id: existingRate.id,
                    customer_name,
                    product_name,
                    rate,
                    empty_rate
                });
            });
            } else {
            // Create new rate
            authDb.run('INSERT INTO customer_rates (customer_name, product_name, rate, empty_rate) VALUES (?, ?, ?, ?)',
                [customer_name, product_name, rate, empty_rate], function(err) {
                        if (err) {
                    console.error('Error creating customer rate:', err);
                    return res.status(500).json({ error: 'Failed to create rate' });
                }
                
                res.json({ 
                    id: this.lastID,
                    customer_name,
                    product_name,
                    rate,
                    empty_rate
                });
            });
        }
    });
});

app.post('/api/customer-rates/batch', isAuthenticated, (req, res) => {
    const { rates } = req.body;
    
    if (!rates || !Array.isArray(rates) || rates.length === 0) {
        return res.status(400).json({ error: 'Rates array is required' });
    }
    
    // Use a transaction to ensure all updates are atomic
    authDb.serialize(() => {
        authDb.run('BEGIN TRANSACTION');
        
        const updatePromises = rates.map(rate => {
            return new Promise((resolve, reject) => {
                const { customer_name, product_name, rate: rateValue, empty_rate } = rate;
        
        if (!customer_name || !product_name) {
                    return reject(new Error('Customer name and product name are required for all rates'));
                }
                
                // Check if rate exists
                authDb.get('SELECT * FROM customer_rates WHERE customer_name = ? AND product_name = ?', 
                    [customer_name, product_name], (err, existingRate) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        if (existingRate) {
                        // Update
                        authDb.run('UPDATE customer_rates SET rate = ?, empty_rate = ? WHERE customer_name = ? AND product_name = ?',
                            [rateValue, empty_rate, customer_name, product_name], function(err) {
                                    if (err) {
                                        return reject(err);
                                    }
                            resolve({
                                id: existingRate.id,
                                customer_name,
                                product_name,
                                rate: rateValue,
                                empty_rate
                            });
                        });
                        } else {
                        // Insert
                        authDb.run('INSERT INTO customer_rates (customer_name, product_name, rate, empty_rate) VALUES (?, ?, ?, ?)',
                            [customer_name, product_name, rateValue, empty_rate], function(err) {
                                    if (err) {
                                        return reject(err);
                                    }
                            resolve({
                                id: this.lastID,
                                customer_name,
                                product_name,
                                rate: rateValue,
                                empty_rate
                            });
                        });
                    }
                });
            });
        });
        
        Promise.all(updatePromises)
        .then(results => {
                authDb.run('COMMIT', () => {
                    res.json({ success: true, rates: results });
            });
        })
        .catch(error => {
                console.error('Error updating customer rates:', error);
                authDb.run('ROLLBACK', () => {
                    res.status(500).json({ error: 'Failed to update customer rates' });
        });
});
    });
});

// Financial reports routes (add this in the section with authenticated routes)
app.get('/api/financial-year/:year', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { year } = req.params;
        const { type } = req.query; // Optional: sales, purchases, or all (default)
        
        const transactions = await getFinancialYearTransactions(
            req.session.username,
            year,
            type || 'all'
        );
        
        res.json(transactions);
    } catch (error) {
        console.error('Error retrieving financial year data:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/financial-year/:year/summary', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { year } = req.params;
        
        const summary = await getFinancialYearSummary(
            req.session.username,
            year
        );
        
        res.json(summary);
    } catch (error) {
        console.error('Error retrieving financial year summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process Financial Year End
app.post('/api/process-year-end', async (req, res) => {
    try {
        if (!req.session || !req.session.username) {
            return res.status(401).json({ error: 'You must be logged in to perform this operation' });
        }

        const { newFinancialYear, closingStock } = req.body;
        if (!newFinancialYear || !closingStock) {
            return res.status(400).json({ error: 'Missing required data for year-end processing' });
        }

        // Properly get the user database using the Promise-based getUserDatabase function
        const userDb = await getUserDatabase(req.session.username);

        // Begin a transaction to ensure consistency
        userDb.run('BEGIN TRANSACTION', async function(err) {
            if (err) {
                console.error('Error starting transaction:', err);
                userDb.close();
                return res.status(500).json({ error: 'Database error occurred' });
            }

            try {
                // 1. Store the financial year information
                await new Promise((resolve, reject) => {
                    userDb.run(
                        'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)', 
                        [newFinancialYear.id, newFinancialYear.label, newFinancialYear.startDate, newFinancialYear.endDate],
                        function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.lastID);
                            }
                        }
                    );
                });

                // 2. Store closing stock as opening stock for new year
                for (const item of closingStock) {
                    await new Promise((resolve, reject) => {
                        userDb.run(
                            'INSERT INTO opening_stock (product_id, product_name, quantity, financial_year_id, created_at) VALUES (?, ?, ?, ?, ?)',
                            [item.id || 0, item.name, item.quantity || 0, newFinancialYear.id, new Date().toISOString()],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                }

                // 3. Reset invoice counters for the new financial year
                await new Promise((resolve, reject) => {
                    userDb.run(
                        'INSERT INTO invoice_counters (financial_year_id, sales_counter, purchase_counter) VALUES (?, 1, 1)',
                        [newFinancialYear.id],
                        function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                // Commit the transaction
                userDb.run('COMMIT', function(err) {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        userDb.run('ROLLBACK');
                        userDb.close();
                        return res.status(500).json({ error: 'Failed to commit changes' });
                    }

                    // Success response
                    res.json({ 
                        success: true, 
                        message: `Financial year ${newFinancialYear.label} created successfully`,
                        financialYearId: newFinancialYear.id
                    });

                    // Close the database connection
                    userDb.close(err => {
                        if (err) console.error('Error closing user database:', err);
                    });
                });
            } catch (error) {
                // Roll back transaction on error
                userDb.run('ROLLBACK');
                console.error('Error in year-end processing:', error);
                userDb.close();
                res.status(500).json({ error: error.message || 'Failed to process year end' });
            }
        });
    } catch (error) {
        console.error('Year-end processing error:', error);
        res.status(500).json({ error: 'Internal server error during year-end processing' });
    }
});

// Get all financial years for current user
// Commented out to prevent duplicate endpoint issues
/*
app.get('/api/financial-years', (req, res) => {
    try {
        if (!req.session || !req.session.username) {
            return res.status(401).json({ error: 'You must be logged in to access this resource' });
        }

        const db = getUserDatabase(req.session.username);
        if (!db) {
            return res.status(500).json({ error: 'Unable to access user database' });
        }

        db.all('SELECT * FROM financial_years ORDER BY start_date ASC', [], (err, rows) => {
            if (err) {
                console.error('Error fetching financial years:', err);
                return res.status(500).json({ error: 'Failed to fetch financial years' });
            }

            res.json(rows);
        });
    } catch (error) {
        console.error('Error in /api/financial-years:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
*/

// Get next invoice number for a financial year
app.get('/api/next-invoice-number', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    const type = req.query.type;
    
    if (!type || (type !== 'sale' && type !== 'purchase')) {
        return res.status(400).json({ error: 'Invalid type parameter. Must be "sale" or "purchase".' });
    }
    
    const counterField = type === 'sale' ? 'sales_counter' : 'purchase_counter';
    
    // Get the current counter from the database
    userDb.get(`SELECT ${counterField} FROM invoice_counters LIMIT 1`, [], (err, row) => {
        if (err) {
            console.error('Error getting invoice counter:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            // Initialize counter if it doesn't exist
            userDb.run(
                'INSERT INTO invoice_counters (sales_counter, purchase_counter) VALUES (1, 1)',
                function(err) {
                    if (err) {
                        console.error('Error initializing invoice counter:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Return initial counter value
                    const prefix = type === 'sale' ? 'S' : 'P';
                    const counterValue = 1;
                    const finalInvoiceNo = `${prefix}${counterValue.toString().padStart(4, '0')}`;
                    
                    res.json({
                        invoiceNo: finalInvoiceNo,
                        counter: counterValue,
                        financial_year_id: userDb.financialYearId
                    });
                }
            );
        } else {
            // Format and return the next invoice number
            const counterValue = row[counterField];
            const prefix = type === 'sale' ? 'S' : 'P';
            const finalInvoiceNo = `${prefix}${counterValue.toString().padStart(4, '0')}`;
            
            res.json({
                invoiceNo: finalInvoiceNo,
                counter: counterValue,
                financial_year_id: userDb.financialYearId
            });
        }
    });
});

// Stock API endpoint to get current stock data
app.get('/api/stock', isAuthenticated, withUserDb, (req, res) => {
    const userDb = req.userDb;
    
    // Get stock data from products table for consistency
    let query = 'SELECT id, name, fullStock as quantity FROM products';
    let params = [];
    
    // If financial year is specified, we need to calculate proper stock for that period
    if (req.query.financialYearId) {
        userDb.get('SELECT * FROM financial_years WHERE id = ?', [req.query.financialYearId], (err, financialYear) => {
            if (err) {
                console.error('Error fetching financial year:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (financialYear) {
                userDb.all('SELECT id, name, fullStock as quantity FROM products', [], (err, products) => {
                    if (err) {
                        console.error('Error fetching stock data:', err);
                        return res.status(500).json({ error: 'Failed to fetch stock data' });
                    }
                    
                    // Get all stock movements and calculate current stock
                    const promises = products.map(product => {
                        return new Promise((resolve, reject) => {
                            // Get all sales and purchases for this product in the financial year
                            const productNameParam = encodeURIComponent(product.name);
                            const startDate = financialYear.start_date;
                            const endDate = financialYear.end_date;
                            
                            Promise.all([
                                // Get sales for this product in the financial year
                                new Promise((resolveS, rejectS) => {
                                    userDb.all(
                                        `SELECT * FROM sales WHERE 
                                         (financial_year_id = ? OR (financial_year_id IS NULL AND date >= ? AND date <= ?)) 
                                         AND productName = ?`,
                                        [req.query.financialYearId, startDate, endDate, product.name],
                                        (err, sales) => {
                                            if (err) rejectS(err);
                                            else resolveS(sales || []);
                                        }
                                    );
                                }),
                                // Get purchases for this product in the financial year
                                new Promise((resolveP, rejectP) => {
                                    userDb.all(
                                        `SELECT * FROM purchases WHERE 
                                         (financial_year_id = ? OR (financial_year_id IS NULL AND date >= ? AND date <= ?)) 
                                         AND productName = ?`,
                                        [req.query.financialYearId, startDate, endDate, product.name],
                                        (err, purchases) => {
                                            if (err) rejectP(err);
                                            else resolveP(purchases || []);
                                        }
                                    );
                                })
                            ])
                            .then(([sales, purchases]) => {
                                // Calculate current stock based on opening stock, sales and purchases
                                const totalSales = sales.reduce((sum, sale) => sum + (sale.supplyQty || 0), 0);
                                const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.receivedQty || 0), 0);
                                
                                // Update the product with calculated quantity
                                product.quantity = product.quantity + totalPurchases - totalSales;
                                resolve(product);
                            })
                            .catch(err => {
                                console.error(`Error calculating stock for ${product.name}:`, err);
                                // Still resolve with original product data
                                resolve(product);
                            });
                        });
                    });
                    
                    Promise.all(promises)
                        .then(updatedProducts => {
                            res.json(updatedProducts);
                            // Close the database connection
                            userDb.close(err => {
                                if (err) console.error('Error closing user database:', err);
                            });
                        })
                        .catch(err => {
                            console.error('Error calculating stock data:', err);
                            res.status(500).json({ error: 'Failed to calculate stock data' });
                            // Close the database connection
                            userDb.close(err => {
                                if (err) console.error('Error closing user database:', err);
                            });
                        });
                });
            } else {
                // Financial year not found, return regular stock data
                userDb.all(query, params, (err, products) => {
                    if (err) {
                        console.error('Error fetching stock data:', err);
                        return res.status(500).json({ error: 'Failed to fetch stock data' });
                    }
                    
                    res.json(products || []);
                    
                    // Close the database connection
                    userDb.close(err => {
                        if (err) console.error('Error closing user database:', err);
                    });
                });
            }
        });
    } else {
        // No financial year specified, return regular stock data
        userDb.all(query, params, (err, products) => {
            if (err) {
                console.error('Error fetching stock data:', err);
                return res.status(500).json({ error: 'Failed to fetch stock data' });
            }
            
            res.json(products || []);
            
            // Close the database connection
            userDb.close(err => {
                if (err) console.error('Error closing user database:', err);
            });
        });
    }
});

// Add handler for unexpected errors
app.use((err, req, res, next) => {
    console.error('Application error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Add server start code with error handling
function startServer(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port)
            .once('listening', () => {
                console.log(`Server running on port ${port}`);
                console.log(`Access the application at http://localhost:${port}`);
                resolve(server);
            })
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying next port...`);
                    reject(err);
                } else {
                    console.error('Server error:', err);
                    reject(err);
                }
            });
    });
}

// Try to start server with incrementing ports if needed
async function attemptServerStart() {
    let currentPort = PORT;
    const maxAttempts = 10;  // Try up to 10 ports
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const server = await startServer(currentPort);
            
            // Handle server shutdown gracefully
            process.on('SIGINT', () => {
                console.log('Shutting down server...');
                server.close(() => {
                    console.log('Server closed');
                    process.exit(0);
                });
            });
            
            return;  // Server started successfully
        } catch (err) {
            if (err.code === 'EADDRINUSE') {
                currentPort++;  // Try next port
            } else {
                console.error('Failed to start server:', err);
                process.exit(1);
            }
        }
    }
    
    console.error(`Could not find an available port after ${maxAttempts} attempts`);
    process.exit(1);
}

// Start the server
attemptServerStart();

// This ensures proper closure of any nested structures that might have been left open

// API to migrate old database to financial year-based structure
app.post('/api/migrate-data', isAuthenticated, (req, res) => {
    const username = req.session.username;
    
    // Start the migration process
    migrateUserData(username)
        .then(() => {
            res.json({ success: true, message: 'Data migration completed successfully' });
        })
        .catch(err => {
            console.error('Error during migration:', err);
            res.status(500).json({ error: 'Migration failed: ' + err.message });
        });
});

// API to get available financial years
app.get('/api/financial-years', isAuthenticated, (req, res) => {
    getFinancialYears()
        .then(years => {
            res.json(years);
        })
        .catch(err => {
            console.error('Error getting financial years:', err);
            res.status(500).json({ error: 'Failed to get financial years: ' + err.message });
        });
});

// API to create a new financial year
app.post('/api/financial-years', isAuthenticated, (req, res) => {
    const { id, label, start_date, end_date } = req.body;
    
    if (!id || !label || !start_date || !end_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    authDb.run(
        'INSERT INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
        [id, label, start_date, end_date],
        function(err) {
            if (err) {
                console.error('Error creating financial year:', err);
                return res.status(500).json({ error: 'Failed to create financial year: ' + err.message });
            }
            
            res.json({ 
                id, 
                label, 
                start_date, 
                end_date, 
                created_at: new Date().toISOString() 
            });
        }
    );
});

// API to select the current financial year
app.post('/api/set-current-financial-year', isAuthenticated, (req, res) => {
    const { financialYearId } = req.body;
    
    if (!financialYearId) {
        return res.status(400).json({ error: 'Missing financial year ID' });
    }
    
    // Check if the financial year exists
    authDb.get('SELECT * FROM financial_years WHERE id = ?', [financialYearId], (err, row) => {
        if (err) {
            console.error('Error checking financial year:', err);
            return res.status(500).json({ error: 'Failed to check financial year: ' + err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Financial year not found' });
        }
        
        // Store in session
        req.session.currentFinancialYear = financialYearId;
        
        res.json({ success: true, financialYear: row });
    });
});

// Request OTP for password reset
app.post('/api/request-otp', (req, res) => {
    console.log('Password reset requested for identifier:', req.body.identifier);
    
    const { identifier } = req.body;
    
    if (!identifier) {
        return res.status(400).json({ error: 'Username or email is required' });
    }
    
    // Find user by username or email
    console.log(`Auth DB SQL: SELECT * FROM users WHERE username = '${identifier}' OR email = '${identifier}'`);
    authDb.get('SELECT * FROM users WHERE username = ? OR email = ?', [identifier, identifier], (err, user) => {
        if (err) {
            console.error('Database error finding user:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.email) {
            console.log(`User ${user.username} has no email address`);
            return res.status(400).json({ error: 'User does not have an email address' });
        }
        
        // Generate OTP - always as a string
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Generated OTP for user ${user.username}: ${otp}`);
        
        // OTP expires in 10 minutes
        const currentTime = Date.now();
        const otpExpiry = currentTime + (10 * 60 * 1000); // 10 minutes in milliseconds
        
        console.log(`Auth DB SQL: UPDATE users SET otp = '${otp}', reset_token_expiry = ${otpExpiry} WHERE id = ${user.id}`);
        
        // Update user with OTP and expiry - ensure OTP is stored as a string
        authDb.run(
            'UPDATE users SET otp = ?, reset_token_expiry = ? WHERE id = ?',
            [otp.toString(), otpExpiry, user.id],
            function(err) {
                if (err) {
                    console.error('Database error updating OTP:', err.message);
                    return res.status(500).json({ error: 'Failed to generate OTP' });
                }
                
                // Send OTP via email
                const mailOptions = {
                    from: 'patidargastraders@gmail.com',
                    to: user.email,
                    subject: 'Password Reset OTP',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px;">
                            <h2 style="color: #4a4a4a; text-align: center;">Password Reset Request</h2>
                            <p>Hello ${user.username},</p>
                            <p>You requested to reset your password. Please use the following OTP (One-Time Password) to complete the process:</p>
                            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                                <h1 style="font-size: 32px; margin: 0; color: #0a6e81;">${otp}</h1>
                            </div>
                            <p>This OTP will expire in 10 minutes.</p>
                            <p>If you did not request this password reset, please ignore this email or contact support.</p>
                            <p style="text-align: center; margin-top: 30px; color: #777; font-size: 12px;">This is an automated message from Patidar Gas Traders.</p>
                        </div>
                    `
                };
                
                console.log(`Sending OTP email to ${user.email}`);
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Email sending error:', error);
                        return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
                    }
                    
                    console.log(`OTP email sent successfully: ${info.response}`);
                    res.json({ message: 'OTP sent successfully to your email' });
                });
            }
        );
    });
});

// Verify OTP only (without changing password)
app.post('/api/verify-otp-only', (req, res) => {
    const { identifier, otp } = req.body;
    
    console.log(`Verifying OTP only for identifier: ${identifier}, OTP: ${otp}`);
    
    if (!identifier || !otp) {
        console.log('Missing identifier or OTP');
        return res.status(400).json({ error: 'Identifier and OTP are required' });
    }
    
    // First check if user exists
    authDb.get('SELECT * FROM users WHERE username = ? OR email = ?', [identifier, identifier], (err, user) => {
        if (err) {
            console.error('Database error finding user:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            console.log('User not found with identifier:', identifier);
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log(`Found user: ${user.username}, id: ${user.id}, stored OTP: ${user.otp}, expiry: ${user.reset_token_expiry}, current time: ${Date.now()}`);
        
        // Now check OTP
        if (user.otp !== otp) {
            console.log(`OTP doesn't match. Provided: ${otp}, stored: ${user.otp}`);
            return res.status(400).json({ error: 'Invalid OTP' });
        }
        
        // Check if expired
        if (!user.reset_token_expiry || user.reset_token_expiry < Date.now()) {
            console.log(`OTP expired. Expiry: ${user.reset_token_expiry}, current time: ${Date.now()}`);
            return res.status(400).json({ error: 'OTP has expired' });
        }
        
        console.log(`OTP verified successfully for user ${user.username} (ID: ${user.id})`);
        
        // Return success response without updating password
        res.json({
            success: true,
            message: 'OTP verified successfully',
            username: user.username
        });
    });
});

// Reset password with verified OTP
app.post('/api/reset-password-with-otp', (req, res) => {
    const { identifier, otp, newPassword } = req.body;
    
    console.log(`Resetting password for identifier: ${identifier} with verified OTP`);
    
    if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ error: 'Identifier, OTP, and new password are required' });
    }
    
    // Find the user by username or email and verified OTP
    const query = 'SELECT * FROM users WHERE (username = ? OR email = ?) AND otp = ? AND reset_token_expiry > ?';
    authDb.get(query, [identifier, identifier, otp, Date.now()], (err, user) => {
        if (err) {
            console.error('Database error checking OTP for password reset:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            console.log(`Invalid or expired OTP for password reset: ${identifier}`);
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        console.log(`Valid OTP for password reset for user ${user.username}, updating password`);
        
        // Hash the new password with bcrypt
        const bcrypt = require('bcryptjs');
        bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Password hashing error:', err);
                return res.status(500).json({ error: 'Error processing password' });
            }
            
            // Update password and clear reset tokens and OTP
            const updateQuery = 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, otp = NULL WHERE id = ?';
            authDb.run(updateQuery, [hashedPassword, user.id], function(err) {
                if (err) {
                    console.error('Database error updating password:', err.message);
                    return res.status(500).json({ error: 'Failed to update password' });
                }
                
                console.log(`Password updated successfully for user ${user.username}`);
                res.json({ 
                    success: true, 
                    message: 'Password updated successfully' 
                });
            });
        });
    });
});

// Add a simple endpoint to get current user info for settings page
app.get('/api/user', isAuthenticated, (req, res) => {
    const query = `SELECT id, username, company_name as companyName, phone, email, address FROM users WHERE id = ?`;
    authDb.get(query, [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error getting user for settings:', err.message);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    });
});

// Add pagination for API endpoints
app.get('/api/data', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 100;
  const skip = (page - 1) * pageSize;
  
  try {
    const data = await DataModel.find()
      .skip(skip)
      .limit(pageSize)
      .lean(); // Returns plain JavaScript objects instead of Mongoose documents
      
    const total = await DataModel.countDocuments();
    
    res.json({
      data,
      pagination: {
        total,
        pages: Math.ceil(total / pageSize),
        page,
        pageSize
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add data streaming for large exports
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  const cursor = DataModel.find().cursor();
  
  res.write('[');
  let isFirst = true;
  
  cursor.on('data', (doc) => {
    if (!isFirst) res.write(',');
    else isFirst = false;
    res.write(JSON.stringify(doc));
  });
  
  cursor.on('end', () => {
    res.write(']');
    res.end();
  });
});

// Simpler caching implementation that does not require Redis
const inMemoryCache = new Map();

// In-memory cache middleware (simple, no Redis required)
const simpleCacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cachedData = inMemoryCache.get(key);
  
  // Check if we have cached data and it's not expired
  if (cachedData && cachedData.timestamp > Date.now() - 3600000) { // 1 hour expiry
    return res.json(cachedData.data);
  }
  
  // Otherwise, continue to the actual handler but capture the response
  const originalJson = res.json;
  res.json = function(data) {
    // Cache the response
    inMemoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Call the original json method
    return originalJson.call(this, data);
  };
  
  next();
};

// Apply simple cache to read-heavy routes
app.get('/api/dashboard-stats', simpleCacheMiddleware, (req, res) => {
  // Your dashboard stats logic here
  // This is just a placeholder
  res.json({ status: 'success', message: 'Stats retrieved' });
});

// Initialize database for a fresh deployment
app.post('/api/initialize-database', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        console.log(`Initializing database for user ${username}`);
        
        // Create an appropriate user directory
        const userDir = path.join(dbBaseDir, username);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        // Update user_dir in the users table
        await new Promise((resolve, reject) => {
            authDb.run('UPDATE users SET user_dir = ? WHERE username = ?', 
                [userDir, username], 
                function(err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        // Get or create current financial year
        let currentFY = await getCurrentFinancialYear();
        if (!currentFY) {
            const now = new Date();
            const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            const endYear = startYear + 1;
            
            const defaultFY = {
                id: `FY${startYear}-${endYear}`,
                label: `FY ${startYear}-${endYear}`,
                start_date: `${startYear}-04-01`,
                end_date: `${endYear}-03-31`
            };
            
            await new Promise((resolve, reject) => {
                authDb.run(
                    'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                    [defaultFY.id, defaultFY.label, defaultFY.start_date, defaultFY.end_date],
                    function(err) {
                        if (err) return reject(err);
                        console.log('Created default financial year:', defaultFY);
                        resolve();
                    }
                );
            });
            
            currentFY = defaultFY;
        }
        
        // Create user database for this financial year
        const dbPath = path.join(userDir, `${currentFY.id}.db`);
        console.log(`Creating user database at: ${dbPath}`);
        
        // Check if file already exists
        if (!fs.existsSync(dbPath)) {
            const userDb = new sqlite3.Database(dbPath);
            await initializeFinancialYearDatabaseSchema(userDb);
            console.log('Financial year database schema initialized');
            userDb.close();
        }
        
        res.json({ 
            success: true, 
            message: 'Database initialized successfully',
            userDir,
            financialYear: currentFY,
            dbPath
        });
    } catch (error) {
        console.error('Error initializing database:', error);
        res.status(500).json({ 
            error: 'Error initializing database', 
            message: error.message 
        });
    }
});