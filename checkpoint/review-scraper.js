const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

// Import retailer-specific handlers
const { handleTescoSite } = require('./tesco-handler-new');
const { handleSainsburysSite } = require('./sainsburys-handler-new');
const { handleAsdaSite } = require('./asda-handler-new');
const { handleMorrisonsSite } = require('./morrisons-handler-new');

// Global arrays to store reviews for each retailer
global.tescoReviews = [];
global.sainsburysReviews = [];
global.asdaReviews = [];
global.morrisonsReviews = [];

// Main function to scrape reviews
async function scrapeReviews(url, options = {}) {
  const log = options.log || console;
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);
  
  // Create a browser instance
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    // Create a new page
    const page = await browser.newPage();
    
    // Navigate to the URL
    log.info(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log.info(`Page loaded: ${url}`);
    
    // Extract reviews from the page
    log.info(`Extracting reviews from ${url}...`);
    
    // Determine which retailer's site we're on
    const retailer = detectRetailer(url);
    log.info(`Detected retailer: ${retailer}`);
    
    let reviews = [];
    
    // Use the appropriate handler based on the retailer
    if (retailer === 'tesco') {
      log.info('Using Tesco specific handler');
      reviews = await handleTescoSite(page, { log });
    } else if (retailer === 'sainsburys') {
      log.info('Using Sainsbury\'s specific handler');
      reviews = await handleSainsburysSite(page, { log });
    } else if (retailer === 'asda') {
      log.info('Using ASDA specific handler');
      reviews = await handleAsdaSite(page, { log });
    } else if (retailer === 'morrisons') {
      log.info('Using Morrisons specific handler');
      reviews = await handleMorrisonsSite(page, { log });
    } else {
      log.warning(`Unknown retailer for URL: ${url}, using generic approach`);
      // Use a generic approach for unknown retailers
      reviews = await extractGenericReviews(page, { log });
    }
    
    // Add source URL to each review
    reviews.forEach(review => {
      review.sourceUrl = url;
    });
    
    // Filter reviews by date if date range is provided
    if (options.dateFrom || options.dateTo) {
      reviews = filterReviewsByDate(reviews, options.dateFrom, options.dateTo);
      log.info(`Filtered to ${reviews.length} reviews within date range`);
    }
    
    return reviews;
  } catch (error) {
    log.error(`Error scraping reviews: ${error.message}\n${error.stack}`);
    return [];
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Function to detect the retailer based on the URL
function detectRetailer(url) {
  if (url.includes('tesco.com')) {
    return 'tesco';
  } else if (url.includes('sainsburys.co.uk')) {
    return 'sainsburys';
  } else if (url.includes('asda.com')) {
    return 'asda';
  } else if (url.includes('morrisons.com')) {
    return 'morrisons';
  } else {
    return 'unknown';
  }
}

// Generic function to extract reviews from any site
async function extractGenericReviews(page, options = {}) {
  const log = options.log || console;
  log.info('Using generic review extraction method');
  
  try {
    // Look for common review containers
    const reviews = await page.evaluate(() => {
      const results = [];
      
      // Try to find review containers using common selectors
      const reviewContainers = document.querySelectorAll('.review, .product-review, [class*="review"], [id*="review"], [data-testid*="review"]');
      console.log(`Found ${reviewContainers.length} review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating
          let rating = '5'; // Default to 5 stars
          const ratingElement = container.querySelector('.rating, .stars, [class*="rating"], [class*="stars"]');
          if (ratingElement) {
            const ratingText = ratingElement.textContent.trim();
            const ratingMatch = ratingText.match(/\d+/);
            if (ratingMatch) {
              rating = ratingMatch[0];
            }
          }
          
          // Extract title
          let title = '';
          const titleElement = container.querySelector('.title, .review-title, h3, h4, [class*="title"]');
          if (titleElement) {
            title = titleElement.textContent.trim();
          }
          
          // Extract date
          let date = '';
          const dateElement = container.querySelector('.date, .review-date, time, [class*="date"]');
          if (dateElement) {
            date = dateElement.textContent.trim();
          }
          
          // Extract review text
          let text = '';
          const textElement = container.querySelector('.text, .review-text, .content, p, [class*="text"], [class*="content"]');
          if (textElement) {
            text = textElement.textContent.trim();
          }
          
          // Only add if we have meaningful text
          if (text) {
            results.push({ rating, title, date, text });
          }
        } catch (e) {
          console.error('Error processing review container:', e);
        }
      }
      
      return results;
    });
    
    log.info(`Extracted ${reviews.length} reviews using generic method`);
    return reviews;
  } catch (error) {
    log.error(`Error in generic review extraction: ${error.message}`);
    return [];
  }
}

// Function to filter reviews by date
function filterReviewsByDate(reviews, dateFrom, dateTo) {
  // If no date filters, return all reviews
  if (!dateFrom && !dateTo) {
    return reviews;
  }
  
  // Parse date strings to Date objects
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;
  
  // Filter reviews by date
  return reviews.filter(review => {
    // Skip reviews without a date
    if (!review.date) {
      return true;
    }
    
    // Try to parse the review date
    let reviewDate;
    try {
      // Handle different date formats
      if (review.date.match(/\d{2}\/\d{2}\/\d{4}/)) {
        // DD/MM/YYYY format
        const [day, month, year] = review.date.match(/(\d{2})\/(\d{2})\/(\d{4})/).slice(1);
        reviewDate = new Date(`${year}-${month}-${day}`);
      } else if (review.date.match(/\d{1,2}\s+\w+\s+\d{4}/)) {
        // "9 April 2023" format
        reviewDate = new Date(review.date);
      } else {
        // Try direct parsing
        reviewDate = new Date(review.date);
      }
      
      // Check if the date is valid
      if (isNaN(reviewDate.getTime())) {
        return true; // Include reviews with unparseable dates
      }
      
      // Check if the review date is within the specified range
      const isAfterFrom = !fromDate || reviewDate >= fromDate;
      const isBeforeTo = !toDate || reviewDate <= toDate;
      
      return isAfterFrom && isBeforeTo;
    } catch (e) {
      return true; // Include reviews with unparseable dates
    }
  });
}

// Function to save reviews to a CSV file
async function saveReviewsToCsv(reviews, filePath) {
  // Create directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Define CSV header
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'title', title: 'Title' },
      { id: 'rating', title: 'Rating' },
      { id: 'date', title: 'Date' },
      { id: 'text', title: 'Review Text' },
      { id: 'sourceUrl', title: 'Source URL' }
    ]
  });
  
  // Write reviews to CSV
  await csvWriter.writeRecords(reviews);
  
  return filePath;
}

module.exports = {
  scrapeReviews,
  saveReviewsToCsv
};
