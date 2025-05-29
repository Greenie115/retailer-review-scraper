const { PlaywrightCrawler, log } = require('crawlee');
const { parseDate } = require('chrono-node');

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

    // For Morrisons reviews, check if the date contains "Submitted"
    if (dateStr.includes('Submitted')) {
      // Extract the date from "Submitted DD/MM/YYYY, by Author"
      const match = dateStr.match(/Submitted\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match && match[1] && match[2] && match[3]) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JS months are 0-indexed
        const year = parseInt(match[3]);
        return new Date(year, month, day);
      }
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
    retailer: retailer
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
        // Return empty array for unknown retailers
        return [];
    }

    log.info(`Extracted ${reviews.length} reviews from ${retailer} site`);

    // Add metadata to each review
    reviews.forEach(review => {
      review.siteType = retailer;

      // Format the date for display if not already done
      if (review.date && !review.date.includes('/')) {
        try {
          const parsedDate = parseReviewDate(review.date);
          const day = String(parsedDate.getDate()).padStart(2, '0');
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const year = parsedDate.getFullYear();
          review.date = `${day}/${month}/${year}`; // DD/MM/YYYY format
        } catch (e) {
          log.warning(`Error formatting date "${review.date}": ${e.message}`);
        }
      }
    });

    return reviews;
  } catch (error) {
    log.error(`Error extracting reviews: ${error.message}\n${error.stack}`);
    return [];
  }
}

// Main scraper function that will be called from server.js
async function scrapeReviews(url, options = {}) {
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);

  try {
    // Use Playwright directly for more control
    const { chromium } = require('playwright');

    // Launch a browser with visible UI for debugging
    const browser = await chromium.launch({
      headless: false, // Set to false to see the browser in action
      slowMo: 100 // Slow down operations by 100ms for better visibility
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the URL
    log.info(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log.info(`Page loaded: ${url}`);

    // Extract reviews directly
    log.info(`Extracting reviews from ${url}...`);
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

    // Take a screenshot for debugging
    await page.screenshot({ path: `screenshot-${Date.now()}.png` });

    // Close the browser
    await browser.close();

    // If we got actual reviews, return them
    if (reviews && reviews.length > 0) {
      log.info(`Returning ${reviews.length} actual reviews from ${url}`);
      return reviews;
    }

    // If we didn't get any reviews, log a warning
    log.warning(`No reviews found for ${url}, returning empty array`);
    return [];
  } catch (error) {
    log.error(`Error in scrapeReviews: ${error.message}\n${error.stack}`);

    // Return empty array instead of fallback reviews
    log.warning(`Returning empty array due to error for ${url}`);
    return [];
  }
}

// Export the functions
module.exports = {
  scrapeReviews,
  extractReviews,
  autoScroll,
  parseReviewDate
};
