/**
 * Script to update all dashboard links in HTML files to point to user-dashboard.html
 */
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'public', 'pages');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Get all HTML files in both public and pages directories
const pageHtmlFiles = fs.readdirSync(PAGES_DIR)
  .filter(file => file.endsWith('.html'))
  .map(file => path.join(PAGES_DIR, file));
  
const publicHtmlFiles = fs.readdirSync(PUBLIC_DIR)
  .filter(file => file.endsWith('.html'))
  .map(file => path.join(PUBLIC_DIR, file));

const htmlFiles = [...pageHtmlFiles, ...publicHtmlFiles];

console.log(`Found ${htmlFiles.length} HTML files to update`);

let updatedCount = 0;

// Process each HTML file
htmlFiles.forEach(filePath => {
  const fileName = path.basename(filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Update links in the navigation
  const hrefRegex1 = /href=["'](\.\.\/pages\/|\/pages\/)?dashboard\.html["']/g;
  const hrefRegex2 = /href=["']dashboard\.html["']/g;
  
  content = content.replace(hrefRegex1, 'href="/pages/user-dashboard.html"');
  content = content.replace(hrefRegex2, 'href="/pages/user-dashboard.html"');
  
  // Replace text inside links as well to ensure consistency
  content = content.replace(/<i class="fas fa-tachometer-alt"><\/i>\s*Dashboard/g, '<i class="fas fa-tachometer-alt"></i> Dashboard');
  
  // Write the updated content back to the file if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
    console.log(`Updated ${fileName}`);
  } else {
    console.log(`No changes needed for ${fileName}`);
  }
});

console.log(`\nCompleted updating ${updatedCount} HTML files.`); 