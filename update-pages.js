/**
 * Script to update all HTML files to include common.js
 */
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'public', 'pages');

// Get all HTML files in the pages directory
const htmlFiles = fs.readdirSync(PAGES_DIR)
  .filter(file => file.endsWith('.html'));

console.log(`Found ${htmlFiles.length} HTML files to update`);

let updatedCount = 0;

// Process each HTML file
htmlFiles.forEach(fileName => {
  const filePath = path.join(PAGES_DIR, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if common.js is already included
  if (content.includes('common.js')) {
    console.log(`${fileName} already has common.js included.`);
    return;
  }
  
  // Check for the closing body tag
  if (!content.includes('</body>')) {
    console.log(`${fileName} does not have a proper </body> tag.`);
    return;
  }
  
  // Add auth.js if it's not already there
  let authScript = '';
  if (!content.includes('auth.js')) {
    authScript = '    <script src="../auth.js"></script>\n';
  }
  
  // Insert the scripts before the closing body tag
  const commonScript = `${authScript}    <script src="../common.js"></script>\n`;
  const jsFileName = fileName.replace('.html', '.js');
  
  // Check if we need to add the page's specific JS file
  let pageScript = '';
  if (fs.existsSync(path.join(PAGES_DIR, jsFileName)) && !content.includes(jsFileName)) {
    pageScript = `    <script src="${jsFileName}"></script>\n`;
  }
  
  // Replace the closing body tag with our scripts plus the closing tag
  const updatedContent = content.replace('</body>', `${commonScript}${pageScript}</body>`);
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  updatedCount++;
  console.log(`Updated ${fileName}`);
});

console.log(`\nCompleted updating ${updatedCount} HTML files.`); 