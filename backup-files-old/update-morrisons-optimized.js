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
    const morrisonsHandlerPath = path.join(__dirname, 'morrisons-handler-optimized.js');
    const morrisonsHandler = fs.readFileSync(morrisonsHandlerPath, 'utf8');
    
    // Create a backup of the original file
    const backupPath = path.join(__dirname, 'review-scraper-crawlee-fixed.backup5.js');
    fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    console.log(`Created backup at ${backupPath}`);
    
    // Update the debug message in the original file
    content = content.replace(
      'DEBUGGING: Using updated Morrisons handler with fixed star ratings',
      'DEBUGGING: Using optimized Morrisons handler with fixed star ratings'
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath} with the optimized Morrisons handler`);
    
    console.log('Morrisons handler updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating Morrisons handler: ${error.message}`);
    return false;
  }
}

// Run the update function
updateMorrisonsHandler();
