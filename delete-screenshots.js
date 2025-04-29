const fs = require('fs');
const path = require('path');

// Function to delete all screenshot files (PNG files)
function deleteScreenshots() {
  try {
    console.log('Starting deleteScreenshots function...');
    // Get all PNG files in the current directory
    const files = fs.readdirSync(__dirname);
    console.log(`Found ${files.length} files in directory`);
    let deletedCount = 0;
    
    // Filter for PNG files and delete them
    files.forEach(file => {
      if (file.toLowerCase().endsWith('.png')) {
        console.log(`Deleting file: ${file}`);
        const filePath = path.join(__dirname, file);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    
    console.log(`Successfully deleted ${deletedCount} screenshot files`);
    return deletedCount;
  } catch (error) {
    console.error(`Error deleting screenshots: ${error.message}`);
    return 0;
  }
}

// Export the function
module.exports = { deleteScreenshots };
