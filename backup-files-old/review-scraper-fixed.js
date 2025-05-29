const { PlaywrightCrawler, log } = require('crawlee');
const { parseDate } = require('chrono-node');

// Global arrays to store reviews for each retailer
global.tescoReviews = [];
global.sainsburysReviews = [];
global.asdaReviews = [];
global.morrisonsReviews = [];

// Main function to extract reviews
async function extractReviews(page, url, maxReviews = 50) {
  log.info(`Starting review extraction for URL: ${url}`);

  // Determine which retailer's site we're on
  let retailer = 'unknown';
  if (url.includes('tesco.com')) {
    retailer = 'tesco';
  } else if (url.includes('sainsburys.co.uk')) {
    retailer = 'sainsburys';
  } else if (url.includes('asda.com')) {
    retailer = 'asda';
  } else if (url.includes('morrisons.com')) {
    retailer = 'morrisons';
  }

  log.info(`Detected retailer: ${retailer}`);

  // Configure site-specific settings
  const siteConfig = {
    log: log,
    retailer: retailer,
    reviewsTabSelector: 'button:has-text("Reviews"), a:has-text("Reviews"), button[data-auto-id="reviews-tab"], [data-auto-id="reviews-tab"]',
    reviewsSection: '.reviews-section, #reviews, [data-auto-id="reviews-section"]',
    reviewContainerSelector: 'div.review, div.review-card, div[data-auto-id="review-card"], div.review-container',
    ratingSelector: 'div.star-rating, div[data-auto-id="star-rating"], div.rating-stars',
    titleSelector: 'h3.review-title, h4.review-title, div[data-auto-id="review-title"], div.review-title',
    textSelector: 'p.review-text, div.review-text, div[data-auto-id="review-text"]',
    dateSelector: 'span.review-date, div.review-date, span[data-auto-id="review-date"]',
    paginationSelector: 'button:has-text("Next"), button:has-text("Show more"), button[data-auto-id="pagination-next"]'
  };

  // Handle the site based on the retailer
  let reviews = [];

  try {
    switch (retailer) {
      case 'tesco':
        reviews = await handleTescoSite(page, siteConfig, maxReviews);
        break;
      case 'sainsburys':
        reviews = await handleSainsburysSite(page, siteConfig, maxReviews);
        break;
      case 'asda':
        reviews = await handleAsdaSite(page, siteConfig, maxReviews);
        break;
      case 'morrisons':
        reviews = await handleMorrisonsSite(page, siteConfig, maxReviews);
        break;
      default:
        log.warning(`Unknown retailer for URL: ${url}`);
        // Try a generic approach
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
    }

    log.info(`Extracted ${reviews.length} reviews from ${retailer} site`);
    return reviews;
  } catch (error) {
    log.error(`Error extracting reviews: ${error.message}\n${error.stack}`);
    return [];
  }
}

// Helper function to scroll down the page
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// Helper function to parse dates
function parseReviewDate(dateStr) {
  if (!dateStr || dateStr === 'Unknown date') {
    return new Date();
  }

  try {
    // Check if the date is already in DD/MM/YYYY format
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmmyyyyMatch = dateStr.match(ddmmyyyyRegex);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1]);
      const month = parseInt(ddmmyyyyMatch[2]) - 1; // JS months are 0-indexed
      const year = parseInt(ddmmyyyyMatch[3]);
      return new Date(year, month, day);
    }

    // Try to parse the date using chrono
    const parsedDate = parseDate(dateStr);
    if (parsedDate) {
      return parsedDate;
    }

    // Try to parse various date formats
    // Format: "Month DD, YYYY" (e.g., "January 15, 2023")
    const monthNameFormat = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/;
    const monthMatch = dateStr.match(monthNameFormat);
    if (monthMatch) {
      const monthText = monthMatch[1].toLowerCase();
      const day = parseInt(monthMatch[2]);
      const year = parseInt(monthMatch[3]);

      // Convert month name to number
      const months = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
      };

      if (months[monthText] !== undefined) {
        return new Date(year, months[monthText], day);
      }
    }
  } catch (e) {
    log.warning(`Error parsing date "${dateStr}": ${e.message}`);
  }

  // If we can't parse the date at all, return current date
  return new Date();
}

// Main scraper function that will be called from server.js
async function scrapeReviews(url, options = {}) {
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);

  try {
    // Directly use the extractReviews function without the crawler
    // This simplifies the process and ensures we get the reviews
    const { chromium } = require('playwright');

    // Launch a browser in non-headless mode so we can see what's happening
    const browser = await chromium.launch({ 
      headless: false,
      slowMo: 100 // Slow down operations by 100ms to make them more visible
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Extract reviews
    const reviews = await extractReviews(page, url, 50);
    log.info(`Directly extracted ${reviews.length} reviews from ${url}`);

    // Add metadata to each review
    const now = new Date();
    reviews.forEach(review => {
      // Add extraction timestamp
      review.extractedAt = now.toISOString();
      review.sourceUrl = url;

      // Format the date for display
      if (review.date && review.date !== 'Unknown date') {
        try {
          // Parse the date using our helper function
          const parsedDate = parseReviewDate(review.date);
          review.parsedDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format

          // Check if the review is within the specified date range
          let inRange = true;
          if (options.dateFrom) {
            const fromDate = new Date(options.dateFrom);
            inRange = inRange && parsedDate >= fromDate;
          }
          if (options.dateTo) {
            const toDate = new Date(options.dateTo);
            toDate.setHours(23, 59, 59, 999); // End of the day
            inRange = inRange && parsedDate <= toDate;
          }
          review.inDateRange = inRange;
        } catch (e) {
          log.warning(`Error parsing date "${review.date}": ${e.message}`);
          review.parsedDate = null;
          review.inDateRange = false;
        }
      } else {
        review.parsedDate = null;
        review.inDateRange = false;
      }
    });

    // Close the browser
    await browser.close();

    // Return the reviews
    return reviews;
  } catch (error) {
    log.error(`Error in scrapeReviews: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in scrapeReviews:', error);

    // Determine which retailer's site we're on
    let retailer = 'unknown';
    if (url.includes('tesco.com')) {
      retailer = 'tesco';
    } else if (url.includes('sainsburys.co.uk')) {
      retailer = 'sainsburys';
    } else if (url.includes('asda.com')) {
      retailer = 'asda';
    } else if (url.includes('morrisons.com')) {
      retailer = 'morrisons';
    }

    // Return empty array - NO FALLBACKS
    log.warning(`Error occurred while scraping ${retailer} site. NOT adding fallback reviews.`);
    return [];
  }
}

// Import the handlers from the original file
const { 
  handleTescoSite, 
  handleSainsburysSite, 
  handleAsdaSite, 
  handleMorrisonsSite, 
  handleGenericSite 
} = require('./review-scraper-crawlee-fixed');

// Export the functions
module.exports = {
  scrapeReviews,
  extractReviews,
  handleTescoSite,
  handleSainsburysSite,
  handleAsdaSite,
  handleMorrisonsSite,
  handleGenericSite,
  autoScroll,
  parseReviewDate
};
