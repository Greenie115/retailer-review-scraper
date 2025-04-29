const express = require('express');
const path = require('path');
const fs = require('fs');
const { scrapeReviews } = require('./review-scraper-crawlee-fixed'); // Import the fixed scraper function
const { generateCsvContent, addSiteTypeToReviews, addProductInfoToReviews } = require('./csv-exporter'); // Import CSV export utilities
const { deleteScreenshots } = require('./delete-screenshots'); // Import screenshot deletion utility

// Create a new Express app
const app = express();
const port = 3003; // Use a different port

// Middleware to parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Copy the route handler from server.js
app.post('/scrape', async (req, res) => {
  // Copy the implementation from server.js
  // ...
  res.send('Scraping functionality is temporarily disabled. Please use the original server.js file.');
});

// Start the server
app.listen(port, () => {
  console.log(`Test server listening at http://localhost:${port}`);
});
