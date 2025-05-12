const { PlaywrightCrawler, log } = require('crawlee');
const { parseDate } = require('chrono-node');
const urlUtils = require('./url-utils');

// Global arrays to store reviews for each retailer
global.tescoReviews = [];
global.sainsburysReviews = [];
global.asdaReviews = [];
global.morrisonsReviews = [];
global.icelandReviews = [];

// Main function to extract reviews
async function extractReviews(page, url, maxReviews = 50) {
  log.info(`Starting review extraction for URL: ${url}`);

  // Determine which retailer's site we're on using the urlUtils module
  const retailer = urlUtils.detectRetailerFromUrl(url);
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
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
        break;
      case 'asda':
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
        break;
      case 'morrisons':
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
        break;
      case 'iceland':
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
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
  } catch (e) {
    log.warning(`Error parsing date "${dateStr}": ${e.message}`);
  }

  // If we can't parse the date at all, return current date
  return new Date();
}

// Tesco specific handler
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using improved Tesco handler with robust button clicking');

  // Initialize global array for Tesco reviews
  global.tescoReviews = [];

  try {
    // Implementation for Tesco site
    log.info('Tesco handler implementation');

    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `tesco-initial-${Date.now()}.png` });

    // First, handle cookie consent if present
    try {
      console.log('DEBUGGING: Looking for cookie consent button');
      const cookieButton = await page.$('button:has-text("Accept all cookies"), #onetrust-accept-btn-handler');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Scroll down to load lazy-loaded content and find the reviews section
    console.log('DEBUGGING: Scrolling page to find reviews section');
    await autoScroll(page);
    await page.waitForTimeout(2000);

    // Take a screenshot after scrolling
    await page.screenshot({ path: `tesco-after-scroll-${Date.now()}.png` });

    // Count initial reviews - use multiple selectors to find reviews
    const initialReviewCount = await page.evaluate(() => {
      // Try multiple selectors to find review containers
      const selectors = [
        '.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0', 
        'div[class*="ReviewTileContainer"]',
        '.ddsweb-reviews-tile',
        '.ddsweb-reviews-tile__container',
        'div[data-testid="review-tile"]',
        'div[data-testid*="review"]',
        'div[class*="review-tile"]',
        'div[class*="ReviewTile"]'
      ];
      
      for (const selector of selectors) {
        const containers = document.querySelectorAll(selector);
        if (containers && containers.length > 0) {
          console.log(`Found ${containers.length} review containers with selector: ${selector}`);
          return containers.length;
        }
      }
      
      // If no reviews found with specific selectors, try a more general approach
      // Look for elements that might contain reviews based on content
      const allDivs = document.querySelectorAll('div');
      const reviewDivs = Array.from(allDivs).filter(div => {
        const text = div.textContent || '';
        return (text.includes('stars') || text.includes('rating')) && 
               (text.includes('review') || text.length > 100);
      });
      
      console.log(`Found ${reviewDivs.length} potential review containers using content filtering`);
      return reviewDivs.length;
    });

    log.info(`Initial review count: ${initialReviewCount}`);

    // Extract reviews using direct page evaluation with fixed rating extraction
    console.log('DEBUGGING: Extracting reviews with fixed rating extraction');
    const reviews = await page.evaluate(() => {
      console.log('Starting Tesco review extraction');
      const results = [];

      // Function to extract text content safely
      const safeTextContent = (element) => {
        if (!element) return '';
        return element.textContent.trim();
      };

      // Try multiple selectors to find review containers
      const selectors = [
        '.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0', 
        'div[class*="ReviewTileContainer"]',
        '.ddsweb-reviews-tile',
        '.ddsweb-reviews-tile__container',
        'div[data-testid="review-tile"]',
        'div[data-testid*="review"]',
        'div[class*="review-tile"]',
        'div[class*="ReviewTile"]'
      ];
      
      let reviewContainers = [];
      for (const selector of selectors) {
        const containers = document.querySelectorAll(selector);
        if (containers && containers.length > 0) {
          console.log(`Found ${containers.length} review containers with selector: ${selector}`);
          reviewContainers = Array.from(containers);
          break;
        }
      }
      
      // If no reviews found with specific selectors, try a more general approach
      if (reviewContainers.length === 0) {
        console.log('No review containers found with specific selectors, trying content filtering');
        
        // Look for elements that might contain reviews based on content
        const allDivs = document.querySelectorAll('div');
        reviewContainers = Array.from(allDivs).filter(div => {
          const text = div.textContent || '';
          return (text.includes('stars') || text.includes('rating')) && 
                 (text.includes('review') || text.length > 100);
        });
        
        console.log(`Found ${reviewContainers.length} potential review containers using content filtering`);
      }
      
      console.log(`Processing ${reviewContainers.length} Tesco review containers`);

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating - FIXED to correctly extract star rating
          let rating = '5'; // Default to 5 stars

          // Method 1: From aria-label
          const ratingSelectors = [
            '.styled__ReviewRating-mfe-pdp__sc-je4k7f-3', 
            'div[class*="ReviewRating"]', 
            '.ddsweb-rating__container',
            'div[class*="rating"]',
            'div[aria-label*="rating"]',
            'div[aria-label*="stars"]'
          ];
          
          let ratingContainer = null;
          for (const selector of ratingSelectors) {
            ratingContainer = container.querySelector(selector);
            if (ratingContainer) break;
          }
          
          if (ratingContainer) {
            const ariaLabel = ratingContainer.getAttribute('aria-label');
            if (ariaLabel) {
              const ratingMatch = ariaLabel.match(/rating of (\d+) stars/i) || 
                                 ariaLabel.match(/(\d+) stars/i) || 
                                 ariaLabel.match(/(\d+) out of 5/i);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted rating from aria-label: ${rating}`);
              }
            }
          }

          // Method 2: Count active star SVGs
          if (rating === '5') {
            const activeStarSelectors = [
              '.ddsweb-rating__icon-active', 
              'svg[class*="active"]',
              'svg[class*="filled"]',
              'svg[data-testid*="star-filled"]'
            ];
            
            for (const selector of activeStarSelectors) {
              const activeStars = container.querySelectorAll(selector);
              if (activeStars && activeStars.length > 0) {
                rating = activeStars.length.toString();
                console.log(`Extracted rating by counting active stars: ${rating}`);
                break;
              }
            }
          }

          // Extract title
          let title = 'Product Review'; // Default title
          const titleSelectors = [
            '.styled__Title-mfe-pdp__sc-je4k7f-2', 
            'h3[class*="Title"]', 
            'h3.ddsweb-heading',
            'h3[class*="review-title"]',
            'div[class*="review-title"]'
          ];
          
          for (const selector of titleSelectors) {
            const titleElement = container.querySelector(selector);
            if (titleElement) {
              title = safeTextContent(titleElement);
              console.log(`Extracted title: "${title}"`);
              break;
            }
          }

          // Extract date
          let date = 'Unknown date';
          const dateSelectors = [
            '.styled__ReviewDate-mfe-pdp__sc-je4k7f-9', 
            'span[class*="ReviewDate"]',
            'span[class*="review-date"]',
            'div[class*="review-date"]'
          ];
          
          for (const selector of dateSelectors) {
            const dateElement = container.querySelector(selector);
            if (dateElement) {
              date = safeTextContent(dateElement);
              console.log(`Extracted date: "${date}"`);
              break;
            }
          }

          // Extract review text - FIXED to correctly extract review text
          let text = '';
          const textSelectors = [
            '.styled__Content-mfe-pdp__sc-je4k7f-6', 
            'span[class*="Content"]',
            'div[class*="review-content"]',
            'p[class*="review-text"]'
          ];
          
          for (const selector of textSelectors) {
            const contentElement = container.querySelector(selector);
            if (contentElement) {
              text = safeTextContent(contentElement);
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
              break;
            }
          }

          // If we still don't have text, try to find the longest paragraph in the container
          if (!text || text.length <= 5) {
            const paragraphs = container.querySelectorAll('p');
            if (paragraphs.length > 0) {
              // Find the longest paragraph
              let longestText = '';
              for (const p of paragraphs) {
                const pText = safeTextContent(p);
                if (pText.length > longestText.length) {
                  longestText = pText;
                }
              }
              
              if (longestText.length > 5) {
                text = longestText;
                console.log(`Extracted text from longest paragraph: "${text.substring(0, 30)}..."`);
              }
            }
          }

          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
            console.log(`Added Tesco review with rating ${rating}`);
          }
        } catch (e) {
          console.error('Error processing Tesco review container:', e);
        }
      }

      console.log(`Returning ${results.length} Tesco reviews`);
      return results;
    });

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.tescoReviews = reviews;
      log.info(`Added ${reviews.length} reviews to global Tesco reviews array`);
    }

    // Take a final screenshot
    await page.screenshot({ path: `tesco-final-${Date.now()}.png` });

    // No fallbacks - only use actual reviews
    if (global.tescoReviews.length === 0) {
      log.warning('No Tesco reviews found. NOT adding fallback reviews.');
    }
  } catch (error) {
    log.error(`Error in Tesco handler: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in Tesco handler:', error);

    // No fallbacks - only use actual reviews
    if (global.tescoReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.tescoReviews;
}

// Generic handler for unknown sites
async function handleGenericSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using generic handler');
  
  // Return empty array for now
  return [];
}

// Main scraper function that will be called from server.js
async function scrapeReviews(url, options = {}) {
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);

  try {
    // Directly use the extractReviews function without the crawler
    // This simplifies the process and ensures we get the reviews
    const { chromium } = require('playwright');

    // Determine if we should run in headless mode
    const isProduction = process.env.NODE_ENV === 'production';
    const headlessMode = isProduction || process.env.HEADLESS === 'true';

    log.info(`Running in ${headlessMode ? 'headless' : 'visible'} mode (NODE_ENV: ${process.env.NODE_ENV || 'not set'})`);

    // Launch a browser with additional options for production environment
    console.log(`DEBUGGING: Launching browser with headless=${headlessMode}`);
    console.log(`DEBUGGING: PUPPETEER_EXECUTABLE_PATH=${process.env.PUPPETEER_EXECUTABLE_PATH || 'undefined'}`);
    console.log(`DEBUGGING: NODE_ENV=${process.env.NODE_ENV || 'undefined'}`);
    
    const browser = await chromium.launch({
      headless: headlessMode,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-http2',
        '--window-size=1280,800',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--enable-features=NetworkService'
      ]
    });
    
    console.log('DEBUGGING: Browser launched successfully');
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });
    
    console.log('DEBUGGING: Browser context created');
    
    const page = await context.newPage();
    console.log('DEBUGGING: New page created');

    // Navigate to the URL with additional options
    console.log(`DEBUGGING: Navigating to URL: ${url}`);
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000
      });
      console.log('DEBUGGING: Initial navigation successful with domcontentloaded');
      
      // Wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => {
        console.log(`DEBUGGING: Network idle wait timed out: ${e.message}`);
      });
    } catch (navigationError) {
      console.log(`DEBUGGING: Initial navigation failed: ${navigationError.message}, trying with different options`);
      // Try again with different options
      try {
        await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 90000
        });
        console.log('DEBUGGING: Retry navigation successful with load');
      } catch (retryError) {
        console.log(`DEBUGGING: Navigation retry failed: ${retryError.message}, trying with minimal options`);
        
        // Last attempt with minimal options
        try {
          await page.goto(url, { timeout: 120000 });
          console.log('DEBUGGING: Last attempt navigation successful with minimal options');
        } catch (lastError) {
          console.log(`DEBUGGING: All navigation attempts failed: ${lastError.message}`);
          throw lastError;
        }
      }
    }

    // Detect retailer from URL
    const retailer = urlUtils.detectRetailerFromUrl(url);
    log.info(`Detected retailer: ${retailer} for URL: ${url}`);

    // Extract reviews
    const reviews = await extractReviews(page, url, 50);
    log.info(`Directly extracted ${reviews.length} reviews from ${url}`);

    // Extract product information from URL
    const { productId, productName } = urlUtils.extractProductInfoFromUrl(url);
    log.info(`Extracted product info - ID: ${productId}, Name: ${productName}`);

    // Add metadata to each review
    const now = new Date();
    reviews.forEach(review => {
      // Add extraction timestamp and source URL
      review.extractedAt = now.toISOString();
      review.sourceUrl = url;

      // Add product information
      review.productId = productId;
      review.productName = productName;

      // Add site type if not already set
      if (!review.siteType) {
        review.siteType = retailer;
      }

      // Add a unique identifier for deduplication
      review.uniqueId = urlUtils.createReviewUniqueId(review);

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

    // Return empty array
    return [];
  }
}

// Export the functions
module.exports = {
  scrapeReviews,
  extractReviews,
  handleTescoSite,
  handleGenericSite,
  autoScroll,
  parseReviewDate
};
