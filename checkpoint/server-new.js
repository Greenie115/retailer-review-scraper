const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { scrapeReviews, saveReviewsToCsv } = require('./review-scraper');

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/scrape', async (req, res) => {
  console.log('Received scrape request with body:', req.body);
  
  try {
    // Get product URLs from the form
    const productUrls = req.body.productUrls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    // Get date range from the form
    const dateFrom = req.body.dateFrom || '';
    const dateTo = req.body.dateTo || '';
    
    console.log(`Received scrape request for ${productUrls.length} URLs`);
    
    if (productUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }
    
    // Create a timestamp for the CSV file
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const csvFilePath = path.join(__dirname, 'output', `reviews_${timestamp}.csv`);
    
    // Start processing URLs
    console.log(`Starting to process ${productUrls.length} URLs...`);
    
    // Array to store all reviews
    const allReviews = [];
    
    // Process each URL
    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      console.log(`Starting scraper for URL ${i+1}/${productUrls.length}: ${url}`);
      
      // Scrape reviews for this URL
      const reviews = await scrapeReviews(url, { dateFrom, dateTo });
      
      // Add reviews to the combined array
      if (reviews && reviews.length > 0) {
        allReviews.push(...reviews);
        console.log(`Added ${reviews.length} reviews from ${url}`);
      } else {
        console.log(`No reviews found for ${url}`);
      }
    }
    
    // Save all reviews to a single CSV file
    if (allReviews.length > 0) {
      await saveReviewsToCsv(allReviews, csvFilePath);
      console.log(`Saved ${allReviews.length} reviews to ${csvFilePath}`);
      
      // Send the CSV file as a download
      res.download(csvFilePath, path.basename(csvFilePath), (err) => {
        if (err) {
          console.error(`Error sending CSV file: ${err.message}`);
        }
      });
    } else {
      res.status(404).json({ error: 'No reviews found for any of the provided URLs' });
    }
  } catch (error) {
    console.error(`Error processing request: ${error.message}\n${error.stack}`);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Review scraper server listening at http://localhost:${port}`);
});
