const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
// const mongoose = require('mongoose');

// Load environment variables if not already loaded
if (!process.env.DB_BASE_DIR) {
    require('dotenv').config();
}

// Ensure database directories exist
const dbBaseDir = process.env.DB_BASE_DIR || path.join(__dirname, 'user_databases');
if (!fs.existsSync(dbBaseDir)) {
    fs.mkdirSync(dbBaseDir, { recursive: true });
}

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create temp_backups directory if it doesn't exist
const tempBackupsDir = path.join(__dirname, 'temp_backups');
if (!fs.existsSync(tempBackupsDir)) {
    fs.mkdirSync(tempBackupsDir, { recursive: true });
}

// Comment out or remove the mongoose-related code
// const mongoose = require('mongoose');
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   maxPoolSize: 100
// });

// Function to ensure columns exist in a table
function ensureColumnsExist(db, tableName, columnDefinitions) {
    return new Promise((resolve, reject) => {
        // First get the current columns in the table
        db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
            if (err) {
                console.error(`Error checking columns in ${tableName}:`, err);
                return reject(err);
            }
            
            const existingColumns = columns.map(col => col.name);
            const missingColumns = [];
            
            // Check which columns are missing
            Object.entries(columnDefinitions).forEach(([colName, colDef]) => {
                if (!existingColumns.includes(colName)) {
                    missingColumns.push(`ADD COLUMN ${colName} ${colDef}`);
                }
            });
            
            // If there are missing columns, add them
            if (missingColumns.length > 0) {
                console.log(`Adding missing columns to ${tableName}:`, missingColumns);
                
                // Run ALTER TABLE statements for each missing column
                const alterTablePromises = missingColumns.map(alterStatement => {
                    return new Promise((resolveAlter, rejectAlter) => {
                        db.run(`ALTER TABLE ${tableName} ${alterStatement}`, [], (err) => {
                            if (err) {
                                console.error(`Error adding column to ${tableName}:`, err);
                                return rejectAlter(err);
                            }
                            resolveAlter();
                        });
                    });
                });
                
                Promise.all(alterTablePromises)
                    .then(() => resolve())
                    .catch(err => reject(err));
            } else {
                resolve();
            }
        });
    });
}

// Create a shared database for user authentication
const authDbPath = process.env.AUTH_DB_PATH || path.join(__dirname, 'auth.db');
console.log('Initializing auth database:', authDbPath);

const authDb = new sqlite3.Database(authDbPath, (err) => {
    if (err) {
        console.error('Auth database connection error:', err);
    } else {
        console.log('Connected to auth database successfully');
        
        // Create users table
        authDb.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            company_name TEXT,
            phone TEXT,
            email TEXT UNIQUE,
            address TEXT,
            reset_token TEXT,
            reset_token_expiry INTEGER,
            otp TEXT,
            user_dir TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Auth database users table created/verified');
                
                // Check and add any missing columns
                const requiredColumns = {
                    'reset_token': 'TEXT',
                    'reset_token_expiry': 'INTEGER',
                    'otp': 'TEXT',
                    'user_dir': 'TEXT'
                };
                
                ensureColumnsExist(authDb, 'users', requiredColumns)
                    .then(() => {
                        console.log('User table schema is up to date');
                    })
                    .catch(err => {
                        console.error('Error updating user table schema:', err);
                    });
            }
        });
        
        // Create financial_years table in auth database
        authDb.run(`CREATE TABLE IF NOT EXISTS financial_years (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating financial_years table in auth database:', err);
            } else {
                console.log('Auth database financial_years table created/verified');
                
                // Check if any financial years exist, if not, create a default one
                authDb.get('SELECT COUNT(*) as count FROM financial_years', [], (err, row) => {
                    if (err) {
                        console.error('Error checking financial years:', err);
                        return;
                    }
                    
                    if (row && row.count === 0) {
                        // Create the first financial year based on current date
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
                        
                        // Determine the financial year based on current date
                        // If we're between January and March, we're in the previous year's financial year
                        const startYear = month >= 4 ? currentYear : currentYear - 1;
                        const endYear = startYear + 1;
                        
                        const defaultFY = {
                            id: `FY${startYear}-${endYear}`,
                            label: `FY ${startYear}-${endYear}`,
                            start_date: `${startYear}-04-01`,
                            end_date: `${endYear}-03-31`
                        };
                        
                        // Insert the default financial year
                        authDb.run(
                            'INSERT INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                            [defaultFY.id, defaultFY.label, defaultFY.start_date, defaultFY.end_date],
                            function(err) {
                                if (err) {
                                    console.error('Error creating default financial year:', err);
                                } else {
                                    console.log('Created default financial year:', defaultFY);
                                }
                            }
                        );
                    }
                    });
            }
        });
        
        // Create customer_rates table in auth database
        authDb.run(`CREATE TABLE IF NOT EXISTS customer_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            product_name TEXT NOT NULL,
            rate REAL DEFAULT 0,
            empty_rate REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(customer_name, product_name)
        )`, (err) => {
            if (err) {
                console.error('Error creating customer_rates table in auth database:', err);
            } else {
                console.log('Auth database customer_rates table created/verified');
            }
        });
    }
});

// Add debugging for database operations
authDb.on('trace', (sql) => {
    console.log('Auth DB SQL:', sql);
});

// Function to get all financial years
function getFinancialYears() {
    return new Promise((resolve, reject) => {
        authDb.all('SELECT * FROM financial_years ORDER BY start_date ASC', [], (err, rows) => {
            if (err) {
                console.error('Error fetching financial years:', err);
                return reject(err);
            }
            resolve(rows || []);
        });
    });
}

// Function to get current financial year
function getCurrentFinancialYear() {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
        
        authDb.get(
            'SELECT * FROM financial_years WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
            [today, today],
            (err, row) => {
                if (err) {
                    console.error('Error fetching current financial year:', err);
                    return reject(err);
                }
                
                if (row) {
                    resolve(row);
                } else {
                    // If no financial year is current, get the most recent one
                    authDb.get(
                        'SELECT * FROM financial_years ORDER BY end_date DESC LIMIT 1',
                        [],
                        (err, recentRow) => {
                            if (err) {
                                console.error('Error fetching recent financial year:', err);
                                return reject(err);
                            }
                            resolve(recentRow || null);
                        }
                    );
                }
            }
        );
    });
}

// Function to get a user-specific financial year database connection
function getUserDatabase(username, financialYearId = null) {
    return new Promise(async (resolve, reject) => {
        try {
            // First, get the user's directory path from the auth database
            const userRow = await new Promise((resolveUser, rejectUser) => {
                authDb.get('SELECT user_dir FROM users WHERE username = ?', [username], (err, row) => {
                    if (err) {
                        console.error('Error fetching user directory:', err);
                        return rejectUser(err);
                    }
                    
                    if (!row) {
                        return rejectUser(new Error('User not found'));
                    }
                    
                    resolveUser(row);
                });
            });

            // Get user directory, ensuring it's a path within our base directory
            let userDir = userRow.user_dir;
            
            // If user directory is null or absolute path from Windows environment
            if (!userDir || userDir.includes('\\') || userDir.includes(':')) {
                console.log(`User directory needs to be updated for ${username}, creating it now`);
                userDir = path.join(dbBaseDir, username);
                
                // Create directory for user
                if (!fs.existsSync(userDir)) {
                    fs.mkdirSync(userDir, { recursive: true });
                }
                
                // Update the auth database with the user's directory path
                await new Promise((resolveUpdate, rejectUpdate) => {
                    authDb.run('UPDATE users SET user_dir = ? WHERE username = ?', [userDir, username], function(err) {
                        if (err) {
                            console.error('Error updating user directory path:', err);
                            return rejectUpdate(err);
                        }
                        console.log(`Updated user directory for ${username} to ${userDir}`);
                        resolveUpdate();
                    });
                });
            }
            
            // If no specific financial year requested, use the current one
            if (!financialYearId) {
                try {
                    const fy = await getCurrentFinancialYear();
                    if (fy) {
                        financialYearId = fy.id;
                    } else {
                        // No financial year found, create a default one
                        const now = new Date();
                        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                        const endYear = startYear + 1;
                        
                        const defaultFY = {
                            id: `FY${startYear}-${endYear}`,
                            label: `FY ${startYear}-${endYear}`,
                            start_date: `${startYear}-04-01`,
                            end_date: `${endYear}-03-31`
                        };
                        
                        await new Promise((resolveInsert, rejectInsert) => {
                            authDb.run(
                                'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                                [defaultFY.id, defaultFY.label, defaultFY.start_date, defaultFY.end_date],
                                function(err) {
                                    if (err) return rejectInsert(err);
                                    console.log('Created default financial year:', defaultFY);
                                    resolveInsert();
                                }
                            );
                        });
                        
                        financialYearId = defaultFY.id;
                    }
                } catch (error) {
                    console.error('Error getting/creating financial year:', error);
                    return reject(error);
                }
                
                // If still no financial year (something went wrong), return error
                if (!financialYearId) {
                    return reject(new Error('No financial year available. Please create a financial year first.'));
                }
            }
            
            // Path to the financial year database
            const dbPath = path.join(userDir, `${financialYearId}.db`);
            
            // Check if the database file exists, create it if not
            const fileExists = fs.existsSync(dbPath);
            
            console.log(`Opening user database for ${username}, financial year ${financialYearId} at ${dbPath}`);
            
            // Create a new connection to the financial year database
            const userDb = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error(`Error connecting to database for ${username}, financial year ${financialYearId}:`, err);
                    return reject(err);
                }
                
                console.log(`Connected to database for ${username}, financial year ${financialYearId}`);
                
                // If the database was just created, initialize its schema
                if (!fileExists) {
                    console.log(`Initializing new financial year database for ${username}: ${financialYearId}`);
                    initializeFinancialYearDatabaseSchema(userDb)
                        .then(() => {
                            // Add financial year ID to database
                            userDb.financialYearId = financialYearId;
                            resolve(userDb);
                        })
                    .catch(reject);
                } else {
                    // Add financial year ID to database
                    userDb.financialYearId = financialYearId;
                    resolve(userDb);
                }
            });
            
            // Add debugging for user database operations
            userDb.on('trace', (sql) => {
                console.log(`User DB (${username}, FY ${financialYearId}) SQL:`, sql);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Create a new user with directory for financial year databases
function createUserDatabase(username) {
    return new Promise((resolve, reject) => {
        const userDir = path.join(dbBaseDir, username);
        
        // Create directory for user
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        console.log(`Created user directory for ${username} at ${userDir}`);
        
        // Update the auth database with the user's directory path
        authDb.run('UPDATE users SET user_dir = ? WHERE username = ?', [userDir, username], function(err) {
            if (err) {
                console.error('Error updating user directory path:', err);
                return reject(err);
            }
            
            // Get current financial year to create initial database
            getCurrentFinancialYear()
                .then(currentFY => {
                    if (!currentFY) {
                        // Create a default financial year if none exists
                        const now = new Date();
                        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Financial year in India starts in April
                        const endYear = startYear + 1;
                        
                        const defaultFY = {
                            id: `FY${startYear}-${endYear}`,
                            label: `FY ${startYear}-${endYear}`,
                            start_date: `${startYear}-04-01`,
                            end_date: `${endYear}-03-31`
                        };
                        
                        // Insert the default financial year
                        authDb.run(
                            'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                            [defaultFY.id, defaultFY.label, defaultFY.start_date, defaultFY.end_date],
                            function(err) {
                        if (err) {
                                    console.error('Error creating default financial year:', err);
                            return reject(err);
                        }
                        
                                console.log('Created default financial year:', defaultFY);
                                
                                // Now get the user database with this financial year
                                getUserDatabase(username, defaultFY.id)
                                    .then(userDb => resolve({ userDb, userDir }))
                                    .catch(reject);
                            }
                        );
                    } else {
                        // Use existing financial year
                        getUserDatabase(username, currentFY.id)
                            .then(userDb => resolve({ userDb, userDir }))
                            .catch(reject);
                    }
                })
                .catch(error => {
                    console.error('Error getting/creating financial year:', error);
                    reject(error);
                });
        });
    });
}

// Initialize the schema for a financial year database
function initializeFinancialYearDatabaseSchema(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                fullStock INTEGER DEFAULT 0,
                emptyStock INTEGER DEFAULT 0
            )`, (err) => {
                if (err) {
                    console.error('Error creating products table:', err);
                    return reject(err);
                }
                console.log('Products table created/verified');
                
                // Check if the fullStock and emptyStock columns exist, add them if they don't
                db.all(`PRAGMA table_info(products)`, [], (err, columns) => {
                    if (err) {
                        console.error('Error checking products table schema:', err);
                        return;
                    }
                    
                    const columnNames = columns.map(col => col.name);
                    
                    // Check if we need to add the new columns
                    const addFullStock = !columnNames.includes('fullStock');
                    const addEmptyStock = !columnNames.includes('emptyStock');
                    
                    if (addFullStock) {
                        db.run(`ALTER TABLE products ADD COLUMN fullStock INTEGER DEFAULT 0`, err => {
                            if (err) {
                                console.error('Error adding fullStock column:', err);
                            } else {
                                console.log('Added fullStock column to products table');
                                
                                // If the table has openingStock, migrate the data
                                if (columnNames.includes('openingStock')) {
                                    db.run(`UPDATE products SET fullStock = openingStock`, err => {
                                        if (err) {
                                            console.error('Error migrating openingStock to fullStock:', err);
                                        } else {
                                            console.log('Migrated openingStock data to fullStock');
                                        }
                                    });
                                }
                            }
                        });
                    }
                    
                    if (addEmptyStock) {
                        db.run(`ALTER TABLE products ADD COLUMN emptyStock INTEGER DEFAULT 0`, err => {
                            if (err) {
                                console.error('Error adding emptyStock column:', err);
                            } else {
                                console.log('Added emptyStock column to products table');
                            }
                        });
                    }
                });
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
                container TEXT
            )`, (err) => {
                if (err) {
                    console.error('Error creating sales table:', err);
                    return reject(err);
                }
                console.log('Sales table created/verified');
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
                container TEXT
            )`, (err) => {
                if (err) {
                    console.error('Error creating purchases table:', err);
                    return reject(err);
                }
                console.log('Purchases table created/verified');
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
                if (err) {
                    console.error('Error creating stock_movements table:', err);
                    return reject(err);
                }
                console.log('Stock movements table created/verified');
            });

            db.run(`CREATE TABLE IF NOT EXISTS transporters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mobile TEXT,
                address TEXT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating transporters table:', err);
                    return reject(err);
                }
                console.log('Transporters table created/verified');
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
                if (err) {
                    console.error('Error creating accounts table:', err);
                    return reject(err);
                }
                console.log('Accounts table created/verified');
            });
            
            // Create invoice counters table
            db.run(`CREATE TABLE IF NOT EXISTS invoice_counters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sales_counter INTEGER DEFAULT 1,
                purchase_counter INTEGER DEFAULT 1
            )`, (err) => {
                if (err) {
                    console.error('Error creating invoice_counters table:', err);
                    return reject(err);
                }
                console.log('Invoice counters table created/verified');
                
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
                                return;
                            }
                            console.log('Default invoice counters inserted');
                        });
                    }
                });
            });

            // Create opening_stock table
            db.run(`CREATE TABLE IF NOT EXISTS opening_stock (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER,
                product_name TEXT,
                quantity INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating opening_stock table:', err);
                    return reject(err);
                }
                console.log('Opening stock table created/verified');
            });

            // Resolve once all tables have been created
            resolve();
        });
    });
}

// Function to migrate data from old user database to financial year based databases
function migrateUserData(username) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get the user's directory
            const userRow = await new Promise((resolveUser, rejectUser) => {
                authDb.get('SELECT user_dir FROM users WHERE username = ?', [username], (err, row) => {
                    if (err) return rejectUser(err);
                    if (!row) return rejectUser(new Error('User not found'));
                    resolveUser(row);
                });
            });
            
            const userDir = userRow.user_dir;
            const oldDbPath = path.join(userDir, 'user_data.db');
            
            // Check if old database exists
            if (!fs.existsSync(oldDbPath)) {
                console.log(`No old database found for ${username}, skipping migration`);
                return resolve();
            }
            
            console.log(`Migrating data for ${username} from ${oldDbPath}`);
            
            // Open the old database
            const oldDb = new sqlite3.Database(oldDbPath, sqlite3.OPEN_READONLY);
            
            // Get all financial years from the old database
            const financialYears = await new Promise((resolveFY, rejectFY) => {
                oldDb.all('SELECT * FROM financial_years ORDER BY start_date ASC', [], (err, rows) => {
                    if (err) return rejectFY(err);
                    resolveFY(rows || []);
                });
            });
            
            // If no financial years, create a default one
            if (financialYears.length === 0) {
                const now = new Date();
                const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                const endYear = startYear + 1;
                
                financialYears.push({
                    id: `FY${startYear}-${endYear}`,
                    label: `FY ${startYear}-${endYear}`,
                    start_date: `${startYear}-04-01`,
                    end_date: `${endYear}-03-31`
                });
                
                // Insert the financial year into auth database
                await new Promise((resolveInsert, rejectInsert) => {
                    authDb.run(
                        'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                        [financialYears[0].id, financialYears[0].label, financialYears[0].start_date, financialYears[0].end_date],
                        function(err) {
                            if (err) return rejectInsert(err);
                            resolveInsert();
                        }
                    );
                });
        } else {
                // Insert all financial years into the auth database
                for (const fy of financialYears) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        authDb.run(
                            'INSERT OR IGNORE INTO financial_years (id, label, start_date, end_date) VALUES (?, ?, ?, ?)',
                            [fy.id, fy.label, fy.start_date, fy.end_date],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
            }
            
            // Get all products from old database
            const products = await new Promise((resolveProducts, rejectProducts) => {
                oldDb.all('SELECT * FROM products', [], (err, rows) => {
                    if (err) return rejectProducts(err);
                    resolveProducts(rows || []);
                });
            });
            
            // Get all accounts from old database
            const accounts = await new Promise((resolveAccounts, rejectAccounts) => {
                oldDb.all('SELECT * FROM accounts', [], (err, rows) => {
                    if (err) return rejectAccounts(err);
                    resolveAccounts(rows || []);
                });
            });
            
            // Get all transporters from old database
            const transporters = await new Promise((resolveTransporters, rejectTransporters) => {
                oldDb.all('SELECT * FROM transporters', [], (err, rows) => {
                    if (err) return rejectTransporters(err);
                    resolveTransporters(rows || []);
                });
            });
            
            // For each financial year, create a database and migrate the data
            for (const fy of financialYears) {
                const newDbPath = path.join(userDir, `${fy.id}.db`);
                
                // Check if the database already exists
                if (fs.existsSync(newDbPath)) {
                    console.log(`Financial year database ${newDbPath} already exists, skipping`);
                    continue;
                }
                
                // Create the new database
                const newDb = new sqlite3.Database(newDbPath);
                
                // Initialize the schema
                await initializeFinancialYearDatabaseSchema(newDb);
                
                // Migrate products
                for (const product of products) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            'INSERT INTO products (id, name, description, fullStock, emptyStock) VALUES (?, ?, ?, ?, ?)',
                            [product.id, product.name, product.description, product.fullStock, product.emptyStock],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Migrate accounts
                for (const account of accounts) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            'INSERT INTO accounts (id, name, mobile, email, address, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [account.id, account.name, account.mobile, account.email, account.address, account.details, account.created_at],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Migrate transporters
                for (const transporter of transporters) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            'INSERT INTO transporters (id, name, mobile, address, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [transporter.id, transporter.name, transporter.mobile, transporter.address, transporter.details, transporter.created_at],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Get sales for this financial year from old database
                const sales = await new Promise((resolveSales, rejectSales) => {
                    oldDb.all(
                        'SELECT * FROM sales WHERE financial_year_id = ? OR (date >= ? AND date <= ?)',
                        [fy.id, fy.start_date, fy.end_date],
                        (err, rows) => {
                            if (err) return rejectSales(err);
                            resolveSales(rows || []);
                        }
                    );
                });
                
                // Migrate sales
                for (const sale of sales) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            `INSERT INTO sales (
                                id, invoiceNo, date, accountName, shipToAddress, productName, 
                                supplyQty, receivedQty, transporterName, transporterFare, 
                                paymentOption, remark, container
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                sale.id, sale.invoiceNo, sale.date, sale.accountName, sale.shipToAddress, 
                                sale.productName, sale.supplyQty, sale.receivedQty, sale.transporterName, 
                                sale.transporterFare, sale.paymentOption, sale.remark, sale.container
                            ],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Get purchases for this financial year from old database
                const purchases = await new Promise((resolvePurchases, rejectPurchases) => {
                    oldDb.all(
                        'SELECT * FROM purchases WHERE financial_year_id = ? OR (date >= ? AND date <= ?)',
                        [fy.id, fy.start_date, fy.end_date],
                        (err, rows) => {
                            if (err) return rejectPurchases(err);
                            resolvePurchases(rows || []);
                        }
                    );
                });
                
                // Migrate purchases
                for (const purchase of purchases) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            `INSERT INTO purchases (
                                id, invoiceNo, date, accountName, shipToAddress, productName, 
                                supplyQty, receivedQty, transporterName, transporterFare, 
                                paymentOption, remark, container
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                purchase.id, purchase.invoiceNo, purchase.date, purchase.accountName, purchase.shipToAddress, 
                                purchase.productName, purchase.supplyQty, purchase.receivedQty, purchase.transporterName, 
                                purchase.transporterFare, purchase.paymentOption, purchase.remark, purchase.container
                            ],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Get opening stock for this financial year from old database
                const openingStock = await new Promise((resolveStock, rejectStock) => {
                    oldDb.all(
                        'SELECT * FROM opening_stock WHERE financial_year_id = ?',
                        [fy.id],
                        (err, rows) => {
                            if (err) return rejectStock(err);
                            resolveStock(rows || []);
                        }
                    );
                });
                
                // Migrate opening stock
                for (const stock of openingStock) {
                    await new Promise((resolveInsert, rejectInsert) => {
                        newDb.run(
                            'INSERT INTO opening_stock (product_id, product_name, quantity, created_at) VALUES (?, ?, ?, ?)',
                            [stock.product_id, stock.product_name, stock.quantity, stock.created_at],
                            err => {
                                if (err) return rejectInsert(err);
                                resolveInsert();
                            }
                        );
                    });
                }
                
                // Get invoice counters for this financial year
                const counters = await new Promise((resolveCounters, rejectCounters) => {
                    oldDb.get(
                        'SELECT * FROM invoice_counters WHERE financial_year_id = ?',
                        [fy.id],
                        (err, row) => {
                            if (err) return rejectCounters(err);
                            resolveCounters(row || { sales_counter: 1, purchase_counter: 1 });
                        }
                    );
                });
                
                // Set invoice counters
                await new Promise((resolveInsert, rejectInsert) => {
                    newDb.run(
                        'INSERT INTO invoice_counters (sales_counter, purchase_counter) VALUES (?, ?)',
                        [counters.sales_counter, counters.purchase_counter],
                        err => {
                            if (err) return rejectInsert(err);
                            resolveInsert();
                        }
                    );
                });
                
                // Close the new database
                await new Promise(resolve => newDb.close(resolve));
                console.log(`Migrated data to ${newDbPath}`);
            }
            
            // Close the old database
            await new Promise(resolve => oldDb.close(resolve));
            
            // Rename the old database as backup
            const backupPath = `${oldDbPath}.bak`;
            fs.renameSync(oldDbPath, backupPath);
            console.log(`Backed up old database to ${backupPath}`);
            
            resolve();
        } catch (error) {
            console.error('Error during migration:', error);
            reject(error);
        }
    });
}

// Function to get all databases for a user
function getAllUserDatabases(username) {
    return new Promise(async (resolve, reject) => {
        try {
            // First, get user directory
            const userRow = await new Promise((resolveUser, rejectUser) => {
                authDb.get('SELECT user_dir FROM users WHERE username = ?', [username], (err, row) => {
                    if (err) return rejectUser(err);
                    if (!row) return rejectUser(new Error('User not found'));
                    resolveUser(row);
                });
            });
            
            const userDir = userRow.user_dir;
            
            // Get all financial years
            const financialYears = await getFinancialYears();
            
            // Map each financial year to a database connection
            const databases = {};
            
            for (const fy of financialYears) {
                const dbPath = path.join(userDir, `${fy.id}.db`);
                
                // Check if the database file exists
                if (fs.existsSync(dbPath)) {
                    // Store the path for later use
                    databases[fy.id] = { 
                        path: dbPath, 
                        fy,
                        name: fy.label
                    };
                }
            }
            
            // If no databases found, check for a main database file
            if (Object.keys(databases).length === 0) {
                const mainDbPath = path.join(userDir, 'user.db');
                if (fs.existsSync(mainDbPath)) {
                    databases['main'] = { 
                        path: mainDbPath,
                        name: 'Main Database'
                    };
                }
            }
            
            resolve(databases);
        } catch (err) {
            console.error('Error getting all user databases:', err);
            reject(err);
        }
    });
}

// Function to create backup of user databases
function backupUserDatabases(username, backupPath) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get all user databases
            const databases = await getAllUserDatabases(username);
            
            if (Object.keys(databases).length === 0) {
                return reject(new Error('No databases found to backup'));
            }
            
            // If there's an existing file, remove it
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
            }
            
            // Create a new backup database file
            const backupDb = new sqlite3.Database(backupPath);
            
            // Create metadata table
            await new Promise((resolveMeta, rejectMeta) => {
                backupDb.run(`
                    CREATE TABLE backup_meta (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )
                `, (err) => {
                    if (err) return rejectMeta(err);
                    resolveMeta();
                });
            });
            
            // Store backup metadata
            await new Promise((resolveMeta, rejectMeta) => {
                backupDb.run(`
                    INSERT INTO backup_meta (key, value) VALUES
                    ('username', ?),
                    ('backup_date', ?),
                    ('version', '1.0')
                `, [username, new Date().toISOString()], (err) => {
                    if (err) return rejectMeta(err);
                    resolveMeta();
                });
            });
            
            // Create database info table
            await new Promise((resolveTable, rejectTable) => {
                backupDb.run(`
                    CREATE TABLE backup_databases (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        financial_year_id TEXT,
                        file_name TEXT
                    )
                `, (err) => {
                    if (err) return rejectTable(err);
                    resolveTable();
                });
            });
            
            // For each database, attach it to the backup database
            for (const [id, db] of Object.entries(databases)) {
                if (!fs.existsSync(db.path)) {
                    console.warn(`Database file ${db.path} doesn't exist, skipping`);
                    continue;
                }
                
                try {
                    // Store database info
                    await new Promise((resolveInfo, rejectInfo) => {
                        backupDb.run(`
                            INSERT INTO backup_databases (id, name, financial_year_id, file_name)
                            VALUES (?, ?, ?, ?)
                        `, [
                            id,
                            db.name || 'Unknown',
                            db.fy?.id || null,
                            path.basename(db.path)
                        ], (err) => {
                            if (err) return rejectInfo(err);
                            resolveInfo();
                        });
                    });
                    
                    // Copy all tables from the source database
                    // First, attach the source database
                    await new Promise((resolveAttach, rejectAttach) => {
                        // SQLite identifiers can't contain hyphens, replace them with underscores
                        const safeId = id.replace(/-/g, '_');
                        backupDb.run(`ATTACH DATABASE '${db.path}' AS db_${safeId}`, (err) => {
                            if (err) return rejectAttach(err);
                            resolveAttach();
                        });
                    });
                    
                    // Get list of tables from the source database
                    const tables = await new Promise((resolveTables, rejectTables) => {
                        // Use the safe ID here too
                        const safeId = id.replace(/-/g, '_');
                        backupDb.all(`SELECT name FROM db_${safeId}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, [], (err, rows) => {
                            if (err) return rejectTables(err);
                            resolveTables(rows.map(row => row.name));
                        });
                    });
                    
                    // Create a namespace for this database's tables using the financial year ID or 'main'
                    const namespace = id;
                    
                    // For each table, create a copy in the backup database with a prefixed name
                    for (const table of tables) {
                        // Create the destination table
                        await new Promise((resolveCreate, rejectCreate) => {
                            // Use the safe ID here too
                            const safeId = id.replace(/-/g, '_');
                            backupDb.run(`CREATE TABLE IF NOT EXISTS ${namespace}_${table} AS SELECT * FROM db_${safeId}.${table}`, (err) => {
                                if (err) return rejectCreate(err);
                                resolveCreate();
                            });
                        });
                    }
                    
                    // Detach the source database
                    await new Promise((resolveDetach, rejectDetach) => {
                        // Use the safe ID here too
                        const safeId = id.replace(/-/g, '_');
                        backupDb.run(`DETACH DATABASE db_${safeId}`, (err) => {
                            if (err) return rejectDetach(err);
                            resolveDetach();
                        });
                    });
                } catch (err) {
                    console.error(`Error backing up database ${id}:`, err);
                }
            }
            
            // Close the backup database
            await new Promise((resolveClose) => {
                backupDb.close((err) => {
                    if (err) console.error('Error closing backup database:', err);
                    resolveClose();
                });
            });
            
            resolve({ path: backupPath, databases });
        } catch (err) {
            console.error('Error backing up user databases:', err);
            reject(err);
        }
    });
}

module.exports = {
    authDb,
    getUserDatabase,
    createUserDatabase,
    migrateUserData,
    getAllUserDatabases,
    getFinancialYears,
    getCurrentFinancialYear,
    backupUserDatabases
};