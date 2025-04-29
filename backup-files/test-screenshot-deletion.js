const { deleteScreenshots } = require('./delete-screenshots');

console.log('Testing screenshot deletion...');
const deletedCount = deleteScreenshots();
console.log(`Test complete. Deleted ${deletedCount} screenshot files.`);
