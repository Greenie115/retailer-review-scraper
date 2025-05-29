const fs = require('fs');
const path = require('path');

// Function to update the review-scraper-crawlee-fixed.js file
function updateMorrisonsHandler() {
  try {
    console.log('Starting to update the Morrisons handler...');
    
    // Read the original file
    const filePath = path.join(__dirname, 'review-scraper-crawlee-fixed.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Read the new Morrisons handler
    const morrisonsHandlerPath = path.join(__dirname, 'morrisons-handler-fixed.js');
    const morrisonsHandler = fs.readFileSync(morrisonsHandlerPath, 'utf8');
    
    // Extract the handleMorrisonsSite function from the new file
    const functionRegex = /async function handleMorrisonsSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.morrisonsReviews;\n\}/;
    const morrisonsHandlerMatch = morrisonsHandler.match(functionRegex);
    
    if (!morrisonsHandlerMatch) {
      throw new Error('Could not extract handleMorrisonsSite function from the new file');
    }
    
    const newMorrisonsHandler = morrisonsHandlerMatch[0];
    
    // Find the existing handleMorrisonsSite function in the original file
    const originalFunctionRegex = /async function handleMorrisonsSite\(page, siteConfig, maxReviews\) \{[\s\S]*?return global\.morrisonsReviews;\n\}/;
    const originalMorrisonsHandlerMatch = content.match(originalFunctionRegex);
    
    if (!originalMorrisonsHandlerMatch) {
      throw new Error('Could not find handleMorrisonsSite function in the original file');
    }
    
    // Replace the function
    content = content.replace(originalFunctionRegex, newMorrisonsHandler);
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup.js');
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`Created backup at ${backupPath}`);
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the new Morrisons handler`);
    
    console.log('Morrisons handler updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating Morrisons handler: ${error.message}`);
    return false;
  }
}

// Run the update function
updateMorrisonsHandler();
