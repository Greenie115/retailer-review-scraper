const fs = require('fs');
const path = require('path');

// Function to update the review-scraper-crawlee-fixed.js file
function updateScraper() {
  try {
    console.log('Starting to update the scraper file...');
    
    // Read the original file
    const filePath = path.join(__dirname, 'review-scraper-crawlee-fixed.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup.js');
    fs.writeFileSync(backupPath, content);
    console.log(`Created backup at ${backupPath}`);
    
    // Replace headless: true with headless: false
    content = content.replace(/headless:\s*true/g, 'headless: false');
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} to run in non-headless mode`);
    
    console.log('Scraper file updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating scraper file: ${error.message}`);
    return false;
  }
}

// Run the update function
updateScraper();
