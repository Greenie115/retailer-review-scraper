const fs = require('fs');
const path = require('path');

// Function to update the review-scraper-crawlee-fixed.js file
function updateSainsburysHandler() {
  try {
    console.log('Starting to update the Sainsbury\'s handler with deduplication...');
    
    // Read the original file
    const filePath = path.join(__dirname, 'review-scraper-crawlee-fixed.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Read the new Sainsbury's handler
    const sainsburysHandlerPath = path.join(__dirname, 'sainsburys-handler-deduped.js');
    const sainsburysHandler = fs.readFileSync(sainsburysHandlerPath, 'utf8');
    
    // Extract the handleSainsburysSite function from the new file
    const functionRegex = /async function handleSainsburysSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.sainsburysReviews;\n\}/;
    const sainsburysHandlerMatch = sainsburysHandler.match(functionRegex);
    
    if (!sainsburysHandlerMatch) {
      throw new Error('Could not extract handleSainsburysSite function from the new file');
    }
    
    const newSainsburysHandler = sainsburysHandlerMatch[0];
    
    // Find the existing handleSainsburysSite function in the original file
    const originalFunctionRegex = /async function handleSainsburysSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.sainsburysReviews;\n\}/;
    const originalSainsburysHandlerMatch = content.match(originalFunctionRegex);
    
    if (!originalSainsburysHandlerMatch) {
      throw new Error('Could not find handleSainsburysSite function in the original file');
    }
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup-sainsburys-deduped.js');
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`Created backup at ${backupPath}`);
    
    // Replace the function
    content = content.replace(originalFunctionRegex, newSainsburysHandler);
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the deduped Sainsbury's handler`);
    
    console.log('Sainsbury\'s handler updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating Sainsbury's handler: ${error.message}`);
    return false;
  }
}

// Run the update function
updateSainsburysHandler();
