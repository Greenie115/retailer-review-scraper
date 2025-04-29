const fs = require('fs');
const path = require('path');

// Function to update the UI
function updateUI() {
  try {
    console.log('Starting to update the UI...');
    
    // Paths to the files
    const oldFilePath = path.join(__dirname, 'public', 'index.html');
    const newFilePath = path.join(__dirname, 'public', 'index-new.html');
    const backupPath = path.join(__dirname, 'public', 'index.html.backup');
    
    // Create a backup of the original file
    fs.copyFileSync(oldFilePath, backupPath);
    console.log(`Created backup at ${backupPath}`);
    
    // Replace the old file with the new one
    fs.copyFileSync(newFilePath, oldFilePath);
    console.log(`Updated ${oldFilePath} with the new UI`);
    
    console.log('UI updated successfully!');
    return true;
  } catch (error) {
    console.error(`Error updating UI: ${error.message}`);
    return false;
  }
}

// Run the update function
updateUI();
