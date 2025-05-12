const express = require('express');
const path = require('path');
const { scrapeReviews } = require('./review-scraper-integrated');
const urlUtils = require('./url-utils');

// Create a simple test server
const app = express();
const port = 3003;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test endpoint for scraping a single URL
app.post('/test-scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  console.log(`Testing scraper with URL: ${url}`);
  
  try {
    // Detect retailer
    const retailer = urlUtils.detectRetailerFromUrl(url);
    console.log(`Detected retailer: ${retailer}`);
    
    // Scrape reviews
    console.log('Starting scraper...');
    const reviews = await scrapeReviews(url);
    console.log(`Scraper finished, found ${reviews.length} reviews`);
    
    // Return the results
    res.json({
      success: true,
      retailer,
      url,
      reviewCount: reviews.length,
      reviews: reviews.slice(0, 5) // Return only the first 5 reviews to keep the response size manageable
    });
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  console.log('To test the integrated scraper, send a POST request to /test-scrape with a URL in the request body');
  console.log('Example using curl:');
  console.log('curl -X POST -H "Content-Type: application/json" -d \'{"url":"https://groceries.morrisons.com/products/market-street-deli-thickly-sliced-wiltshire-cured-ham/111543577"}\' http://localhost:3003/test-scrape');
  console.log('\nOr open http://localhost:3003 in your browser and use the web interface');
});
