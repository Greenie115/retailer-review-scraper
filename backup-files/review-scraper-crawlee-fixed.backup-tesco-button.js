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

// ASDA specific handler
async function handleAsdaSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using ASDA specific handler (NO FALLBACKS)');

  // Initialize global array for ASDA reviews if not exists
  if (!global.asdaReviews) {
    global.asdaReviews = [];
  }

  // Clear any existing reviews to avoid duplicates
  global.asdaReviews = [];
  log.info('Cleared existing ASDA reviews array');

  // Debug info
  log.info(`ASDA handler starting for URL: ${page.url()}`);
  log.info(`Max reviews to collect: ${maxReviews}`);

  try {
    // First, handle cookie consent if present
    try {
      const cookieButton = await page.$('button[data-auto-id="onetrust-accept-btn-handler"], #onetrust-accept-btn-handler, button:has-text("Accept all cookies")');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Direct cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Find and click on the reviews tab
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      'button[data-auto-id="reviews-tab"]',
      '[data-auto-id="reviews-tab"]',
      'button[aria-controls="reviews"]'
    ];

    let tabClicked = false;
    for (const selector of reviewTabSelectors) {
      try {
        const reviewTab = await page.$(selector);
        if (reviewTab) {
          // Scroll to the element first
          await reviewTab.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);

          // Try clicking
          await reviewTab.click({ force: true }).catch(async (e) => {
            log.warning(`Direct tab click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), reviewTab);
          });

          log.info(`Clicked review tab with selector: ${selector}`);
          await page.waitForTimeout(2000);
          tabClicked = true;
          break;
        }
      } catch (e) {
        log.warning(`Error clicking tab with selector ${selector}: ${e.message}`);
      }
    }

    if (!tabClicked) {
      // Try JavaScript approach to find and click the tab
      log.info('Trying JavaScript approach to click reviews tab...');
      const clicked = await page.evaluate(() => {
        // Try to find any tab or button that might be the reviews tab
        const possibleTabs = Array.from(document.querySelectorAll('button[role="tab"], a[role="tab"]'));
        for (const tab of possibleTabs) {
          if (tab.textContent.includes('Review') || tab.textContent.includes('review')) {
            console.log('Found reviews tab via JavaScript, clicking...');
            tab.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        log.info('Successfully clicked reviews tab via JavaScript');
        await page.waitForTimeout(2000);
      } else {
        log.warning('Could not find reviews tab with any method');
      }
    }

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Scroll down to load lazy-loaded content
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Extract reviews using direct page evaluation
    log.info('Using direct page evaluation to extract ASDA reviews');

    // Take a screenshot to help debug
    await page.screenshot({ path: `asda-reviews-page-${Date.now()}.png` });

    // Custom ASDA review extraction based on the exact HTML structure
    const reviews = await page.evaluate(() => {
      console.log('Starting ASDA review extraction with custom selectors');
      const results = [];

      // Find all review containers using the exact class from the provided HTML
      const reviewContainers = document.querySelectorAll('div.pdp-description-reviews__content-cntr');
      console.log(`Found ${reviewContainers.length} ASDA review containers`);

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating from the width style attribute
          let rating = '5'; // Default to 5 stars
          const ratingStarsDiv = container.querySelector('div.rating-stars__stars--top[style*="width"]');
          if (ratingStarsDiv) {
            const styleAttr = ratingStarsDiv.getAttribute('style');
            const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
            if (widthMatch && widthMatch[1]) {
              const percentage = parseInt(widthMatch[1]);
              // Convert percentage to 5-star scale (100% = 5 stars, 20% = 1 star)
              rating = Math.round(percentage / 20).toString();
              console.log(`Extracted ASDA rating ${rating} from width percentage: ${percentage}%`);
            }
          }

          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('span.pdp-description-reviews__rating-title');
          if (titleElement) {
            title = titleElement.textContent.trim();
            console.log(`Extracted title: "${title}"`);
          }

          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('div.pdp-description-reviews__submitted-date');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }

          // Extract review text
          let text = '';
          const textElement = container.querySelector('p.pdp-description-reviews__content-text');
          if (textElement) {
            text = textElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }

          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
            console.log(`Added ASDA review with rating ${rating}`);
          }
        } catch (e) {
          console.error('Error processing ASDA review container:', e);
        }
      }

      console.log(`Returning ${results.length} ASDA reviews`);
      return results;
    });

    log.info(`Extracted ${reviews.length} reviews from ASDA site`);

    // Log the extracted reviews for debugging
    for (const review of reviews) {
      log.info(`ASDA Review: Rating=${review.rating}, Title="${review.title}", Date=${review.date}, Text="${review.text.substring(0, 30)}..."`);
    }

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.asdaReviews.push(...reviews);
      log.info(`Added ${reviews.length} reviews to global array, total: ${global.asdaReviews.length}`);
    }

    // No fallbacks - only use actual reviews
    if (global.asdaReviews.length === 0) {
      log.warning('No ASDA reviews found. NOT adding fallback reviews.');
    }

  } catch (error) {
    log.error(`Error in ASDA handler: ${error.message}\n${error.stack}`);

    // No fallbacks - only use actual reviews
    if (global.asdaReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.asdaReviews;
}

// Tesco specific handler
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using optimized Tesco handler with fixed selectors');

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

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Take a screenshot after scrolling
    await page.screenshot({ path: `tesco-after-scroll-${Date.now()}.png` });

    // Try to click the "Show more reviews" button a few times
    for (let i = 0; i < 5; i++) {
      try {
        console.log('DEBUGGING: Looking for show more reviews button');
        const showMoreButton = await page.$('button:has-text("Show more reviews"), button:has-text("Load more"), button:has-text("Show more")');
        if (showMoreButton) {
          console.log('DEBUGGING: Found show more reviews button');
          await showMoreButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          await showMoreButton.click({ force: true }).catch(async (e) => {
            log.warning(`Direct show more click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), showMoreButton);
          });
          log.info(`Clicked show more button, attempt ${i+1}`);
          await page.waitForTimeout(2000);

          // Take a screenshot after clicking show more
          await page.screenshot({ path: `tesco-after-show-more-${i+1}-${Date.now()}.png` });
        } else {
          log.info('No show more button found, all reviews may be loaded');
          break;
        }
      } catch (e) {
        log.warning(`Error clicking show more button: ${e.message}`);
        break;
      }
    }

    // Extract reviews using direct page evaluation
    console.log('DEBUGGING: Extracting reviews');
    const reviews = await page.evaluate(() => {
      console.log('Starting Tesco review extraction');
      const results = [];

      // Find all review containers using the exact class from the HTML structure
      const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
      console.log(`Found ${reviewContainers.length} Tesco review containers`);

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating from the aria-label attribute
          let rating = '5'; // Default to 5 stars
          const ratingContainer = container.querySelector('.styled__ReviewRating-mfe-pdp__sc-je4k7f-3, div[class*="ReviewRating"], .ddsweb-rating__container');
          if (ratingContainer) {
            const ratingText = ratingContainer.getAttribute('aria-label');
            if (ratingText) {
              const ratingMatch = ratingText.match(/rating of (\d+) stars/);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted Tesco rating: ${rating} stars from aria-label`);
              }
            }
            
            // Alternative method: count the active star SVGs
            if (rating === '5') {
              const activeStars = ratingContainer.querySelectorAll('.ddsweb-rating__icon-active');
              if (activeStars && activeStars.length > 0) {
                rating = activeStars.length.toString();
                console.log(`Extracted Tesco rating: ${rating} stars by counting SVGs`);
              }
            }
          }

          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('.styled__Title-mfe-pdp__sc-je4k7f-2, h3[class*="Title"], h3.ddsweb-heading');
          if (titleElement) {
            title = titleElement.textContent.trim();
            console.log(`Extracted title: "${title}"`);
          }

          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('.styled__ReviewDate-mfe-pdp__sc-je4k7f-9, span[class*="ReviewDate"]');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }

          // Extract review text
          let text = '';
          const contentElement = container.querySelector('.styled__Content-mfe-pdp__sc-je4k7f-6, span[class*="Content"]');
          if (contentElement) {
            text = contentElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
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

// Sainsbury's specific handler
async function handleSainsburysSite(page, siteConfig, maxReviews) {
  log.info('Using Sainsbury\'s specific handler');
  console.log('DEBUGGING: Using updated Sainsbury\'s handler');

  // Initialize global array for Sainsbury's reviews
  global.sainsburysReviews = [];

  try {
    // Implementation for Sainsbury's site
    log.info('Sainsbury\'s handler implementation');

    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` });

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

    // Try to expand the reviews section if it's collapsed
    console.log('DEBUGGING: Looking for reviews section');
    try {
      const expandButton = await page.$('button:has-text("Customer reviews"), button:has-text("Reviews"), button:has-text("Show reviews")');
      if (expandButton) {
        console.log('DEBUGGING: Found expand reviews button');
        await expandButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await expandButton.click({ force: true }).catch(async (e) => {
          log.warning(`Direct expand button click failed: ${e.message}, trying JavaScript click...`);
          await page.evaluate(button => button.click(), expandButton);
        });
        log.info('Clicked expand reviews button');
        await page.waitForTimeout(2000);

        // Take a screenshot after expanding reviews
        await page.screenshot({ path: `sainsburys-after-expand-${Date.now()}.png` });
      }
    } catch (e) {
      log.warning(`Error expanding reviews section: ${e.message}`);
    }

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Take a screenshot before extraction
    await page.screenshot({ path: `sainsburys-before-extraction-${Date.now()}.png` });

    // Extract reviews using direct page evaluation
    console.log('DEBUGGING: Extracting reviews');
    const reviews = await page.evaluate(() => {
      console.log('Starting Sainsbury\'s review extraction');
      const results = [];

      // Find all review containers
      const reviewContainers = document.querySelectorAll('div.review, div.review__content[data-testid="review-content"]');
      console.log(`Found ${reviewContainers.length} Sainsbury's review containers`);

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating
          let rating = '5'; // Default to 5 stars
          const ratingElement = container.querySelector('div.review__star-rating');
          if (ratingElement) {
            const ratingText = ratingElement.textContent.trim();
            const ratingMatch = ratingText.match(/^(\d+)\s+out\s+of\s+\d+/);
            if (ratingMatch && ratingMatch[1]) {
              rating = ratingMatch[1];
              console.log(`Extracted Sainsbury's rating: ${rating}`);
            }
          }

          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('div.review__title');
          if (titleElement) {
            title = titleElement.textContent.trim();
            console.log(`Extracted title: "${title}"`);
          }

          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('div.review__date');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }

          // Extract review text
          let text = '';
          const textElement = container.querySelector('div.review__text');
          if (textElement) {
            text = textElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }

          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
            console.log(`Added Sainsbury's review with rating ${rating}`);
          }
        } catch (e) {
          console.error('Error processing Sainsbury\'s review container:', e);
        }
      }

      console.log(`Returning ${results.length} Sainsbury's reviews`);
      return results;
    });

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.sainsburysReviews = reviews;
      log.info(`Added ${reviews.length} reviews to global Sainsbury's reviews array`);
    }

    // Take a final screenshot
    await page.screenshot({ path: `sainsburys-final-${Date.now()}.png` });

    // No fallbacks - only use actual reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found. NOT adding fallback reviews.');
    }
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in Sainsbury\'s handler:', error);

    // No fallbacks - only use actual reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.sainsburysReviews;
}

// Morrisons specific handler
async function handleMorrisonsSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Morrisons specific handler');
  console.log('DEBUGGING: Using optimized Morrisons handler with fixed star ratings');

  // Initialize global array for Morrisons reviews
  global.morrisonsReviews = [];

  try {
    // Implementation for Morrisons site
    log.info('Morrisons handler implementation');

    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `morrisons-initial-${Date.now()}.png` });

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

    // Find and click on the reviews tab
    console.log('DEBUGGING: Looking for reviews tab');
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      '[data-test="reviews-tab"]',
      'button[aria-controls="reviews"]'
    ];

    let tabClicked = false;
    for (const selector of reviewTabSelectors) {
      try {
        console.log(`DEBUGGING: Trying selector: ${selector}`);
        const reviewTab = await page.$(selector);
        if (reviewTab) {
          console.log(`DEBUGGING: Found review tab with selector: ${selector}`);
          // Scroll to the element first
          await reviewTab.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);

          // Try clicking
          await reviewTab.click({ force: true }).catch(async (e) => {
            log.warning(`Direct tab click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), reviewTab);
          });

          log.info(`Clicked review tab with selector: ${selector}`);
          await page.waitForTimeout(2000);
          tabClicked = true;
          break;
        }
      } catch (e) {
        log.warning(`Error clicking tab with selector ${selector}: ${e.message}`);
      }
    }

    // Take a screenshot after clicking the tab
    console.log('DEBUGGING: Taking screenshot after tab click');
    await page.screenshot({ path: `morrisons-after-tab-click-${Date.now()}.png` });

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Extract reviews using direct page evaluation
    log.info('Using direct page evaluation to extract Morrisons reviews');

    // Try to click through pagination to get more reviews
    let pageNum = 1;
    let hasMorePages = true;
    let allReviews = [];

    while (hasMorePages && pageNum <= 10 && allReviews.length < maxReviews) {
      // Take a screenshot before extracting reviews on this page
      console.log(`DEBUGGING: Taking screenshot for page ${pageNum}`);
      await page.screenshot({ path: `morrisons-page-${pageNum}-${Date.now()}.png` });

      // Extract reviews on the current page
      console.log('DEBUGGING: Extracting reviews from current page');
      const pageReviews = await page.evaluate(() => {
        console.log('Starting Morrisons review extraction');
        const results = [];

        // Find all review containers
        const reviewItems = document.querySelectorAll('li[data-test^="review-item-"]');
        console.log(`Found ${reviewItems.length} Morrisons review items`);

        // Process each review container
        for (const item of reviewItems) {
          try {
            // Extract rating by counting the filled stars
            let rating = '5'; // Default to 5 stars
            
            // Method 1: Try to extract from the text "X out of 5"
            const ratingText = item.querySelector('span._text_cn5lb_1._text--m_cn5lb_23, span._text_16wi0_1._text--m_16wi0_23');
            if (ratingText) {
              const ratingMatch = ratingText.textContent.match(/(\\d+)\\s+out\\s+of\\s+5/i);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted Morrisons rating: ${rating} stars from text`);
              }
            }
            
            // Method 2: Count the filled stars (SVG elements with data-icon="icon__reviews")
            if (rating === '5') { // Only try this if Method 1 didn't work
              const filledStars = item.querySelectorAll('svg[data-icon="icon__reviews"]');
              if (filledStars && filledStars.length > 0) {
                rating = filledStars.length.toString();
                console.log(`Extracted Morrisons rating: ${rating} stars by counting filled stars`);
              }
            }

            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = item.querySelector('h4._text_cn5lb_1._text--bold_cn5lb_7._text--m_cn5lb_23, h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23');
            if (titleElement) {
              title = titleElement.textContent.trim();
              // Remove "Rated X out of 5" from the title if present
              title = title.replace(/Rated \\d+ out of \\d+/g, '').trim();
              console.log(`Extracted title: "${title}"`);
            }

            // Extract date
            let date = 'Unknown date';
            const dateElement = item.querySelector('span._text_cn5lb_1._text--s_cn5lb_13, span._text_16wi0_1._text--s_16wi0_13');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date: "${date}"`);
            }

            // Extract review text
            let text = '';
            const textElement = item.querySelector('span._text_cn5lb_1._text--m_cn5lb_23.sc-16m6t4r-0, span._text_16wi0_1._text--m_16wi0_23.sc-16m6t4r-0');
            if (textElement) {
              text = textElement.textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }

            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ rating, title, date, text });
              console.log(`Added Morrisons review with rating ${rating}`);
            }
          } catch (e) {
            console.error('Error processing Morrisons review item:', e);
          }
        }

        console.log(`Returning ${results.length} Morrisons reviews from current page`);
        return results;
      });

      // Add the reviews from this page
      if (pageReviews && pageReviews.length > 0) {
        allReviews = allReviews.concat(pageReviews);
        log.info(`Added ${pageReviews.length} reviews from page ${pageNum}, total: ${allReviews.length}`);
      }

      // Try to click the next page button
      hasMorePages = false;
      try {
        console.log('DEBUGGING: Looking for next page button');
        const nextButton = await page.$('[data-test="next-page"], button:has-text("Next"), button:has-text("Show more")');
        if (nextButton) {
          console.log('DEBUGGING: Found next page button');
          const isDisabled = await nextButton.evaluate(btn => btn.disabled || btn.classList.contains('disabled'));
          if (!isDisabled) {
            await nextButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            await nextButton.click({ force: true }).catch(async (e) => {
              log.warning(`Direct next button click failed: ${e.message}, trying JavaScript click...`);
              hasMorePages = await page.evaluate(button => {
                if (!button.disabled && !button.classList.contains('disabled')) {
                  button.click();
                  return true;
                }
                return false;
              }, nextButton);
            });
            if (!isDisabled) {
              hasMorePages = true;
              pageNum++;
              log.info(`Clicked next page button, now on page ${pageNum}`);
              await page.waitForTimeout(2000); // Wait for new reviews to load
            }
          } else {
            log.info('Next page button is disabled, no more pages');
          }
        } else {
          log.info('No next page button found, reached the end of reviews');
        }
      } catch (e) {
        log.warning(`Error clicking next page button: ${e.message}`);
      }

      // Break if we've collected enough reviews
      if (allReviews.length >= maxReviews) {
        log.info(`Reached maximum number of reviews (${maxReviews}), stopping pagination`);
        break;
      }
    }

    // Add the reviews to the global array
    if (allReviews && allReviews.length > 0) {
      global.morrisonsReviews = allReviews;
      log.info(`Added ${allReviews.length} reviews to global Morrisons reviews array`);
    }

    // No fallbacks - only use actual reviews
    if (global.morrisonsReviews.length === 0) {
      log.warning('No Morrisons reviews found. NOT adding fallback reviews.');
    }
  } catch (error) {
    log.error(`Error in Morrisons handler: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in Morrisons handler:', error);

    // No fallbacks - only use actual reviews
    if (global.morrisonsReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.morrisonsReviews;
}

// Generic handler for unknown sites
async function handleGenericSite(page, siteConfig, maxReviews) {
  log.info('Using generic handler');
  console.log('DEBUGGING: Using updated generic handler');

  // Initialize array for generic reviews
  const genericReviews = [];

  try {
    // Implementation for generic site
    log.info('Generic handler implementation');

    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `generic-initial-${Date.now()}.png` });

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

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Take a screenshot after scrolling
    await page.screenshot({ path: `generic-after-scroll-${Date.now()}.png` });

    // Try to find reviews on the page
    console.log('DEBUGGING: Looking for reviews');
    const reviewSelectors = [
      '.review',
      '.product-review',
      '.customer-review',
      '[data-test*="review"]',
      '[class*="review"]'
    ];

    // Take a final screenshot
    await page.screenshot({ path: `generic-final-${Date.now()}.png` });

    // No fallbacks - only use actual reviews
    log.warning('No reviews found for generic site. NOT adding fallback reviews.');
  } catch (error) {
    log.error(`Error in generic handler: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in generic handler:', error);

    // No fallbacks - only use actual reviews
    log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
  }

  return genericReviews;
}

// Main scraper function that will be called from server.js
async function scrapeReviews(url, options = {}) {
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);

  try {
    // Directly use the extractReviews function without the crawler
    // This simplifies the process and ensures we get the reviews
    const { chromium } = require('playwright');

    // Launch a browser
    const browser = await chromium.launch({ headless: false });
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
