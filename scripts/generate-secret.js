/**
 * Script to generate a secure random string for SESSION_SECRET
 * Run with: node scripts/generate-secret.js
 */

const crypto = require('crypto');

// Function to generate a secure random string
function generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
}

// Generate and output the secret
const secret = generateSecureSecret();
console.log('\n--- Secure Session Secret ---');
console.log(secret);
console.log('\nCopy this value and update your .env file:');
console.log('SESSION_SECRET=' + secret + '\n');

// Instructions for use
console.log('Add this to your .env file to enhance your application security.');
console.log('Remember not to share or commit this secret value to version control.\n'); 