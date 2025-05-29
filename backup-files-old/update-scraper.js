const fs = require('fs');
const path = require('path');

// Function to update the review-scraper-crawlee-fixed.js file
function updateScraper() {
  try {
    console.log('Starting to update the scraper file...');
    
    // Read the original file
    const filePath = path.join(__dirname, 'review-scraper-crawlee-fixed.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Read the new ASDA handler
    const asdaHandlerPath = path.join(__dirname, 'asda-handler-no-fallbacks.js');
    const asdaHandler = fs.readFileSync(asdaHandlerPath, 'utf8');
    
    // Extract the handleAsdaSite function from the new file
    const functionRegex = /async function handleAsdaSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.asdaReviews;\n\}/;
    const asdaHandlerMatch = asdaHandler.match(functionRegex);
    
    if (!asdaHandlerMatch) {
      throw new Error('Could not extract handleAsdaSite function from the new file');
    }
    
    const newAsdaHandler = asdaHandlerMatch[0];
    
    // Find the existing handleAsdaSite function in the original file
    const originalFunctionRegex = /async function handleAsdaSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.asdaReviews;\n\}/;
    const originalAsdaHandlerMatch = content.match(originalFunctionRegex);
    
    if (!originalAsdaHandlerMatch) {
      throw new Error('Could not find handleAsdaSite function in the original file');
    }
    
    // Replace the function
    content = content.replace(originalFunctionRegex, newAsdaHandler);
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup.js');
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`Created backup at ${backupPath}`);
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the new ASDA handler`);
    
    console.log('Scraper file updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating scraper file: ${error.message}`);
    return false;
  }
}

// Run the update function
updateScraper();
