const fs = require('fs');
const path = require('path');

// Files to remove
const filesToRemove = [
  // Backup files
  'review-scraper-crawlee-fixed.backup-asda-simplified.js',
  'review-scraper-crawlee-fixed.backup-asda-updated.js',
  'review-scraper-crawlee-fixed.backup-sainsburys-deduped.js',
  'review-scraper-crawlee-fixed.backup-sainsburys-fixed.js',
  'review-scraper-crawlee-fixed.backup-sainsburys-updated.js',
  'review-scraper-crawlee-fixed.backup-tesco-button-improved.js',
  'review-scraper-crawlee-fixed.backup-tesco-button.js',
  'review-scraper-crawlee-fixed.backup-tesco-direct.js',
  'review-scraper-crawlee-fixed.backup-tesco-fixed.js',
  'review-scraper-crawlee-fixed.backup-tesco-original.js',
  'review-scraper-crawlee-fixed.backup-tesco-wait.js',
  'review-scraper-crawlee-fixed.backup-tesco.js',
  'review-scraper-crawlee-fixed.backup.js',
  'review-scraper-crawlee-fixed.backup3.js',
  'review-scraper-crawlee-fixed.backup4.js',
  'review-scraper-crawlee-fixed.backup5.js',
  
  // Old handler files
  'asda-handler-fixed.js',
  'asda-handler-new.js',
  'asda-handler-no-fallbacks.js',
  'asda-handler-simplified.js',
  'asda-handler-updated.js',
  'asda-handler.js',
  'fixed-asda-handler.js',
  'morrisons-handler-final.js',
  'morrisons-handler-fixed.js',
  'morrisons-handler-new.js',
  'morrisons-handler-optimized.js',
  'morrisons-handler-ratings-fixed.js',
  'morrisons-handler-updated.js',
  'morrisons-handler.js',
  'sainsburys-handler-deduped.js',
  'sainsburys-handler-fixed.js',
  'sainsburys-handler-new.js',
  'sainsburys-handler-updated.js',
  'sainsburys-handler.js',
  'tesco-handler-button-fixed.js',
  'tesco-handler-button-improved.js',
  'tesco-handler-direct-navigation.js',
  'tesco-handler-fixed.js',
  'tesco-handler-new.js',
  'tesco-handler-original-page.js',
  'tesco-handler-updated.js',
  'tesco-handler-wait-for-reviews.js',
  'tesco-handler.js',
  
  // Old update scripts
  'update-asda-handler.js',
  'update-asda-simplified.js',
  'update-morrisons-final.js',
  'update-morrisons-handler.js',
  'update-morrisons-optimized.js',
  'update-morrisons-ratings.js',
  'update-sainsburys-deduped.js',
  'update-sainsburys-fixed.js',
  'update-sainsburys-handler.js',
  'update-scraper.js',
  'update-tesco-button-improved.js',
  'update-tesco-button.js',
  'update-tesco-direct.js',
  'update-tesco-fixed.js',
  'update-tesco-handler.js',
  'update-tesco-original.js',
  'update-tesco-wait.js',
  'update-ui.js',
  
  // Test files
  'test-asda-handler.js',
  'test-date-extractor.js',
  'test-delete-screenshots.js',
  'test-morrisons-direct.js',
  'test-morrisons-handler.js',
  'test-morrisons-simple.js',
  'test-screenshot-deletion.js',
  'test-server.js',
  'test-tesco-general.js',
  'test-tesco-reviews.js',
  
  // Outdated utility files
  'morrisons-date-extractor.js',
  'morrisons-date-fix.js',
  'morrisons-date-patch.js',
  'integrate-date-extractor.js',
  'fix-headless-mode.js',
  
  // Old server versions
  'server-combined.js',
  'server-fixed.js',
  'server-new.js',
  'simple-server.js',
  
  // Old scraper versions
  'review-scraper-crawlee.js',
  'review-scraper-fixed.js',
  'review-scraper.js',
  'puppeteer-review-scraper.js',
  
  // HTML/JSON debug files
  'asda-page-html-1745925572200.html',
  'asda-page-html-1745933235365.html',
  'sainsburys-page-html-1745928076214.html',
  'sainsburys-page-html-1745928508950.html',
  'sainsburys-page-html-1745933178378.html',
  'sainsburys-reviews-html.txt',
  'tesco-page-html-1745498615108.html',
  'tesco-page-html-1745838104410.html',
  'tesco-reviews-html.json',
  'tesco-reviews-info.json',
  'tesco-reviews.json',
  'morrisons-reviews-html.html',
  'morrisons-reviews.json',
  'morrisons-simple-results.json',
  
  // Unused files in public directory
  'public/index-new.html',
  'public/index.html.backup'
];

// Create a backup directory
const backupDir = path.join(__dirname, 'backup-files');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log(`Created backup directory: ${backupDir}`);
}

// Function to safely remove files
function cleanupFiles() {
  console.log('Starting cleanup process...');
  let removedCount = 0;
  let backupCount = 0;
  let errorCount = 0;
  
  filesToRemove.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    try {
      // Check if file exists
      if (fs.existsSync(fullPath)) {
        // Create backup
        const backupPath = path.join(backupDir, path.basename(filePath));
        fs.copyFileSync(fullPath, backupPath);
        backupCount++;
        
        // Remove the file
        fs.unlinkSync(fullPath);
        removedCount++;
        
        console.log(`Removed: ${filePath} (backed up to backup-files directory)`);
      } else {
        console.log(`Skipped: ${filePath} (file not found)`);
      }
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
      errorCount++;
    }
  });
  
  console.log('\nCleanup Summary:');
  console.log(`Total files processed: ${filesToRemove.length}`);
  console.log(`Files backed up: ${backupCount}`);
  console.log(`Files removed: ${removedCount}`);
  console.log(`Errors encountered: ${errorCount}`);
  console.log(`\nBackup files are stored in: ${backupDir}`);
  console.log('If you need to restore any files, you can find them in the backup directory.');
}

// Run the cleanup
cleanupFiles();
