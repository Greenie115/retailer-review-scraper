const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { handleMorrisonsSite } = require('./checkpoint/morrisons-handler-new');
const { handleSainsburysSite } = require('./checkpoint/sainsburys-handler-new');

const app = express();
const port = 3002; // Different from the main server port

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint to scrape reviews using a visible browser
app.post('/scrape-with-visible-browser', async (req, res) => {
  const { url, retailer } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  console.log(`Starting visible browser scraping for ${url} (${retailer})`);
  
  let browser;
  try {
    // Launch a visible browser
    browser = await puppeteer.launch({
      headless: false, // Use a visible browser
      defaultViewport: null, // Use default viewport size
      args: [
        '--start-maximized', // Start with maximized window
        '--disable-features=site-per-process', // Disable site isolation
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Set extra HTTP headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    
    // Create a custom logger
    const log = {
      info: (message) => console.log(`INFO: ${message}`),
      warning: (message) => console.warn(`WARNING: ${message}`),
      error: (message) => console.error(`ERROR: ${message}`)
    };
    
    // Navigate to the URL
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the page to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `local-browser-${retailer}-${Date.now()}.png` });
    
    let reviews = [];
    
    // Use the appropriate handler based on the retailer
    if (retailer === 'morrisons') {
      console.log('Using Morrisons handler');
      reviews = await handleMorrisonsSite(page, { log });
    } else if (retailer === 'sainsburys') {
      console.log('Using Sainsburys handler');
      reviews = await handleSainsburysSite(page, { log });
    } else {
      throw new Error(`Unsupported retailer: ${retailer}`);
    }
    
    console.log(`Extracted ${reviews.length} reviews from ${retailer} site`);
    
    // Close the browser
    await browser.close();
    
    // Return the reviews
    res.status(200).json({ 
      success: true, 
      reviews,
      count: reviews.length,
      url,
      retailer
    });
    
  } catch (error) {
    console.error(`Error scraping with visible browser: ${error.message}`);
    console.error(error.stack);
    
    // Make sure to close the browser if it's open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(`Error closing browser: ${closeError.message}`);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      url,
      retailer
    });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Local browser service listening on port ${port}`);
  console.log(`Local URL: http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
