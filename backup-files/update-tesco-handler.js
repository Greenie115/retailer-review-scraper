const fs = require('fs');
const path = require('path');

// Function to update the review-scraper-crawlee-fixed.js file
function updateTescoHandler() {
  try {
    console.log('Starting to update the Tesco handler...');
    
    // Read the original file
    const filePath = path.join(__dirname, 'review-scraper-crawlee-fixed.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Read the new Tesco handler
    const tescoHandlerPath = path.join(__dirname, 'tesco-handler-updated.js');
    const tescoHandler = fs.readFileSync(tescoHandlerPath, 'utf8');
    
    // Extract the handleTescoSite function from the new file
    const functionRegex = /async function handleTescoSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.tescoReviews;\n\}/;
    const tescoHandlerMatch = tescoHandler.match(functionRegex);
    
    if (!tescoHandlerMatch) {
      throw new Error('Could not extract handleTescoSite function from the new file');
    }
    
    const newTescoHandler = tescoHandlerMatch[0];
    
    // Find the existing handleTescoSite function in the original file
    const originalFunctionRegex = /async function handleTescoSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.tescoReviews;\n\}/;
    const originalTescoHandlerMatch = content.match(originalFunctionRegex);
    
    if (!originalTescoHandlerMatch) {
      throw new Error('Could not find handleTescoSite function in the original file');
    }
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup-tesco.js');
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`Created backup at ${backupPath}`);
    
    // Replace the function
    content = content.replace(originalFunctionRegex, newTescoHandler);
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the new Tesco handler`);
    
    console.log('Tesco handler updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating Tesco handler: ${error.message}`);
    return false;
  }
}

// Run the update function
updateTescoHandler();
