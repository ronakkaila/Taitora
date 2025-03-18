/**
 * Script to add responsive.js to all HTML files
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
  
  // Check if responsive.js is already included
  if (content.includes('responsive.js')) {
    console.log(`${fileName} already has responsive.js included.`);
    return;
  }
  
  // Check for the closing body tag
  if (!content.includes('</body>')) {
    console.log(`${fileName} does not have a proper </body> tag.`);
    return;
  }
  
  // Add responsive.js script before the closing body tag
  // Make sure it's after common.js if it exists
  if (content.includes('common.js')) {
    content = content.replace('<script src="../common.js"></script>', 
      '<script src="../common.js"></script>\n    <script src="../responsive.js"></script>');
  } else {
    // Otherwise add it right before closing body tag
    content = content.replace('</body>', '    <script src="../responsive.js"></script>\n</body>');
  }
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  updatedCount++;
  console.log(`Updated ${fileName}`);
});

console.log(`\nCompleted updating ${updatedCount} HTML files.`); 