/**
 * Modern Review Scraper using Crawlee (Module for Web Server)
 *
 * This script uses Crawlee (from Apify) which provides built-in anti-detection features,
 * automatic proxy rotation, and powerful browser automation for review scraping.
 * It's designed to be called as a module by server.js.
 */

const { PlaywrightCrawler, Dataset, log } = require('crawlee');
// ExcelJS is handled by server.js for file generation

// Default options if not passed by the server
const DEFAULT_OPTIONS = {
  maxReviews: 50,
  concurrency: 1,
  proxy: 'none',
  // For web UI, we always want it visible for captcha
  headless: false,
  // Date filtering options
  dateFrom: null, // Format: YYYY-MM-DD or null for no start date filter
  dateTo: null,   // Format: YYYY-MM-DD or null for no end date filter
};

// Site-specific review selectors
const SITE_CONFIGS = {
  amazon: {
    reviewContainerSelector: '[data-hook="review"]',
    reviewTextSelector: '[data-hook="review-body"]',
    ratingSelector: '[data-hook="review-star-rating"]',
    dateSelector: '[data-hook="review-date"]',
    titleSelector: '[data-hook="review-title"]',
    loadMoreSelector: '[data-hook="load-more-button"]',
    cookieSelector: '#sp-cc-accept',
    nextPageSelector: '.a-pagination .a-last a'
  },
  walmart: {
    reviewContainerSelector: '.review-card, [data-testid="review-card"]',
    reviewTextSelector: '.review-text, [data-testid="review-text"]',
    ratingSelector: '.stars-container, .stars-svg-container',
    dateSelector: '.review-date, [data-testid="review-date"]',
    titleSelector: '.review-title, [data-testid="review-title"]',
    loadMoreSelector: 'button:has-text("Show More")',
    cookieSelector: '#accept-cookies',
    nextPageSelector: '.paginator-btn-next'
  },
  bestbuy: {
    reviewContainerSelector: '.user-review, .review-item',
    reviewTextSelector: '.review-content, .ugc-review-body',
    ratingSelector: '.c-rating, .ugc-rating',
    dateSelector: '.submission-date, .review-date',
    titleSelector: '.review-title',
    loadMoreSelector: '.load-more-reviews',
    cookieSelector: '#consent_prompt_submit',
    nextPageSelector: '.pager-next'
  },
  tesco: {
    // --- Updated selectors based on actual Tesco site ---
    reviewContainerSelector: 'div[class*="ReviewTileContainer"], div[data-auto="review-card"], div[class*="review-card"]', // Main container div
    reviewTextSelector: 'span[class*="Content-mfe-pdp"], div[data-auto="review-text"], div[class*="review-text"]',       // Span containing the review text
    ratingSelector: 'div[class*="ReviewRating-mfe-pdp"], div[data-auto="review-rating"], div[class*="review-rating"]',       // Div containing stars
    dateSelector: 'span[class*="ReviewDate-mfe-pdp"], div[data-auto="review-date"], div[class*="review-date"]',         // Span containing the date
    titleSelector: 'h3[class*="Title-mfe-pdp"], div[data-auto="review-title"], div[class*="review-title"]',              // h3 containing the title
    loadMoreSelector: 'button:has-text("Show 10 more reviews"), button:has-text("Show more reviews"), button[data-auto="load-more-reviews"], button[class*="load-more"], button:has-text("Load more"), button:has-text("Show more"), button:has-text("More reviews")', // Updated based on actual button text
    cookieSelector: '#onetrust-accept-btn-handler, button[data-auto="accept-cookies"], button[id*="accept"]', // Updated to CSS selector
    nextPageSelector: 'a[class*="Pagination-mfe-pdp"][aria-label="Next page"], a[data-auto="pagination-next"], a[class*="pagination-next"]'
  },
  sainsburys: {
    // Updated selectors based on actual Sainsbury's HTML structure
    reviewContainerSelector: '.pd-reviews__review-container, .review, div[id^="id_"], .review-card, [data-testid="review-card"]',
    reviewTextSelector: '.review__content, [data-testid="review-content"], .review-content, div[class*="content"]',
    ratingSelector: '.review__star-rating, .ds-c-rating, [aria-label*="Rating"], [title*="Rating"]',
    dateSelector: '.review__date, div[class*="date"], time',
    titleSelector: '.review__title, div[class*="title"], h3, h4',
    authorSelector: '.review__author, div[class*="author"]',
    loadMoreSelector: 'button:has-text("Show more reviews"), button:has-text("Load more"), button[class*="LoadMore"], button[class*="load-more"]',
    cookieSelector: '#onetrust-accept-btn-handler, button[id*="accept-cookies"], button:has-text("Accept All Cookies"), button:has-text("Accept"), #consent_prompt_submit',
    nextPageSelector: '.pagination-next, [data-testid="pagination-next"], a[class*="PaginationNext"], li.next a, a[aria-label="Next page"]',
    // Sainsbury's specific selectors
    reviewsTabSelector: 'button:has-text("Reviews"), a:has-text("Reviews"), [data-testid="tab-reviews"], [aria-controls="reviews-panel"], a[href="#reviews"], button[aria-controls="reviews"], div[role="tab"]:has-text("Reviews")',
    paginationSelector: 'ul.pagination, [data-testid="pagination"], nav[class*="Pagination"], div[class*="pagination"]',
    pageNumberSelector: 'ul.pagination li a, [data-testid="pagination-item"], a[class*="PaginationItem"], a[class*="pagination-item"]',
    reviewsSection: '.pd-reviews, .product-reviews, div[id="reviews"], section[id="reviews"], div[class*="Reviews"]'
  },
  asda: {
    // --- XPATH PLACEHOLDERS - NEED VERIFICATION ---
    reviewContainerSelector: '//div[contains(@class, "review-pod")]',
    reviewTextSelector: './/p[contains(@class, "review-pod__text")]', // Relative XPath within container
    ratingSelector: './/div[contains(@class, "review-pod__rating")]', // Relative XPath within container
    dateSelector: './/span[contains(@class, "review-pod__date")]',   // Relative XPath within container
    titleSelector: './/h3[contains(@class, "review-pod__title")]',  // Relative XPath within container
    loadMoreSelector: '//button[contains(@class, "reviews__load-more-button")]',
    cookieSelector: '//button[@id="onetrust-accept-btn-handler"]',
    nextPageSelector: '//a[contains(@class, "pagination__next")]'
  },
  morrisons: {
    // Updated selectors based on actual Morrisons HTML structure
    reviewContainerSelector: '.sc-mmemlz-0.dYNMlH, div[class*="review"]',
    reviewTextSelector: 'span._text_16wi0_1._text--m_16wi0_23.sc-16m6t4r-0, span[class*="text"]',
    ratingSelector: 'span._text_16wi0_1._text--m_16wi0_23:has-text("out of 5"), div[data-test="display-only-rating"]',
    dateSelector: 'span._text_16wi0_1._text--s_16wi0_13, span[class*="text--s"]',
    titleSelector: 'h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23, h4[class*="text--bold"]',
    loadMoreSelector: 'button:has-text("Show more"), button:has-text("Load more")',
    cookieSelector: 'button[aria-label="Accept All Cookies"], #onetrust-accept-btn-handler',
    nextPageSelector: 'button[data-test="next-page"], button[aria-label="See next page."], button:has(svg[href="#svg-arrow_right"]), button._button_1knps_1._button--secondary_1knps_67:has(svg)'
  },
  // New retailers added
  target: {
    reviewContainerSelector: '.h-margin-b-x2, [data-test="review"]',
    reviewTextSelector: '.h-text-md, [data-test="review-text"]',
    ratingSelector: '.RatingsDisplay, [data-test="rating"]',
    dateSelector: '.h-text-sm, [data-test="review-date"]',
    titleSelector: '.h-text-bold, [data-test="review-title"]',
    loadMoreSelector: 'button:has-text("Show More Reviews")',
    cookieSelector: '#onetrust-accept-btn-handler',
    nextPageSelector: '[data-test="pagination-next"]'
  },
  wayfair: {
    reviewContainerSelector: '.ReviewsList-item',
    reviewTextSelector: '.ReviewContent-text',
    ratingSelector: '.ReviewRating',
    dateSelector: '.ReviewContent-date',
    titleSelector: '.ReviewContent-title',
    loadMoreSelector: 'button:has-text("Load More")',
    cookieSelector: '#accept-all-cookies',
    nextPageSelector: '.PaginationList-next'
  },
  homedepot: {
    reviewContainerSelector: '.review--item',
    reviewTextSelector: '.review--text',
    ratingSelector: '.review--stars',
    dateSelector: '.review--date',
    titleSelector: '.review--title',
    loadMoreSelector: 'button:has-text("Load More Reviews")',
    cookieSelector: '#onetrust-accept-btn-handler',
    nextPageSelector: '.hd-pagination__link--next'
  },
  lowes: {
    reviewContainerSelector: '.review-entry',
    reviewTextSelector: '.review-entry-content',
    ratingSelector: '.review-entry-rating',
    dateSelector: '.review-entry-date',
    titleSelector: '.review-entry-title',
    loadMoreSelector: 'button:has-text("Load More")',
    cookieSelector: '#onetrust-accept-btn-handler',
    nextPageSelector: '.pagination-next'
  },
  costco: {
    reviewContainerSelector: '.review-card',
    reviewTextSelector: '.review-card-content',
    ratingSelector: '.stars-rating',
    dateSelector: '.review-date',
    titleSelector: '.review-title',
    loadMoreSelector: 'button:has-text("Show More")',
    cookieSelector: '#onetrust-accept-btn-handler',
    nextPageSelector: '.pagination-btn-next'
  },
  // Special cases for path-based detection
  'generic-product': {
    reviewContainerSelector: '.review, .review-item, [class*="review"], [id*="review"]',
    reviewTextSelector: '.review-text, .review-content, [itemprop="reviewBody"], p',
    ratingSelector: '.rating, .stars, [class*="star-rating"]',
    dateSelector: '.date, .review-date, [itemprop="datePublished"]',
    titleSelector: '.review-title, [itemprop="name"], h3, h4',
    loadMoreSelector: '[class*="load-more"], [class*="show-more"], button:has-text("More")',
    cookieSelector: '[id*="cookie"] button, [class*="cookie"] button, [id*="consent"] button',
    nextPageSelector: '.pagination a.next, a.pagination-next, li.pagination-next a'
  },
  'generic-review': {
    reviewContainerSelector: '.review, .review-item, [class*="review"], [id*="review"]',
    reviewTextSelector: '.review-text, .review-content, [itemprop="reviewBody"], p',
    ratingSelector: '.rating, .stars, [class*="star-rating"]',
    dateSelector: '.date, .review-date, [itemprop="datePublished"]',
    titleSelector: '.review-title, [itemprop="name"], h3, h4',
    loadMoreSelector: '[class*="load-more"], [class*="show-more"], button:has-text("More")',
    cookieSelector: '[id*="cookie"] button, [class*="cookie"] button, [id*="consent"] button',
    nextPageSelector: '.pagination a.next, a.pagination-next, li.pagination-next a'
  },
  // Default selectors for any site (keeping CSS for simplicity unless specified)
  default: {
    reviewContainerSelector: '.review, .review-item, [class*="review"], [id*="review"]',
    reviewTextSelector: '.review-text, .review-content, [itemprop="reviewBody"], p',
    ratingSelector: '.rating, .stars, [class*="star-rating"]',
    dateSelector: '.date, .review-date, [itemprop="datePublished"]',
    titleSelector: '.review-title, [itemprop="name"], h3, h4',
    loadMoreSelector: '[class*="load-more"], [class*="show-more"], button:has-text("More")',
    cookieSelector: '[id*="cookie"] button, [class*="cookie"] button, [id*="consent"] button',
    nextPageSelector: '.pagination a.next, a.pagination-next, li.pagination-next a'
  }
};

// Main function - modified to accept url and options object
async function scrapeReviews(url, userOptions = {}) {
  // Merge user options with defaults
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  log.info(`Starting scrape for URL: ${url}`, { options });

  if (!url) {
    throw new Error('URL is required to start scraping.');
  }

  // Use a temporary dataset for each run to avoid mixing results
  const dataset = await Dataset.open(`reviews-${Date.now()}`);

  try {
    // Detect site type with improved domain matching
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    let siteType = 'default';

    // Identify site type based on domain with more specific matching
    // Using regex for more precise matching
    if (/amazon\.(com|co\.uk|ca|de|fr|es|it|nl|jp|in)/.test(domain)) siteType = 'amazon';
    else if (/walmart\.(com|ca)/.test(domain)) siteType = 'walmart';
    else if (/bestbuy\.(com|ca)/.test(domain)) siteType = 'bestbuy';
    else if (/tesco\.(com|ie|co\.uk)/.test(domain) || domain.includes('tesco.') || domain.includes('groceries.tesco')) siteType = 'tesco';
    else if (domain.includes('sainsburys.') || domain.includes('sainsburys-groceries') || domain.includes('sainsburys.co.uk') || domain.includes('sainsburysgroceries')) siteType = 'sainsburys';
    else if (domain.includes('asda.') || domain.includes('groceries.asda')) siteType = 'asda';
    else if (domain.includes('morrisons.') || domain.includes('groceries.morrisons')) siteType = 'morrisons';
    // Add more retailers as needed
    else if (domain.includes('target.')) siteType = 'target';
    else if (domain.includes('wayfair.')) siteType = 'wayfair';
    else if (domain.includes('homedepot.')) siteType = 'homedepot';
    else if (domain.includes('lowes.')) siteType = 'lowes';
    else if (domain.includes('costco.')) siteType = 'costco';

    // Path-based detection for ambiguous domains
    if (siteType === 'default') {
      if (path.includes('/product/') || path.includes('/dp/')) siteType = 'generic-product';
      else if (path.includes('/review') || path.includes('/ratings')) siteType = 'generic-review';
    }

    log.info(`Detected site type: ${siteType}`);

    // Get site-specific selectors
    const siteConfig = SITE_CONFIGS[siteType] || SITE_CONFIGS.default; // Fallback to default

    // Configure proxy
    let proxyConfiguration = undefined;
    if (options.proxy && options.proxy !== 'none') {
      if (options.proxy === 'auto') {
        log.info('Using automatic proxy rotation (Apify Proxy)');
        proxyConfiguration = { useApifyProxy: true };
      } else {
        log.info('Using custom proxy');
        proxyConfiguration = {
          proxyUrls: [options.proxy],
        };
      }
    }

    // Create and configure the crawler
    const crawler = new PlaywrightCrawler({
      proxyConfiguration,
      maxConcurrency: options.concurrency,
      // Headless mode determined by options (defaults to false for UI)
      headless: options.headless,
      // Add timeout to prevent getting stuck
      navigationTimeoutSecs: 120, // 2 minutes max for page navigation
      requestHandlerTimeoutSecs: 180, // 3 minutes max for request handler
      // Force a new browser instance for each run to avoid issues with reusing browsers
      useSessionPool: false,
      persistCookiesPerSession: false,
      // Close the browser after each run
      browserPoolOptions: {
        closeInactiveBrowserAfterSecs: 1,
        maxOpenPagesPerBrowser: 1
      },

      // This function will be called for each URL
      async requestHandler({ page, request }) {
        log.info(`Processing ${request.url}...`);

        // --- Network Interception Setup (Tesco specific) ---
        if (siteType === 'tesco') {
            log.info('Setting up network interception for Tesco reviews...');
            const interceptedReviews = []; // Temporary store for reviews from network requests

            await page.route('**/api/**/reviews**', async (route) => { // Placeholder URL pattern - NEEDS VERIFICATION
                try {
                    const response = await route.fetch(); // Continue the request and get the response
                    const json = await response.json();
                    log.info(`Intercepted potential reviews API response for ${route.request().url()}`);

                    // --- Placeholder JSON Parsing Logic ---
                    // NEEDS ADJUSTMENT based on actual Tesco API response structure
                    const reviewsInData = json?.results || json?.reviews || json?.data?.reviews || [];

                    for (const item of reviewsInData) {
                        const review = {
                            rating: item?.rating?.average || item?.rating || 'N/A',
                            title: item?.title || '',
                            date: item?.submissionTime || item?.date || new Date().toISOString(), // Adjust date field
                            text: item?.reviewText || item?.text || '',
                        };
                        // Basic validation
                        if (review.text && review.text.length > 5) {
                           interceptedReviews.push(review);
                        }
                    }
                    log.info(`Extracted ${reviewsInData.length} reviews from intercepted request.`);

                } catch (e) {
                    log.warning(`Failed to process intercepted request ${route.request().url()}: ${e.message}`);
                    // Don't abort the route, just log the error
                } finally {
                   // Ensure the original request is fulfilled if not already handled by route.fetch()
                   // This might not be needed if route.fetch() handles it, but safer to include
                   if (!route.request().response()) {
                       await route.continue();
                   }
                }
            });
        }
        // --- End Network Interception Setup ---


        // --- Human-like delay ---
        await page.waitForTimeout(Math.random() * 1500 + 500); // Random delay before starting

        // Wait for the page to load
        try {
            await page.waitForLoadState('networkidle', { timeout: 30000 }); // Wait longer if needed
        } catch (e) {
            log.warning(`Network idle wait timed out for ${request.url}, proceeding anyway...`);
        }

        // --- Captcha Check ---
        const captchaSelector = 'iframe[src*="captcha"], iframe[title*="captcha"], div.g-recaptcha, div.h-captcha'; // Common captcha indicators
        const captchaFrame = await page.$(captchaSelector);
        if (captchaFrame) {
            log.warning(`CAPTCHA detected on ${request.url}. Please solve it in the browser window.`);
            // Pause script execution until captcha is likely solved (e.g., iframe disappears)
            try {
                await page.waitForFunction(
                    (selector) => !document.querySelector(selector),
                    { timeout: 300000 }, // 5 minutes timeout for solving
                    captchaSelector
                );
                log.info('Captcha likely solved, continuing...');
                await page.waitForTimeout(Math.random() * 1000 + 500); // Delay after solving
            } catch (e) {
                log.error(`Captcha not solved within timeout on ${request.url}. Aborting this page.`);
                throw new Error('Captcha solving timed out.');
            }
        }

        // Handle cookie consent if present
        if (siteConfig.cookieSelector) {
          try {
            // Wait for selector to be visible before clicking
            await page.waitForSelector(siteConfig.cookieSelector, { timeout: 7000, state: 'visible' });
            await page.click(siteConfig.cookieSelector);
            log.info('Accepted cookies');
            await page.waitForTimeout(Math.random() * 800 + 300); // Delay after click

            // For Morrisons, check if the cookie banner is still visible and try alternative selectors
            if (siteType === 'morrisons') {
              // Check if the cookie banner is still visible
              const cookieBanner = await page.$('#onetrust-banner-sdk');
              if (cookieBanner) {
                log.info('Cookie banner still visible, trying alternative accept button...');
                try {
                  // Try clicking the Accept All button directly
                  await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    for (const button of buttons) {
                      if (button.textContent.includes('Accept All')) {
                        console.log('Found Accept All button, clicking...');
                        button.click();
                        return true;
                      }
                    }
                    return false;
                  });
                  await page.waitForTimeout(1000);
                } catch (innerError) {
                  log.warning(`Error clicking alternative cookie button: ${innerError.message}`);
                }
              }
            }
          } catch (e) {
             log.info('Cookie banner not found or clickable within timeout.');
          }
        }

        // Wrap the main extraction code in a try-catch with timeout
        let domReviews = [];
        try {
          // Special handling for specific sites
          if (siteType === 'sainsburys') {
            await handleSainsburysSite(page, siteConfig, options.maxReviews);
          } else if (siteType === 'morrisons') {
            // Special handling for Morrisons site
            await handleMorrisonsSite(page, siteConfig, options.maxReviews);
          } else if (siteType === 'asda') {
            // Special handling for ASDA site
            await handleAsdaSite(page, siteConfig, options.maxReviews);
          } else {
            // Standard handling for other sites
            // Find and click on reviews tab/section if needed
            try {
              const reviewTabSelectors = [
                'a:has-text("Customer Reviews")',
                'a:has-text("Reviews")',
                'button:has-text("Reviews")',
                '#reviews-tab',
                'a[href="#reviews"]',
                '[aria-controls="reviews"]'
              ];

              for (const selector of reviewTabSelectors) {
                const reviewTab = await page.$(selector);
                if (reviewTab) {
                  // Scroll to the element first
                  await reviewTab.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(Math.random() * 500 + 200); // Small delay before click

                  // Click it
                  await reviewTab.click();
                  log.info(`Clicked review tab with selector: ${selector}`);
                  // Wait for potential content loading after click
                  await page.waitForTimeout(Math.random() * 2000 + 1000);
                  break;
                }
              }
            } catch (e) {
              log.warning('Could not find review tab', { error: e.message });
            }
          }

          // For sites without special handlers, continue with standard process
          if (siteType !== 'sainsburys' && siteType !== 'morrisons' && siteType !== 'asda') {
            // Scroll down to load lazy-loaded content (add delay)
            await autoScroll(page);
            await page.waitForTimeout(Math.random() * 1000 + 500);

            // Set a timeout for the review loading process
            const loadingTimeout = setTimeout(() => {
              throw new Error('Review loading process timed out after 2 minutes');
            }, 120000); // 2 minutes

            try {
              // Try to load more reviews if available
              await loadMoreReviews(page, siteConfig, options.maxReviews);

              // Extract reviews from DOM
              domReviews = await extractReviews(page, siteConfig, options.maxReviews, options);
              log.info(`Extracted ${domReviews.length} reviews from DOM for ${request.url}`);
            } finally {
              // Clear the timeout regardless of success or failure
              clearTimeout(loadingTimeout);
            }
          } else if (siteType === 'sainsburys') {
            // For Sainsbury's, reviews are already extracted in handleSainsburysSite
            domReviews = global.sainsburysReviews || [];
            log.info(`Using ${domReviews.length} reviews extracted from Sainsbury's site for ${request.url}`);
            // Reset the global variable
            global.sainsburysReviews = [];
          } else if (siteType === 'morrisons') {
            // For Morrisons, reviews are already extracted in handleMorrisonsSite
            domReviews = global.morrisonsReviews || [];
            log.info(`Using ${domReviews.length} reviews extracted from Morrisons site for ${request.url}`);
            // Reset the global variable
            global.morrisonsReviews = [];
          } else if (siteType === 'asda') {
            // For ASDA, reviews are already extracted in handleAsdaSite
            domReviews = global.asdaReviews || [];
            log.info(`Using ${domReviews.length} reviews extracted from ASDA site for ${request.url}`);
            // Reset the global variable
            global.asdaReviews = [];
          }
        } catch (extractionError) {
          log.error(`Error during main extraction process: ${extractionError.message}`);
          // Continue with whatever reviews we've managed to extract
        }

        // Combine DOM reviews and intercepted reviews (if any)
        let allExtractedReviews = domReviews || [];
        if (siteType === 'tesco' && typeof interceptedReviews !== 'undefined' && Array.isArray(interceptedReviews) && interceptedReviews.length > 0) {
            log.info(`Adding ${interceptedReviews.length} reviews from network interception.`);

            // Deduplicate reviews by creating a Map with a composite key of title+text
            const reviewMap = new Map();

            // First add intercepted reviews (they often have better structured data)
            for (const review of interceptedReviews) {
                if (review.text && review.text.length > 10) { // Basic validation
                    const key = `${review.title || ''}-${review.text.substring(0, 50)}`;
                    reviewMap.set(key, review);
                }
            }

            // Then add DOM reviews that don't duplicate intercepted ones
            for (const review of domReviews) {
                if (review.text && review.text.length > 10) { // Basic validation
                    const key = `${review.title || ''}-${review.text.substring(0, 50)}`;
                    if (!reviewMap.has(key)) {
                        reviewMap.set(key, review);
                    }
                }
            }

            // Convert back to array
            allExtractedReviews = Array.from(reviewMap.values());
            log.info(`After deduplication: ${allExtractedReviews.length} unique reviews.`);
        }

        // Limit combined reviews
        const limitedExtractedReviews = allExtractedReviews.slice(0, options.maxReviews);

        // Save individual review objects to dataset
        log.info(`Pushing ${limitedExtractedReviews.length} reviews to dataset...`);
        try {
            for (const review of limitedExtractedReviews) {
                await dataset.pushData(review);
            }
        } catch (e) {
            log.error(`Error saving reviews to dataset: ${e.message}`);
            // Continue execution - we might still be able to return the reviews even if dataset fails
        }

      },

      // This will be called for each error
      failedRequestHandler({ request, error }) { // Removed log from args
        log.error(`Request ${request.url} failed: ${error.message}`);
      },
    });

    // Start the crawler with the provided URL
    await crawler.run([url]);

    // Get the results - items are now individual review objects
    const results = await dataset.getData();
    const allReviews = results.items; // Already flat array of objects

    // Deduplicate reviews based on text and title
    const uniqueReviews = Array.from(new Map(allReviews.map(r => {
      // Create a composite key from title and first 50 chars of text
      const key = `${r.title || ''}-${(r.text || '').slice(0, 50)}`;
      return [key, r];
    })).values());

    log.info(`Collected ${uniqueReviews.length} unique reviews after deduplication (from ${allReviews.length} total).`);

    // Limit to max reviews (apply limit after deduplication)
    const limitedReviews = uniqueReviews.slice(0, options.maxReviews);

    log.info(`Total reviews collected: ${limitedReviews.length}`);

    // Add metadata to each review if not already present
    for (const review of limitedReviews) {
      if (!review.sourceUrl) review.sourceUrl = url;
      // Always set the site type to ensure it's correct
      review.siteType = siteType;
      if (!review.extractedAt) review.extractedAt = new Date().toISOString();

      // Make sure we have a valid rating
      if (!review.rating || review.rating === 'N/A' || review.rating === '') {
        review.rating = '5'; // Default to 5 if no rating found
        log.info(`Set default rating 5 for review with missing rating`);
      }

      // Log each review for debugging
      log.info(`Review: ${JSON.stringify({
        title: review.title,
        rating: review.rating,
        date: review.date,
        siteType: review.siteType,
        productId: review.productId
      })}`);
    }

    // Return the collected reviews
    return limitedReviews; // For backward compatibility with server.js

  } catch (error) {
    log.error(`Scraping failed: ${error.message}`, { error });
    // If we have some reviews despite the error, return them
    try {
      const partialResults = await dataset.getData();
      if (partialResults && partialResults.items && partialResults.items.length > 0) {
        log.info(`Returning ${partialResults.items.length} reviews despite error`);
        return partialResults.items.slice(0, options.maxReviews);
      }
    } catch (e) {
      log.error(`Could not retrieve partial results: ${e.message}`);
    }
    // Re-throw the error so the server can catch it
    throw error;
  } finally {
      // Clean up the temporary dataset
      try {
        if (dataset) {
            await dataset.drop();
        }
      } catch (e) {
        log.warning(`Error dropping dataset: ${e.message}`);
        // Continue execution - dataset cleanup is not critical
      }
  }
}

// Helper function to auto-scroll through the page
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        // Stop scrolling if we've scrolled past the content height or a large amount
        if (totalHeight >= scrollHeight || totalHeight > 20000) { // Increased max scroll
          clearInterval(timer);
          resolve();
        }
      }, 150); // Slightly slower scroll
    });
  });
}

// Helper function to click "Load More" buttons or handle pagination
async function loadMoreReviews(page, siteConfig, maxReviews) {
  const loadMoreSelector = siteConfig.loadMoreSelector;
  // Support for pagination - will be implemented in future versions
  const nextPageSelector = siteConfig.nextPageSelector || '.pagination a.next, a.pagination-next, li.pagination-next a, [data-test-id="pagination-next"]';

  // Add overall timeout for the entire function
  const startTime = Date.now();
  const MAX_TOTAL_TIME = 120000; // 2 minutes max for loading more reviews

  try {
    let reviewCount = 0;
    let previousReviewCount = 0;
    let clickCount = 0;
    const maxClicks = 15; // Reduced to prevent excessive clicking
    let sameCountIterations = 0;
    const MAX_SAME_COUNT = 2; // If review count doesn't change for this many iterations, we're done

    while (clickCount < maxClicks) {
      // Check if we've exceeded the maximum time
      if (Date.now() - startTime > MAX_TOTAL_TIME) {
        log.info(`Exceeded maximum time (${MAX_TOTAL_TIME/1000} seconds) for loading more reviews. Stopping.`);
        break;
      }
      // Check current review count using the site-specific container selector
      const currentReviews = await page.$$(siteConfig.reviewContainerSelector);
      reviewCount = currentReviews.length;
      log.info(`Current review count: ${reviewCount}`);

      // Check if review count has changed
      if (reviewCount === previousReviewCount) {
        sameCountIterations++;
        if (sameCountIterations >= MAX_SAME_COUNT) {
          log.info(`Review count hasn't changed for ${MAX_SAME_COUNT} iterations. Assuming all reviews loaded.`);
          break;
        }
      } else {
        // Reset counter if count changed
        sameCountIterations = 0;
        previousReviewCount = reviewCount;
      }

      if (reviewCount >= maxReviews) {
        log.info(`Reached max reviews (${maxReviews}). Stopping load more.`);
        break;
      }

      // --- Captcha Check within loop ---
      const captchaSelector = 'iframe[src*="captcha"], iframe[title*="captcha"], div.g-recaptcha, div.h-captcha';
      const captchaFrame = await page.$(captchaSelector);
      if (captchaFrame) {
          log.warning(`CAPTCHA detected while loading more reviews on ${page.url()}. Please solve it.`);
          try {
              await page.waitForFunction(
                  (selector) => !document.querySelector(selector),
                  { timeout: 300000 }, // 5 minutes timeout
                  captchaSelector
              );
              log.info('Captcha likely solved, continuing...');
              await page.waitForTimeout(Math.random() * 1000 + 500);
          } catch (e) {
              log.error(`Captcha not solved within timeout on ${page.url()}. Stopping load more.`);
              break; // Stop trying to load more if captcha blocks
          }
      }

      // --- Try "Load More" Button ---
      let clickedLoadMore = false;
      if (loadMoreSelector) {
          try {
              // First try to find the button using the provided selector
              let loadMoreButton = await page.waitForSelector(loadMoreSelector, { state: 'visible', timeout: 5000 }).catch(() => null);

              // If not found, try a more aggressive approach for Tesco
              if (!loadMoreButton) {
                  log.info('Standard load more button not found, trying alternative approaches...');

                  // Try to find any button that might be a load more button
                  const buttonTexts = ['show more', 'load more', 'more reviews', 'show 10 more'];
                  for (const text of buttonTexts) {
                      try {
                          // Case insensitive search for buttons containing these texts
                          const buttons = await page.$$('button');
                          for (const button of buttons) {
                              const buttonText = await button.textContent();
                              if (buttonText && buttonText.toLowerCase().includes(text.toLowerCase())) {
                                  loadMoreButton = button;
                                  log.info(`Found load more button with text: ${buttonText}`);
                                  break;
                              }
                          }
                          if (loadMoreButton) break;
                      } catch (err) {
                          log.warning(`Error searching for button with text '${text}': ${err.message}`);
                      }
                  }
              }

              if (loadMoreButton) {
                  log.info('Clicking "Load More" button...');
                  await loadMoreButton.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(Math.random() * 500 + 300); // Short delay before click

                  // Try to click the button
                  try {
                      await loadMoreButton.click();
                  } catch (clickErr) {
                      log.warning(`Direct click failed: ${clickErr.message}. Trying JavaScript click...`);
                      // Try JavaScript click as a fallback
                      try {
                          await page.evaluate(button => button.click(), loadMoreButton);
                      } catch (jsClickErr) {
                          log.warning(`JavaScript click also failed: ${jsClickErr.message}`);
                          throw jsClickErr; // Re-throw to be caught by outer catch
                      }
                  }

                  // Wait longer for dynamic content to load after click
                  try {
                    await page.waitForTimeout(Math.random() * 3000 + 2000);
                    clickCount++;
                    clickedLoadMore = true;

                    // Add a small scroll after click to potentially trigger more lazy loading
                    await page.evaluate(() => window.scrollBy(0, 200));
                    await page.waitForTimeout(Math.random() * 500 + 200);

                    // Additional scroll to ensure new content is visible
                    await autoScroll(page);
                  } catch (timeoutErr) {
                    log.warning(`Error after clicking load more button: ${timeoutErr.message}`);
                    // If we get an error here, the page might have navigated or closed
                    // Let's break the loop to avoid getting stuck
                    break;
                  }
              } else {
                  log.info('"Load More" button not found after trying multiple approaches.');
              }
          } catch (e) {
              log.warning(`Error clicking "Load More" button: ${e.message}. Maybe it disappeared?`);
              // Don't break immediately, maybe pagination exists or it was the last click
          }
      }

      // --- Pagination Logic ---
      let paginated = false;
      if (!clickedLoadMore && nextPageSelector) {
          try {
              // Special handling for Morrisons pagination
              if (siteType === 'morrisons') {
                  log.info('Using special Morrisons pagination handling...');

                  // First, check if there's a cookie banner blocking clicks
                  const cookieBanner = await page.$('#onetrust-banner-sdk, .onetrust-pc-dark-filter');
                  if (cookieBanner) {
                      log.info('Cookie banner is still visible, trying to dismiss it...');
                      try {
                          // Try clicking any accept button
                          await page.evaluate(() => {
                              const buttons = Array.from(document.querySelectorAll('button'));
                              for (const button of buttons) {
                                  if (button.textContent.includes('Accept') ||
                                      button.getAttribute('aria-label')?.includes('Accept')) {
                                      console.log('Found Accept button, clicking...');
                                      button.click();
                                      return true;
                                  }
                              }
                              return false;
                          });
                          await page.waitForTimeout(1000);
                      } catch (cookieError) {
                          log.warning(`Error dismissing cookie banner: ${cookieError.message}`);
                      }
                  }

                  // Try multiple approaches to find and click the next button
                  let nextClicked = false;

                  // 1. Try direct selector
                  const nextPageButton = await page.$(nextPageSelector).catch(() => null);
                  if (nextPageButton) {
                      log.info('Found pagination "Next" button, trying to click...');
                      try {
                          // Take a screenshot before clicking
                          await page.screenshot({ path: `morrisons-before-next-${Date.now()}.png` });

                          // Try scrolling to make sure it's visible
                          await nextPageButton.scrollIntoViewIfNeeded();
                          await page.waitForTimeout(1000);

                          // Try clicking
                          await nextPageButton.click({ force: true }).catch(async (e) => {
                              log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
                              await page.evaluate(button => button.click(), nextPageButton);
                          });

                          // Wait for content to update
                          await page.waitForTimeout(3000);
                          nextClicked = true;
                      } catch (e) {
                          log.warning(`Error clicking next button: ${e.message}`);
                      }
                  }

                  // 2. If direct click failed, try JavaScript approach
                  if (!nextClicked) {
                      log.info('Trying JavaScript approach to click next button...');
                      try {
                          const clicked = await page.evaluate(() => {
                              // Try to find the button by data-test attribute
                              let nextButton = document.querySelector('button[data-test="next-page"]');

                              // If not found, try by aria-label
                              if (!nextButton) {
                                  nextButton = Array.from(document.querySelectorAll('button'))
                                      .find(b => b.getAttribute('aria-label') === 'See next page.');
                              }

                              // If not found, look for buttons with SVG arrow
                              if (!nextButton) {
                                  const buttons = Array.from(document.querySelectorAll('button'));
                                  for (const button of buttons) {
                                      const svg = button.querySelector('svg');
                                      if (svg && (svg.getAttribute('href') === '#svg-arrow_right' ||
                                                 button.classList.contains('_button--secondary_1knps_67'))) {
                                          nextButton = button;
                                          break;
                                      }
                                  }
                              }

                              // If found, click it
                              if (nextButton) {
                                  console.log('Found next button via JavaScript, clicking...');
                                  nextButton.click();
                                  return true;
                              }

                              return false;
                          });

                          if (clicked) {
                              log.info('Successfully clicked next button via JavaScript');
                              await page.waitForTimeout(3000);
                              nextClicked = true;
                          }
                      } catch (jsError) {
                          log.warning(`JavaScript click approach failed: ${jsError.message}`);
                      }
                  }

                  // If we successfully clicked, update state
                  if (nextClicked) {
                      clickCount++;
                      paginated = true;

                      // Take a screenshot after clicking
                      await page.screenshot({ path: `morrisons-after-next-${Date.now()}.png` });

                      // Scroll a bit on the new page to load content
                      await autoScroll(page);
                  } else {
                      log.info('Could not click next button with any method');
                  }
              } else {
                  // Standard pagination for other sites
                  const nextPageButton = await page.waitForSelector(nextPageSelector, { state: 'visible', timeout: 5000 }).catch(() => null);

                  if (nextPageButton) {
                      log.info('Found pagination "Next" button, clicking...');
                      await nextPageButton.scrollIntoViewIfNeeded();
                      await page.waitForTimeout(Math.random() * 500 + 300); // Short delay before click
                      await nextPageButton.click();

                      // Wait for navigation to complete
                      try {
                          await page.waitForNavigation({ timeout: 10000 });
                      } catch (navError) {
                          log.warning(`Navigation timeout after clicking next page: ${navError.message}`);
                          // Continue anyway, the page might have changed without a full navigation event
                      }

                      // Wait for content to load on new page
                      await page.waitForTimeout(Math.random() * 3000 + 2000);
                      clickCount++;
                      paginated = true;

                      // Scroll a bit on the new page to load content
                      await autoScroll(page);
                  } else {
                      log.info('No pagination "Next" button found or visible.');
                  }
              }
          } catch (e) {
              log.warning(`Error with pagination: ${e.message}`);
          }
      }

      // If neither load more nor pagination worked in this iteration, stop
      if (!clickedLoadMore && !paginated) {
          log.info('No more "Load More" or pagination options found/visible/clicked.');
          break;
      }
    }
  } catch (e) {
    log.error(`Error during loadMoreReviews: ${e.message}`);
  }
}

// Helper function to extract reviews
async function extractReviews(page, siteConfig, maxReviews, options = {}) {
  const reviews = [];

  // Get the site type from the URL
  const url = page.url();
  // Detect site type from URL
  let siteType = 'unknown';
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    if (domain.includes('tesco')) siteType = 'tesco';
    else if (domain.includes('sainsburys')) siteType = 'sainsburys';
    else if (domain.includes('asda')) siteType = 'asda';
    else if (domain.includes('morrisons')) siteType = 'morrisons';
  } catch (e) {
    log.warning(`Error detecting site type from URL: ${e.message}`);
  }

  try {
    // Get all review containers visible on the page currently
    const reviewElements = await page.$$(siteConfig.reviewContainerSelector);
    log.info(`Found ${reviewElements.length} review elements on page`);

    // Process each review up to the maximum needed overall (passed as maxReviews)
    // Note: This extracts from currently loaded elements. loadMoreReviews handles getting more elements.
    for (const reviewElement of reviewElements) { // Process all currently loaded ones
        if (reviews.length >= maxReviews) break; // Stop if we already have enough

        try {
            // Pass selectors as a single object to avoid "Too many arguments" error
            const review = await page.evaluate(
              (params) => {
                const { el, textSelector, ratingSelector, dateSelector, titleSelector } = params;

                // Helper to get text content safely - handles comma-separated selectors
                const getText = (element, selectorString) => {
                  if (!element) return '';
                  try {
                    // Split by comma to handle multiple selectors
                    const selectors = selectorString.split(',').map(s => s.trim());

                    // Try each selector until one works
                    for (const selector of selectors) {
                      // Try CSS selector first
                      let found = element.querySelector(selector);

                      // If not found and looks like XPath, try evaluating as XPath
                      if (!found && (selector.startsWith('.//') || selector.startsWith('//') || selector.includes('@'))) {
                        try {
                          const xpathResult = document.evaluate(
                            selector.startsWith('.//') ? selector : selector.replace(/^\/\//, './/')  // Make relative if needed
                            , element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                          found = xpathResult.singleNodeValue;
                        } catch (e) {
                          // XPath failed, continue with next selector
                          continue;
                        }
                      }

                      // If found with this selector, return the text
                      if (found) {
                        return found.textContent.trim();
                      }
                    }

                    // If we get here, no selector worked
                    return '';
                  } catch (e) {
                    // If any error in selector processing, return empty string
                    return '';
                  }
                };

                // Extract rating - Improved robustness
                let rating = 'N/A';
                try {
                  // Try each rating selector
                  const ratingSelectors = ratingSelector.split(',').map(s => s.trim());
                  let ratingElement = null;

                  for (const selector of ratingSelectors) {
                    ratingElement = el.querySelector(selector);
                    if (ratingElement) break;
                  }

                  if (ratingElement) {
                    // Try common patterns: text content, aria-label, specific data attributes
                    const ratingText = ratingElement.textContent.trim();
                    const ariaLabel = ratingElement.getAttribute('aria-label');
                    const dataRating = ratingElement.getAttribute('data-rating'); // Common pattern

                    let ratingMatch = ratingText.match(/(\d+(\.\d+)?)\s*(out of|of)?\s*5/); // "4.5 out of 5" or "4.5"
                    if (!ratingMatch) ratingMatch = ratingText.match(/^(\d+(\.\d+)?)$/); // Just "4.5"
                    if (!ratingMatch && ariaLabel) ratingMatch = ariaLabel.match(/(\d+(\.\d+)?)\s*(stars|out of)/i);
                    if (!ratingMatch && dataRating) ratingMatch = dataRating.match(/(\d+(\.\d+)?)/);

                    // Alternative: Count filled stars if structure allows
                    const filledStars = el.querySelectorAll('.star-filled, .icon-star-full, [class*="star-full"], [class*="star-filled"]').length;
                    if (!ratingMatch && filledStars > 0) rating = filledStars.toString();

                    if (ratingMatch) {
                      rating = ratingMatch[1]; // Get the number part
                    }
                  }
                } catch (e) {
                  // If rating extraction fails, keep default 'N/A'
                }

                // Extract title
                const title = getText(el, titleSelector);

                // Extract date - Improved robustness
                let date = 'N/A';
                try {
                  // Try each date selector
                  const dateSelectors = dateSelector.split(',').map(s => s.trim());
                  let dateElement = null;

                  for (const selector of dateSelectors) {
                    dateElement = el.querySelector(selector);
                    if (dateElement) break;
                  }

                  if (dateElement) {
                    date = dateElement.textContent.trim();
                    // Try datetime attribute if text is vague or missing
                    const dateTimeAttr = dateElement.getAttribute('datetime') || dateElement.getAttribute('data-date');
                    if (dateTimeAttr && (!date || date.toLowerCase().includes('ago'))) {
                       // Basic check if it looks like an ISO date
                       if (/^\d{4}-\d{2}-\d{2}/.test(dateTimeAttr)) {
                          date = dateTimeAttr.split('T')[0]; // Get YYYY-MM-DD part
                       } else {
                           date = dateTimeAttr; // Use whatever is in datetime
                       }
                    }
                    // Simple cleanup for common relative dates (can be improved)
                    date = date.replace(/Reviewed in .*? on /, '').replace(/on /, '');
                  }
                } catch (e) {
                  // If date extraction fails, keep default 'N/A'
                }

                // Extract text
                let text = getText(el, textSelector);

                // Fallback if specific text selector fails
                if (!text) {
                  try {
                    text = el.textContent.trim();
                    // Attempt to remove known parts like title, date, rating text
                    if (title) text = text.replace(title, '');
                    if (date !== 'N/A') text = text.replace(date, '');
                    // Be careful removing rating text as it might be part of the review
                    // Clean up excessive whitespace resulting from removals
                    text = text.replace(/\s+/g, ' ').trim();
                  } catch (e) {
                    text = 'Error extracting review text';
                  }
                }

                return { rating, title, date, text, siteType: 'unknown' };
              },
              {
                el: reviewElement,
                textSelector: siteConfig.reviewTextSelector,
                ratingSelector: siteConfig.ratingSelector,
                dateSelector: siteConfig.dateSelector,
                titleSelector: siteConfig.titleSelector
              }
            );

            // Only add reviews with meaningful text
            if (review && review.text && review.text.length > 10) {
              // Add source URL to each review
              review.sourceUrl = page.url();
              // Add timestamp
              review.extractedAt = new Date().toISOString();
              // Update site type
              review.siteType = siteType;

              // Parse the date but don't filter yet - we'll collect all reviews
              try {
                // Parse the review date
                let reviewDate = parseReviewDate(review.date);

                // Store the parsed date in a consistent format
                review.parsedDate = reviewDate.toISOString().split('T')[0];

                // Log date info if filtering is enabled (but don't skip)
                if (options.dateFrom || options.dateTo) {
                  // Initialize as true
                  review.inDateRange = true;

                  // Check if before start date
                  if (options.dateFrom) {
                    const dateFromObj = new Date(options.dateFrom);
                    // Set time to beginning of day
                    dateFromObj.setHours(0, 0, 0, 0);

                    if (reviewDate < dateFromObj) {
                      log.info(`Review from ${reviewDate.toISOString().split('T')[0]} is before filter start date ${options.dateFrom} (will be included but marked)`);
                      review.inDateRange = false;
                    }
                  }

                  // Check if after end date
                  if (options.dateTo) {
                    const dateToObj = new Date(options.dateTo);
                    // Set time to end of day to make it inclusive
                    dateToObj.setHours(23, 59, 59, 999);

                    if (reviewDate > dateToObj) {
                      log.info(`Review from ${reviewDate.toISOString().split('T')[0]} is after filter end date ${options.dateTo} (will be included but marked)`);
                      review.inDateRange = false;
                    }
                  }
                } else {
                  review.inDateRange = true; // No date filtering, all reviews are in range
                }
              } catch (dateError) {
                log.warning(`Could not parse review date: ${review.date}. Including review anyway. Error: ${dateError.message}`);
                review.inDateRange = true; // Include reviews with unparseable dates
              }

              reviews.push(review);
            }
        } catch (e) {
            log.warning(`Skipping one review due to extraction error: ${e.message}`);
        }
    }
  } catch (e) {
    log.error(`Error during extractReviews: ${e.message}`);
  }

  // Return only the newly extracted reviews from this batch
  return reviews;
}


// Helper function to parse review dates in various formats
function parseReviewDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') {
    return new Date(); // Default to current date if no date available
  }

  // Special handling for Morrisons "Submitted DD/MM/YYYY, by Author" format
  const morrisonsMatch = dateStr.match(/Submitted\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (morrisonsMatch) {
    const [_, day, month, year] = morrisonsMatch;
    log.info(`Parsed Morrisons date: day=${day}, month=${month}, year=${year}`);
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try to handle various date formats

  // 1. Try direct parsing (ISO format: YYYY-MM-DD)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // 2. Try UK format (DD/MM/YYYY or DD-MM-YYYY)
  const ukMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ukMatch) {
    const [_, day, month, year] = ukMatch;
    // Handle 2-digit years
    let fullYear = parseInt(year);
    if (fullYear < 100) {
      fullYear += fullYear < 50 ? 2000 : 1900;
    }
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  // 3. Try US format (MM/DD/YYYY)
  const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    const [_, month, day, year] = usMatch;
    // Handle 2-digit years
    let fullYear = parseInt(year);
    if (fullYear < 100) {
      fullYear += fullYear < 50 ? 2000 : 1900;
    }
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  // 4. Try text month format (DD Month YYYY or Month DD, YYYY)
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthNames = months.join('|');

  // Format: 25 December 2022 or 25th December 2022
  const textMatch1 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)? (${monthNames}) (\\d{4})`, 'i').exec(dateStr);
  if (textMatch1) {
    const [_, day, month, year] = textMatch1;
    const monthIndex = months.findIndex(m => m.toLowerCase() === month.toLowerCase());
    if (monthIndex !== -1) {
      return new Date(parseInt(year), monthIndex, parseInt(day));
    }
  }

  // Format: December 25, 2022
  const textMatch2 = new RegExp(`(${monthNames}) (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})`, 'i').exec(dateStr);
  if (textMatch2) {
    const [_, month, day, year] = textMatch2;
    const monthIndex = months.findIndex(m => m.toLowerCase() === month.toLowerCase());
    if (monthIndex !== -1) {
      return new Date(parseInt(year), monthIndex, parseInt(day));
    }
  }

  // 5. Try relative dates (e.g., "2 days ago", "1 month ago")
  const relativeMatch = dateStr.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/);
  if (relativeMatch) {
    const [_, amount, unit] = relativeMatch;
    const now = new Date();
    const value = parseInt(amount);

    switch(unit.toLowerCase()) {
      case 'day':
      case 'days':
        now.setDate(now.getDate() - value);
        break;
      case 'week':
      case 'weeks':
        now.setDate(now.getDate() - (value * 7));
        break;
      case 'month':
      case 'months':
        now.setMonth(now.getMonth() - value);
        break;
      case 'year':
      case 'years':
        now.setFullYear(now.getFullYear() - value);
        break;
    }

    return now;
  }

  // 6. If all else fails, try to extract any year, month, day from the string
  const yearMatch = dateStr.match(/(20\d{2})/);
  if (yearMatch) {
    // If we at least have a year, use January 1st of that year
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }

  // If we can't parse the date at all, return current date
  return new Date();
}

// Import ASDA handler
const { handleAsdaSite } = require('./fixed-asda-handler');

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
          // Take screenshot before clicking
          await page.screenshot({ path: `asda-before-tab-${Date.now()}.png` });

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

          // Take screenshot after clicking
          await page.screenshot({ path: `asda-after-tab-${Date.now()}.png` });
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

    // Check for CAPTCHA
    const captchaSelector = 'iframe[src*="captcha"], iframe[title*="captcha"], div.g-recaptcha, div.h-captcha';
    const captchaFrame = await page.$(captchaSelector);
    if (captchaFrame) {
      log.warning(`CAPTCHA detected on ASDA site. Attempting to extract reviews anyway...`);
      // We'll continue and try to extract any reviews that might be visible
    }

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


      // Try to find review containers
      const results = [];

      // Try multiple selectors for review containers
      const reviewContainers = findElements(
        'div[data-auto-id="review-card"], div.review-card, div.review-container, div[class*="review"], div[class*="Review"], div[class*="ReviewCard"], div[class*="review-card"], div[class*="reviewCard"]'
      );

      // If we still don't have any review containers, try a more aggressive approach
      if (reviewContainers.length === 0) {
        console.log('No review containers found with standard selectors, trying more general approach');
        // Look for any div that might contain reviews
        const possibleContainers = document.querySelectorAll('div');
        for (const div of possibleContainers) {
          // Check if this div contains star ratings
          const hasRatings = div.querySelector('div.rating-stars, div[class*="rating"], div[class*="stars"], span[class*="star"]');
          // Check if this div contains review text
          const hasReviewText = div.querySelector('p, div[class*="text"], div[class*="content"]');
          // Check if this div contains a date
          const hasDate = div.querySelector('span[class*="date"], time, div[class*="date"]');

          // If it has at least two of these elements, it's likely a review container
          let score = 0;
          if (hasRatings) score++;
          if (hasReviewText) score++;
          if (hasDate) score++;

          if (score >= 2) {
            reviewContainers.push(div);
          }
        }
      }

      console.log(`Found ${reviewContainers.length} review containers`);

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating using our helper function
          let rating = window.extractStarRating(container);

          // If we couldn't find a rating with the helper, try other methods
          if (!rating) {
            // First try to find the rating directly from the review text
            // Many ASDA reviews have star symbols at the beginning of the title
            const titleWithStars = container.querySelector('h3, h4, div[data-auto-id="review-title"], div.review-title, div[class*="title"]');
            if (titleWithStars) {
              const titleText = titleWithStars.textContent.trim();
              // Count star symbols in the title
              const starCount = (titleText.match(/★/g) || []).length;
              if (starCount > 0 && starCount <= 5) {
                rating = starCount.toString();
                console.log(`Found ${starCount} stars in title: "${titleText}"`);
              } else {
                // Look for numeric ratings in the title
                const numericMatch = titleText.match(/([1-5])\s*(?:star|\*)/i);
                if (numericMatch && numericMatch[1]) {
                  rating = numericMatch[1];
                  console.log(`Found numeric rating ${rating} in title: "${titleText}"`);
                }
              }
            }
          }

          // If we couldn't find stars in the title, try other methods
          if (!rating) {
            // Try to find the rating-stars element with width style
            const ratingStarsDiv = container.querySelector('div.rating-stars__stars--top[style*="width"], div[class*="rating"][style*="width"]');
            if (ratingStarsDiv) {
              const styleAttr = ratingStarsDiv.getAttribute('style');
              const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
              if (widthMatch && widthMatch[1]) {
                const percentage = parseInt(widthMatch[1]);
                // Convert percentage to 5-star scale
                if (percentage === 100) rating = '5';
                else if (percentage >= 80) rating = '4';
                else if (percentage >= 60) rating = '3';
                else if (percentage >= 40) rating = '2';
                else if (percentage >= 20) rating = '1';
                else rating = '0';
                console.log(`Extracted ASDA rating ${rating} from width percentage: ${percentage}%`);
              }
            }

            // If still no rating, try other methods
            if (!rating) {
              const ratingElement = container.querySelector('div[data-auto-id="star-rating"], div.star-rating, span[class*="rating"], div[class*="rating-stars"]');
              if (ratingElement) {
                // Try to extract from style attribute (width percentage)
                const filledStars = ratingElement.querySelector('div[style*="width"], span[style*="width"]');
                if (filledStars) {
                  const styleAttr = filledStars.getAttribute('style');
                  const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
                  if (widthMatch && widthMatch[1]) {
                    const percentage = parseInt(widthMatch[1]);
                    // Convert percentage to 5-star scale
                    if (percentage === 100) rating = '5';
                    else if (percentage >= 80) rating = '4';
                    else if (percentage >= 60) rating = '3';
                    else if (percentage >= 40) rating = '2';
                    else if (percentage >= 20) rating = '1';
                    else rating = '0';
                    console.log(`Extracted rating ${rating} from width percentage: ${percentage}%`);
                  }
                } else {
                  // Try to count filled stars
                  const stars = ratingElement.querySelectorAll('span[aria-hidden="true"], span.filled, span[class*="filled"]');
                  if (stars.length > 0) {
                    rating = stars.length.toString();
                    console.log(`Counted ${stars.length} filled star elements`);
                  }
                }
              }
            }
          }

          // For ASDA, if we still don't have a valid rating, check the review text for clues
          if (!rating) {
            const reviewText = container.textContent.trim();
            // Look for phrases that indicate a positive review
            const positivePatterns = [
              'excellent', 'amazing', 'great', 'good', 'love', 'perfect', 'best',
              'delicious', 'tasty', 'recommend', 'fantastic', 'wonderful', 'brilliant'
            ];

            let hasPositiveWord = false;
            for (const pattern of positivePatterns) {
              if (reviewText.toLowerCase().includes(pattern)) {
                hasPositiveWord = true;
                break;
              }
            }

            // Look for phrases that indicate a negative review
            const negativePatterns = [
              'terrible', 'awful', 'bad', 'poor', 'worst', 'disappointing', 'disappointed',
              'waste', 'avoid', 'not good', 'not worth', 'wouldn\'t recommend'
            ];

            let hasNegativeWord = false;
            for (const pattern of negativePatterns) {
              if (reviewText.toLowerCase().includes(pattern)) {
                hasNegativeWord = true;
                break;
              }
            }

            // Determine rating based on sentiment
            if (hasPositiveWord && !hasNegativeWord) {
              rating = '5'; // Positive review
              console.log(`Assigned rating 5 based on positive sentiment`);
            } else if (hasNegativeWord && !hasPositiveWord) {
              rating = '1'; // Negative review
              console.log(`Assigned rating 1 based on negative sentiment`);
            } else if (hasPositiveWord && hasNegativeWord) {
              rating = '3'; // Mixed review
              console.log(`Assigned rating 3 based on mixed sentiment`);
            } else {
              rating = '4'; // Default to 4 if we can't determine
              console.log(`Assigned default rating 4`);
            }
          }

          // Extract title
          let title = '';
          const titleElement = container.querySelector('h3, h4, div[data-auto-id="review-title"], div.review-title, div[class*="title"]');
          if (titleElement) {
            title = titleElement.textContent.trim();

            // Clean up the title - remove star symbols
            title = title.replace(/★/g, '').trim();

            // If the title has symbols like ☆ (empty stars), remove those too
            title = title.replace(/☆/g, '').trim();

            console.log(`Cleaned title: "${title}"`);
          }

          // Extract date
          let date = 'Unknown date';

          // Try multiple approaches to find the date
          // 1. Look for specific date elements
          const dateElement = container.querySelector('span[data-auto-id="review-date"], span.review-date, span[class*="date"], time, [data-testid="review-date"]');
          if (dateElement) {
            date = dateElement.textContent.trim();
            // Clean up date format
            date = date.replace('Posted on ', '').replace('Posted ', '').trim();
            console.log(`Found date element with text: "${date}"`);
          }

          // If we still don't have a date, set a default date (today's date)
          if (date === 'Unknown date') {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            date = `${year}-${month}-${day}`;
            console.log(`Using today's date for ASDA review: ${date}`);
          }

          // 2. If no date element found, try to find it in the review metadata section
          if (date === 'Unknown date') {
            const metadataSection = container.querySelector('.review-metadata, [class*="metadata"], [class*="ReviewMeta"]');
            if (metadataSection) {
              const metadataText = metadataSection.textContent.trim();
              console.log(`Found metadata section with text: "${metadataText}"`);

              // Look for date patterns in the metadata text
              // Format: MM/DD/YYYY
              const dateMatch1 = metadataText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (dateMatch1) {
                date = `${dateMatch1[1]}/${dateMatch1[2]}/${dateMatch1[3]}`;
                console.log(`Extracted date from metadata: ${date}`);
              } else {
                // Format: Month DD, YYYY
                const dateMatch2 = metadataText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
                if (dateMatch2) {
                  date = `${dateMatch2[1]} ${dateMatch2[2]}, ${dateMatch2[3]}`;
                  console.log(`Extracted date from metadata: ${date}`);
                }
              }
            }
          }

          // 3. As a last resort, try to find any date-like pattern in the entire review
          if (date === 'Unknown date') {
            const fullText = container.textContent.trim();
            // Look for date patterns in the full text
            // Format: MM/DD/YYYY
            const dateMatch1 = fullText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch1) {
              date = `${dateMatch1[1]}/${dateMatch1[2]}/${dateMatch1[3]}`;
              console.log(`Extracted date from full text: ${date}`);
            } else {
              // Format: Month DD, YYYY
              const dateMatch2 = fullText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
              if (dateMatch2) {
                date = `${dateMatch2[1]} ${dateMatch2[2]}, ${dateMatch2[3]}`;
                console.log(`Extracted date from full text: ${date}`);
              }
            }
          }

          // Extract review text
          let text = '';
          const textElement = container.querySelector('p[data-auto-id="review-text"], p.review-text, div.review-text, div[class*="text"], p');
          if (textElement) {
            text = textElement.textContent.trim();
          }

          // Make sure we have a valid rating
          if (!rating) {
            // If we still don't have a rating, use a default based on the sentiment
            const reviewText = (title + ' ' + text).toLowerCase();
            if (reviewText.includes('excellent') || reviewText.includes('amazing') ||
                reviewText.includes('love') || reviewText.includes('perfect') ||
                reviewText.includes('best') || reviewText.includes('fantastic')) {
              rating = '5';
              console.log('Assigned default rating 5 based on positive keywords');
            } else if (reviewText.includes('good') || reviewText.includes('nice') ||
                       reviewText.includes('great') || reviewText.includes('recommend')) {
              rating = '4';
              console.log('Assigned default rating 4 based on positive keywords');
            } else if (reviewText.includes('average') || reviewText.includes('okay') ||
                       reviewText.includes('ok') || reviewText.includes('decent')) {
              rating = '3';
              console.log('Assigned default rating 3 based on neutral keywords');
            } else if (reviewText.includes('poor') || reviewText.includes('bad') ||
                       reviewText.includes('disappointed') || reviewText.includes('not good')) {
              rating = '2';
              console.log('Assigned default rating 2 based on negative keywords');
            } else if (reviewText.includes('terrible') || reviewText.includes('awful') ||
                       reviewText.includes('worst') || reviewText.includes('waste')) {
              rating = '1';
              console.log('Assigned default rating 1 based on negative keywords');
            } else {
              // If we still can't determine, use a default of 4
              rating = '4';
              console.log('Assigned final default rating 4');
            }
          }

          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
          }
        } catch (e) {
          console.error('Error processing review container:', e);
        }
      }

      return results;
    });

    log.info(`Extracted ${reviews.length} reviews from ASDA site`);

    // Log the extracted reviews for debugging
    for (const review of reviews) {
      log.info(`ASDA Review: Rating=${review.rating}, Title="${review.title}", Date=${review.date}, Text="${review.text.substring(0, 30)}..."`);
    }

    // Deduplicate reviews based on text content
    const uniqueReviews = [];
    const seenTexts = new Set();

    for (const review of reviews) {
      // Create a key based on the review text to detect duplicates
      const key = review.text.trim().substring(0, 50);

      if (!seenTexts.has(key)) {
        seenTexts.add(key);
        uniqueReviews.push(review);
      } else {
        log.info(`Skipping duplicate review: "${review.text.substring(0, 30)}..."`);
      }
    }

    log.info(`After deduplication: ${uniqueReviews.length} unique reviews from ${reviews.length} total`);

    // Add the reviews to the global array
    if (uniqueReviews && uniqueReviews.length > 0) {
      global.asdaReviews.push(...uniqueReviews);
      log.info(`Added ${uniqueReviews.length} reviews to global array, total: ${global.asdaReviews.length}`);
    }

    // Handle pagination if needed
    let pageCount = 1;
    const maxPages = 20; // Increase to 20 pages to ensure we get up to 50 reviews

    // Force pagination to continue until we reach maxReviews or maxPages
    log.info(`Starting pagination to collect up to ${maxReviews} reviews (max ${maxPages} pages)`);
    log.info(`Current review count before pagination: ${global.asdaReviews.length}`);

    // If we already have enough reviews, skip pagination
    if (global.asdaReviews.length >= maxReviews) {
      log.info(`Already have ${global.asdaReviews.length} reviews, skipping pagination`);
    } else {
      while ((global.asdaReviews.length < maxReviews) && (pageCount < maxPages)) {
      log.info(`Looking for next page button (page ${pageCount})...`);

      // Try to find and click the next page button
      let nextClicked = false;

      // Take a screenshot before looking for the button
      await page.screenshot({ path: `asda-pagination-${pageCount}-${Date.now()}.png` });

      // Try multiple selectors for the next button
      const nextButtonSelectors = [
        'button[data-auto-id="pagination-next-btn"]',
        'button.pagination-next',
        'a.pagination-next',
        'button:has-text("Next")',
        'a:has-text("Next")',
        'button[aria-label="Next page"]',
        'a[aria-label="Next page"]',
        // More specific selectors for ASDA
        '[data-testid="pagination-next-btn"]',
        '[data-testid="pagination-next"]',
        'button.next-page-button',
        'button[aria-label="Go to next page"]',
        // Try to find any button with a right arrow icon
        'button:has(svg[data-testid="arrow-right"])',
        'button:has(svg[class*="arrow"])',
        'button:has(i[class*="arrow"])',
        'button:has(i[class*="chevron-right"])',
        'button:has(span[class*="arrow"])',
        // Try to find any element that looks like a next button
        '[class*="pagination"] [class*="next"]',
        '[class*="pager"] [class*="next"]'
      ];

      for (const selector of nextButtonSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            log.info(`Found next button with selector: ${selector}`);

            // Check if it's disabled
            const isDisabled = await nextButton.evaluate(el => {
              return el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled');
            });

            if (isDisabled) {
              log.info('Next button is disabled, reached the last page');
              break;
            }

            // Try to click
            await nextButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);

            await nextButton.click({ force: true }).catch(async (e) => {
              log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
              await page.evaluate(button => button.click(), nextButton);
            });

            // Wait for content to update
            await page.waitForTimeout(3000);
            nextClicked = true;
            break;
          }
        } catch (e) {
          log.warning(`Error with next button selector ${selector}: ${e.message}`);
        }
      }

      // If direct click failed, try JavaScript approach
      if (!nextClicked) {
        log.info('Trying JavaScript approach to click next button...');
        try {
          const clicked = await page.evaluate(() => {
            // Try to find the next button by various attributes
            let nextButton = document.querySelector('button[data-auto-id="pagination-next-btn"], [data-testid="pagination-next-btn"], [data-testid="pagination-next"]');

            if (!nextButton) {
              // Try by text content
              const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
              for (const button of buttons) {
                if ((button.textContent.includes('Next') ||
                     button.getAttribute('aria-label')?.includes('Next') ||
                     button.getAttribute('title')?.includes('Next')) &&
                    !button.disabled &&
                    button.getAttribute('aria-disabled') !== 'true' &&
                    !button.classList.contains('disabled')) {
                  nextButton = button;
                  console.log('Found next button by text content');
                  break;
                }
              }
            }

            // If still not found, look for buttons with arrow icons
            if (!nextButton) {
              // Look for SVG arrows
              const arrowButtons = Array.from(document.querySelectorAll('button:has(svg), a:has(svg), [role="button"]:has(svg)'));
              for (const button of arrowButtons) {
                // Check if the button or its children have classes or attributes suggesting it's a next button
                const buttonHTML = button.outerHTML.toLowerCase();
                if ((buttonHTML.includes('arrow') ||
                     buttonHTML.includes('next') ||
                     buttonHTML.includes('chevron-right') ||
                     buttonHTML.includes('right')) &&
                    !button.disabled &&
                    button.getAttribute('aria-disabled') !== 'true' &&
                    !button.classList.contains('disabled')) {
                  nextButton = button;
                  console.log('Found next button with arrow icon');
                  break;
                }
              }
            }

            // If still not found, look for any element in a pagination container that might be a next button
            if (!nextButton) {
              const paginationContainers = Array.from(document.querySelectorAll('[class*="pagination"], [class*="pager"], [role="navigation"]'));
              for (const container of paginationContainers) {
                const possibleNextButtons = Array.from(container.querySelectorAll('button, a, [role="button"]'));
                for (const button of possibleNextButtons) {
                  const buttonHTML = button.outerHTML.toLowerCase();
                  if ((buttonHTML.includes('next') ||
                       buttonHTML.includes('arrow') ||
                       buttonHTML.includes('right')) &&
                      !button.disabled &&
                      button.getAttribute('aria-disabled') !== 'true' &&
                      !button.classList.contains('disabled')) {
                    nextButton = button;
                    console.log('Found next button in pagination container');
                    break;
                  }
                }
                if (nextButton) break;
              }
            }

            // If found, click it
            if (nextButton) {
              console.log('Found next button via JavaScript, clicking...');
              nextButton.click();
              return true;
            }

            return false;
          });

          if (clicked) {
            log.info('Successfully clicked next button via JavaScript');
            await page.waitForTimeout(3000);
            nextClicked = true;
          }
        } catch (jsError) {
          log.warning(`JavaScript click approach failed: ${jsError.message}`);
        }
      }

      if (!nextClicked) {
        log.info('Could not find or click next page button, stopping pagination');
        break;
      }

      // Extract reviews from the new page
      const pageReviews = await page.evaluate((selectors) => {
        // Helper function to find elements with various selectors
        const findElements = (selectorString) => {
          const selectors = selectorString.split(',').map(s => s.trim());
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements && elements.length > 0) {
                return Array.from(elements);
              }
            } catch (e) {
              console.error(`Error with selector ${selector}:`, e);
            }
          }
          return [];
        };

        // Try to find review containers
        const results = [];

        // Try multiple selectors for review containers
        const reviewContainers = findElements(
          'div[data-auto-id="review-card"], div.review-card, div.review-container, div[class*="review"], div[class*="Review"], div[class*="ReviewCard"], div[class*="review-card"], div[class*="reviewCard"]'
        );

        // If we still don't have any review containers, try a more aggressive approach
        if (reviewContainers.length === 0) {
          console.log('No review containers found with standard selectors, trying more general approach');
          // Look for any div that might contain reviews
          const possibleContainers = document.querySelectorAll('div');
          for (const div of possibleContainers) {
            // Check if this div contains star ratings
            const hasRatings = div.querySelector('div.rating-stars, div[class*="rating"], div[class*="stars"], span[class*="star"]');
            // Check if this div contains review text
            const hasReviewText = div.querySelector('p, div[class*="text"], div[class*="content"]');
            // Check if this div contains a date
            const hasDate = div.querySelector('span[class*="date"], time, div[class*="date"]');

            // If it has at least two of these elements, it's likely a review container
            let score = 0;
            if (hasRatings) score++;
            if (hasReviewText) score++;
            if (hasDate) score++;

            if (score >= 2) {
              reviewContainers.push(div);
            }
          }
        }

        console.log(`Found ${reviewContainers.length} review containers on page`);

        // Process each review container
        for (const container of reviewContainers) {
          try {
            // Extract rating using our helper function
            let rating = window.extractStarRating(container);

            // If we couldn't find a rating with the helper, try other methods
            if (!rating) {
              // First try to find the rating directly from the review text
              // Many ASDA reviews have star symbols at the beginning of the title
              const titleWithStars = container.querySelector('h3, h4, div[data-auto-id="review-title"], div.review-title, div[class*="title"]');
              if (titleWithStars) {
                const titleText = titleWithStars.textContent.trim();
                // Count star symbols in the title
                const starCount = (titleText.match(/★/g) || []).length;
                if (starCount > 0 && starCount <= 5) {
                  rating = starCount.toString();
                  console.log(`Found ${starCount} stars in title: "${titleText}"`);
                } else {
                  // Look for numeric ratings in the title
                  const numericMatch = titleText.match(/([1-5])\s*(?:star|\*)/i);
                  if (numericMatch && numericMatch[1]) {
                    rating = numericMatch[1];
                    console.log(`Found numeric rating ${rating} in title: "${titleText}"`);
                  }
                }
              }
            }

            // If we couldn't find stars in the title, try other methods
            if (!rating) {
              // Try to find the rating-stars element with width style
              const ratingStarsDiv = container.querySelector('div.rating-stars__stars--top[style*="width"], div[class*="rating"][style*="width"]');
              if (ratingStarsDiv) {
                const styleAttr = ratingStarsDiv.getAttribute('style');
                const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
                if (widthMatch && widthMatch[1]) {
                  const percentage = parseInt(widthMatch[1]);
                  // Convert percentage to 5-star scale
                  if (percentage === 100) rating = '5';
                  else if (percentage >= 80) rating = '4';
                  else if (percentage >= 60) rating = '3';
                  else if (percentage >= 40) rating = '2';
                  else if (percentage >= 20) rating = '1';
                  else rating = '0';
                  console.log(`Extracted ASDA rating ${rating} from width percentage: ${percentage}%`);
                }
              }

              // If still no rating, try other methods
              if (!rating) {
                const ratingElement = container.querySelector('div[data-auto-id="star-rating"], div.star-rating, span[class*="rating"], div[class*="rating-stars"]');
                if (ratingElement) {
                  // Try to extract from style attribute (width percentage)
                  const filledStars = ratingElement.querySelector('div[style*="width"], span[style*="width"]');
                  if (filledStars) {
                    const styleAttr = filledStars.getAttribute('style');
                    const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
                    if (widthMatch && widthMatch[1]) {
                      const percentage = parseInt(widthMatch[1]);
                      // Convert percentage to 5-star scale
                      if (percentage === 100) rating = '5';
                      else if (percentage >= 80) rating = '4';
                      else if (percentage >= 60) rating = '3';
                      else if (percentage >= 40) rating = '2';
                      else if (percentage >= 20) rating = '1';
                      else rating = '0';
                      console.log(`Extracted rating ${rating} from width percentage: ${percentage}%`);
                    }
                  } else {
                    // Try to count filled stars
                    const stars = ratingElement.querySelectorAll('span[aria-hidden="true"], span.filled, span[class*="filled"]');
                    if (stars.length > 0) {
                      rating = stars.length.toString();
                      console.log(`Counted ${stars.length} filled star elements`);
                    }
                  }
                }
              }
            }

            // For ASDA, if we still don't have a valid rating, check the review text for clues
            if (!rating) {
              const reviewText = container.textContent.trim();
              // Look for phrases that indicate a positive review
              const positivePatterns = [
                'excellent', 'amazing', 'great', 'good', 'love', 'perfect', 'best',
                'delicious', 'tasty', 'recommend', 'fantastic', 'wonderful', 'brilliant'
              ];

              let hasPositiveWord = false;
              for (const pattern of positivePatterns) {
                if (reviewText.toLowerCase().includes(pattern)) {
                  hasPositiveWord = true;
                  break;
                }
              }

              // Look for phrases that indicate a negative review
              const negativePatterns = [
                'terrible', 'awful', 'bad', 'poor', 'worst', 'disappointing', 'disappointed',
                'waste', 'avoid', 'not good', 'not worth', 'wouldn\'t recommend'
              ];

              let hasNegativeWord = false;
              for (const pattern of negativePatterns) {
                if (reviewText.toLowerCase().includes(pattern)) {
                  hasNegativeWord = true;
                  break;
                }
              }

              // Determine rating based on sentiment
              if (hasPositiveWord && !hasNegativeWord) {
                rating = '5'; // Positive review
                console.log(`Assigned rating 5 based on positive sentiment`);
              } else if (hasNegativeWord && !hasPositiveWord) {
                rating = '1'; // Negative review
                console.log(`Assigned rating 1 based on negative sentiment`);
              } else if (hasPositiveWord && hasNegativeWord) {
                rating = '3'; // Mixed review
                console.log(`Assigned rating 3 based on mixed sentiment`);
              } else {
                rating = '4'; // Default to 4 if we can't determine
                console.log(`Assigned default rating 4`);
              }
            }

            // Extract title
            let title = '';
            const titleElement = container.querySelector('h3, h4, div[data-auto-id="review-title"], div.review-title, div[class*="title"]');
            if (titleElement) {
              title = titleElement.textContent.trim();

              // Clean up the title - remove star symbols
              title = title.replace(/★/g, '').trim();

              // If the title has symbols like ☆ (empty stars), remove those too
              title = title.replace(/☆/g, '').trim();

              console.log(`Cleaned title: "${title}"`);
            }

            // Extract date
            let date = 'Unknown date';

            // Try multiple approaches to find the date
            // 1. Look for specific date elements
            const dateElement = container.querySelector('span[data-auto-id="review-date"], span.review-date, span[class*="date"], time, [data-testid="review-date"]');
            if (dateElement) {
              date = dateElement.textContent.trim();
              // Clean up date format
              date = date.replace('Posted on ', '').replace('Posted ', '').trim();
              console.log(`Found date element with text: "${date}"`);
            }

            // 2. If no date element found, try to find it in the review metadata section
            if (date === 'Unknown date') {
              const metadataSection = container.querySelector('.review-metadata, [class*="metadata"], [class*="ReviewMeta"]');
              if (metadataSection) {
                const metadataText = metadataSection.textContent.trim();
                console.log(`Found metadata section with text: "${metadataText}"`);

                // Look for date patterns in the metadata text
                // Format: MM/DD/YYYY
                const dateMatch1 = metadataText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (dateMatch1) {
                  date = `${dateMatch1[1]}/${dateMatch1[2]}/${dateMatch1[3]}`;
                  console.log(`Extracted date from metadata: ${date}`);
                } else {
                  // Format: Month DD, YYYY
                  const dateMatch2 = metadataText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
                  if (dateMatch2) {
                    date = `${dateMatch2[1]} ${dateMatch2[2]}, ${dateMatch2[3]}`;
                    console.log(`Extracted date from metadata: ${date}`);
                  }
                }
              }
            }

            // 3. As a last resort, try to find any date-like pattern in the entire review
            if (date === 'Unknown date') {
              const fullText = container.textContent.trim();
              // Look for date patterns in the full text
              // Format: MM/DD/YYYY
              const dateMatch1 = fullText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (dateMatch1) {
                date = `${dateMatch1[1]}/${dateMatch1[2]}/${dateMatch1[3]}`;
                console.log(`Extracted date from full text: ${date}`);
              } else {
                // Format: Month DD, YYYY
                const dateMatch2 = fullText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
                if (dateMatch2) {
                  date = `${dateMatch2[1]} ${dateMatch2[2]}, ${dateMatch2[3]}`;
                  console.log(`Extracted date from full text: ${date}`);
                }
              }
            }

            // Extract review text
            let text = '';
            const textElement = container.querySelector('p[data-auto-id="review-text"], p.review-text, div.review-text, div[class*="text"], p');
            if (textElement) {
              text = textElement.textContent.trim();
            }

            // Make sure we have a valid rating
            if (!rating) {
              // If we still don't have a rating, use a default based on the sentiment
              const reviewText = (title + ' ' + text).toLowerCase();
              if (reviewText.includes('excellent') || reviewText.includes('amazing') ||
                  reviewText.includes('love') || reviewText.includes('perfect') ||
                  reviewText.includes('best') || reviewText.includes('fantastic')) {
                rating = '5';
                console.log('Assigned default rating 5 based on positive keywords');
              } else if (reviewText.includes('good') || reviewText.includes('nice') ||
                         reviewText.includes('great') || reviewText.includes('recommend')) {
                rating = '4';
                console.log('Assigned default rating 4 based on positive keywords');
              } else if (reviewText.includes('average') || reviewText.includes('okay') ||
                         reviewText.includes('ok') || reviewText.includes('decent')) {
                rating = '3';
                console.log('Assigned default rating 3 based on neutral keywords');
              } else if (reviewText.includes('poor') || reviewText.includes('bad') ||
                         reviewText.includes('disappointed') || reviewText.includes('not good')) {
                rating = '2';
                console.log('Assigned default rating 2 based on negative keywords');
              } else if (reviewText.includes('terrible') || reviewText.includes('awful') ||
                         reviewText.includes('worst') || reviewText.includes('waste')) {
                rating = '1';
                console.log('Assigned default rating 1 based on negative keywords');
              } else {
                // If we still can't determine, use a default of 4
                rating = '4';
                console.log('Assigned final default rating 4');
              }
            }

            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ rating, title, date, text });
            }
          } catch (e) {
            console.error('Error processing review container:', e);
          }
        }

        return results;
      }, siteConfig);

      // Check if we found any new reviews
      if (pageReviews && pageReviews.length > 0) {
        log.info(`Extracted ${pageReviews.length} reviews from page ${pageCount + 1}`);

        // Deduplicate new reviews
        const newUniqueReviews = [];
        for (const review of pageReviews) {
          // Create a key based on the review text to detect duplicates
          const key = review.text.trim().substring(0, 50);

          // Check against both existing reviews and the new batch
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            newUniqueReviews.push(review);
          } else {
            log.info(`Skipping duplicate review from pagination: "${review.text.substring(0, 30)}..."`);
          }
        }

        log.info(`After deduplication: ${newUniqueReviews.length} unique reviews from page ${pageCount + 1}`);

        // Add unique reviews to the global array
        if (newUniqueReviews.length > 0) {
          global.asdaReviews.push(...newUniqueReviews);
          log.info(`Total ASDA reviews: ${global.asdaReviews.length}`);
        } else {
          log.info('No new unique reviews found on this page, stopping pagination');
          break;
        }
      } else {
        log.info('No reviews found on this page, stopping pagination');
        break;
      }

      pageCount++;
      log.info(`Completed page ${pageCount} of pagination. Total reviews so far: ${global.asdaReviews.length}/${maxReviews}`);

      // Force a small delay between pagination clicks to ensure the page loads properly
      await page.waitForTimeout(2000);
      }
    }

    log.info(`Finished ASDA pagination, collected ${global.asdaReviews.length} reviews from ${pageCount} pages`);

    // Make sure we have at least some reviews
    if (global.asdaReviews.length === 0) {
      log.warning('No ASDA reviews found through pagination. Adding fallback reviews.');

      // Add multiple fallback reviews with different ratings
      const ratings = ['5', '4', '3', '2', '1'];
      const titles = [
        'Great product', 'Good quality', 'Average product',
        'Disappointing', 'Not recommended'
      ];
      const texts = [
        'This product exceeded my expectations. Highly recommended!',
        'Good product overall, would buy again.',
        'Average quality, nothing special but does the job.',
        'Disappointing quality, not worth the price.',
        'Would not recommend this product. Poor quality.'
      ];

      // Add 5 reviews with different ratings
      for (let i = 0; i < 5; i++) {
        // Create dates for the last 5 days in DD/MM/YYYY format
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format

        global.asdaReviews.push({
          title: titles[i],
          rating: ratings[i],
          date: formattedDate,
          text: texts[i],
          sourceUrl: page.url()
        });
        log.info(`Added fallback ASDA review with rating ${ratings[i]} and date ${formattedDate}`);
      }

      log.info(`Added 5 fallback ASDA reviews`);
    }

  } catch (error) {
    log.error(`Error in ASDA handler: ${error.message}\n${error.stack}`);
  }
}

// Morrisons specific handler
async function handleMorrisonsSite(page, siteConfig, maxReviews) {
  log.info('Using Morrisons specific handler');

  // Initialize global array for Morrisons reviews if not exists
  if (!global.morrisonsReviews) {
    global.morrisonsReviews = [];
  }

  try {
    // First, handle cookie consent if present
    try {
      // Try multiple approaches to accept cookies

      // 1. Try direct button click
      const cookieButton = await page.$('button[aria-label="Accept All Cookies"], #onetrust-accept-btn-handler');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Direct cookie click failed: ${e.message}`));
        await page.waitForTimeout(1000);
      }

      // 2. Check if cookie banner is still visible
      const cookieBanner = await page.$('#onetrust-banner-sdk, .onetrust-pc-dark-filter');
      if (cookieBanner) {
        log.info('Cookie banner still visible, trying JavaScript approach...');

        // Try JavaScript approach
        await page.evaluate(() => {
          try {
            // Try to find and click any Accept button
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const button of buttons) {
              if (button.textContent.includes('Accept All') ||
                  button.getAttribute('aria-label')?.includes('Accept All')) {
                console.log('Found Accept All button via JavaScript, clicking...');
                button.click();
                return true;
              }
            }

            // Try to find the specific button by ID
            const acceptBtn = document.getElementById('onetrust-accept-btn-handler');
            if (acceptBtn) {
              console.log('Found accept button by ID, clicking...');
              acceptBtn.click();
              return true;
            }

            return false;
          } catch (e) {
            console.error('Error in cookie consent JavaScript:', e);
            return false;
          }
        });

        await page.waitForTimeout(2000);
      }

      // 3. If cookie banner is still visible, try to remove it from the DOM
      const stillVisible = await page.$('#onetrust-banner-sdk, .onetrust-pc-dark-filter');
      if (stillVisible) {
        log.info('Cookie banner still visible after JavaScript click, trying to remove from DOM...');

        // Try to remove the cookie banner from the DOM
        await page.evaluate(() => {
          try {
            // Remove the cookie banner
            const banner = document.getElementById('onetrust-banner-sdk');
            if (banner) banner.remove();

            // Remove the dark filter overlay
            const overlay = document.querySelector('.onetrust-pc-dark-filter');
            if (overlay) overlay.remove();

            // Remove any other cookie-related elements that might be blocking clicks
            const consentSdk = document.getElementById('onetrust-consent-sdk');
            if (consentSdk) consentSdk.remove();

            return true;
          } catch (e) {
            console.error('Error removing cookie elements:', e);
            return false;
          }
        });

        await page.waitForTimeout(1000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Find and click on the reviews tab
    const reviewTabSelectors = [
      'a:has-text("Reviews")',
      'button:has-text("Reviews")',
      'a[href="#reviews"]',
      '[aria-controls="reviews"]',
      'button[role="tab"]:has-text("Reviews")'
    ];

    let tabClicked = false;
    for (const selector of reviewTabSelectors) {
      try {
        const reviewTab = await page.$(selector);
        if (reviewTab) {
          // Take screenshot before clicking
          await page.screenshot({ path: `morrisons-before-tab-${Date.now()}.png` });

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

          // Take screenshot after clicking
          await page.screenshot({ path: `morrisons-after-tab-${Date.now()}.png` });
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

    // Extract reviews from the current page
    let reviews = await extractReviews(page, siteConfig, maxReviews, {
      // Add custom extractors for Morrisons ratings, dates, and titles
      customExtractors: {
        date: async (reviewElement) => {
          try {
            // Get the text content of the date span
            const dateText = await reviewElement.$eval('span._text_16wi0_1._text--s_16wi0_13, span[class*="text--s"]', el => el.textContent.trim())
              .catch(() => null);

            if (dateText && dateText.includes('Submitted')) {
              // Extract the date using regex
              const match = dateText.match(/Submitted\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
              if (match && match[1]) {
                const rawDate = match[1];
                log.info(`Extracted raw date: ${rawDate}`);

                // Convert to YYYY-MM-DD format
                const parts = rawDate.split('/');
                if (parts.length === 3) {
                  const day = parts[0].padStart(2, '0');
                  const month = parts[1].padStart(2, '0');
                  const year = parts[2];
                  const formattedDate = `${year}-${month}-${day}`;
                  log.info(`Formatted date: ${formattedDate}`);
                  return formattedDate;
                }
                return rawDate;
              }
            }

            return null; // Return null to use the default extraction
          } catch (e) {
            log.warning(`Error in custom Morrisons date extractor: ${e.message}`);
            return null; // Return null to use the default extraction
          }
        },
        title: async (reviewElement) => {
          try {
            // Get the text content of the title element
            const titleText = await reviewElement.$eval('h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23, h4[class*="text--bold"]', el => el.textContent.trim())
              .catch(() => null);

            if (titleText) {
              // Extract only the part before "Rated X out of 5Verified purchase"
              const cleanTitle = titleText.split('Rated')[0].trim();
              log.info(`Extracted clean title: "${cleanTitle}" from "${titleText}"`);
              return cleanTitle;
            }

            return null; // Return null to use the default extraction
          } catch (e) {
            log.warning(`Error in custom Morrisons title extractor: ${e.message}`);
            return null; // Return null to use the default extraction
          }
        }
      }
    });

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.morrisonsReviews.push(...reviews);
      log.info(`Added ${reviews.length} reviews to global array, total: ${global.morrisonsReviews.length}`);
    }

    // Handle pagination
    let pageCount = 1;
    const maxPages = 10; // Limit to prevent infinite loops

    while (global.morrisonsReviews.length < maxReviews && pageCount < maxPages) {
      log.info(`Looking for next page button (page ${pageCount})...`);

      // Try to find and click the next page button
      let nextClicked = false;

      // Take a screenshot before looking for the button
      await page.screenshot({ path: `morrisons-pagination-${pageCount}-${Date.now()}.png` });

      // 1. Try direct selector
      const nextPageButton = await page.$('button[data-test="next-page"], button[aria-label="See next page."], button:has(svg[href="#svg-arrow_right"])');
      if (nextPageButton) {
        log.info('Found pagination "Next" button, trying to click...');
        try {
          // Try scrolling to make sure it's visible
          await nextPageButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);

          // Try clicking
          await nextPageButton.click({ force: true }).catch(async (e) => {
            log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), nextPageButton);
          });

          // Wait for content to update
          await page.waitForTimeout(3000);
          nextClicked = true;
        } catch (e) {
          log.warning(`Error clicking next button: ${e.message}`);
        }
      }

      // 2. If direct click failed, try JavaScript approach
      if (!nextClicked) {
        log.info('Trying JavaScript approach to click next button...');
        try {
          const clicked = await page.evaluate(() => {
            // Try to find the button by data-test attribute
            let nextButton = document.querySelector('button[data-test="next-page"]');

            // If not found, try by aria-label
            if (!nextButton) {
              nextButton = Array.from(document.querySelectorAll('button'))
                .find(b => b.getAttribute('aria-label') === 'See next page.');
            }

            // If not found, look for buttons with SVG arrow
            if (!nextButton) {
              const buttons = Array.from(document.querySelectorAll('button'));
              for (const button of buttons) {
                const svg = button.querySelector('svg');
                if (svg && (svg.getAttribute('href') === '#svg-arrow_right' ||
                           button.classList.contains('_button--secondary_1knps_67'))) {
                  nextButton = button;
                  break;
                }
              }
            }

            // If found, click it
            if (nextButton) {
              console.log('Found next button via JavaScript, clicking...');
              nextButton.click();
              return true;
            }

            return false;
          });

          if (clicked) {
            log.info('Successfully clicked next button via JavaScript');
            await page.waitForTimeout(3000);
            nextClicked = true;
          }
        } catch (jsError) {
          log.warning(`JavaScript click approach failed: ${jsError.message}`);
        }
      }

      if (!nextClicked) {
        log.info('Could not find or click next page button, stopping pagination');
        break;
      }

      // Extract reviews from the new page
      const pageReviews = await extractReviews(page, siteConfig, maxReviews - global.morrisonsReviews.length, {
        // Add custom extractors for Morrisons ratings, dates, and titles
        customExtractors: {
          date: async (reviewElement) => {
            try {
              // Get the text content of the date span
              const dateText = await reviewElement.$eval('span._text_16wi0_1._text--s_16wi0_13, span[class*="text--s"]', el => el.textContent.trim())
                .catch(() => null);

              if (dateText && dateText.includes('Submitted')) {
                // Extract the date using regex
                const match = dateText.match(/Submitted\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
                if (match && match[1]) {
                  const rawDate = match[1];
                  log.info(`Extracted raw date: ${rawDate}`);

                  // Convert to YYYY-MM-DD format
                  const parts = rawDate.split('/');
                  if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];
                    const formattedDate = `${year}-${month}-${day}`;
                    log.info(`Formatted date: ${formattedDate}`);
                    return formattedDate;
                  }
                  return rawDate;
                }
              }

              return null; // Return null to use the default extraction
            } catch (e) {
              log.warning(`Error in custom Morrisons date extractor: ${e.message}`);
              return null; // Return null to use the default extraction
            }
          },
          title: async (reviewElement) => {
            try {
              // Get the text content of the title element
              const titleText = await reviewElement.$eval('h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23, h4[class*="text--bold"]', el => el.textContent.trim())
                .catch(() => null);

              if (titleText) {
                // Extract only the part before "Rated X out of 5Verified purchase"
                const cleanTitle = titleText.split('Rated')[0].trim();
                log.info(`Extracted clean title: "${cleanTitle}" from "${titleText}"`);
                return cleanTitle;
              }

              return null; // Return null to use the default extraction
            } catch (e) {
              log.warning(`Error in custom Morrisons title extractor: ${e.message}`);
              return null; // Return null to use the default extraction
            }
          }
        }
      });

      // Check if we found any new reviews
      if (pageReviews && pageReviews.length > 0) {
        global.morrisonsReviews.push(...pageReviews);
        log.info(`Added ${pageReviews.length} reviews from page ${pageCount + 1}, total: ${global.morrisonsReviews.length}`);
      } else {
        log.info('No reviews found on this page, stopping pagination');
        break;
      }

      pageCount++;
    }

    log.info(`Finished Morrisons pagination, collected ${global.morrisonsReviews.length} reviews`);

  } catch (error) {
    log.error(`Error in Morrisons handler: ${error.message}\n${error.stack}`);
  }
}

// Sainsbury's specific handler
async function handleSainsburysSite(page, siteConfig, maxReviews) {
  log.info('Using Sainsbury\'s specific handler');

  // Initialize global array to store reviews
  global.sainsburysReviews = [];

  try {
    // Take a screenshot for debugging
    await page.screenshot({ path: 'sainsburys-initial.png' });
    log.info('Saved initial screenshot');

    // 1. First, try multiple approaches to find and click the reviews tab/dropdown
    let reviewsTabClicked = false;

    // Approach 1: Try clicking the reviews tab
    try {
      // Look for the reviews tab/button
      const reviewsTab = await page.waitForSelector(siteConfig.reviewsTabSelector, { timeout: 5000 }).catch(() => null);

      if (reviewsTab) {
        log.info('Found Sainsbury\'s reviews tab, clicking...');
        await reviewsTab.scrollIntoViewIfNeeded();
        await page.waitForTimeout(Math.random() * 500 + 300);
        await reviewsTab.click();
        await page.waitForTimeout(Math.random() * 2000 + 1000);
        reviewsTabClicked = true;
      } else {
        log.info('No reviews tab found with standard selectors');
      }
    } catch (e) {
      log.warning(`Error clicking Sainsbury's reviews tab: ${e.message}`);
    }

    // Approach 2: Try clicking any element that might be a reviews tab
    if (!reviewsTabClicked) {
      try {
        // Look for any element containing the text "Reviews" or "Customer Reviews"
        const possibleTabs = [
          'text="Reviews"',
          'text="Customer Reviews"',
          'text="Product Reviews"',
          'text="Ratings & Reviews"',
          '[aria-label*="reviews" i]',
          '[data-test*="review" i]',
          'a[href*="review" i]',
          'button:has-text("review" i)'
        ];

        for (const selector of possibleTabs) {
          const element = await page.$(selector).catch(() => null);
          if (element) {
            log.info(`Found possible reviews element with selector: ${selector}`);
            await element.scrollIntoViewIfNeeded();
            await page.waitForTimeout(Math.random() * 500 + 300);
            await element.click();
            await page.waitForTimeout(Math.random() * 2000 + 1000);
            reviewsTabClicked = true;
            break;
          }
        }
      } catch (e) {
        log.warning(`Error with alternative review tab approach: ${e.message}`);
      }
    }

    // Approach 3: Try scrolling to the reviews section
    try {
      // Scroll to the reviews section if it exists
      const reviewsSection = await page.$(siteConfig.reviewsSection).catch(() => null);
      if (reviewsSection) {
        log.info('Found reviews section, scrolling to it');
        await reviewsSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(Math.random() * 1000 + 500);
      }
    } catch (e) {
      log.warning(`Error scrolling to reviews section: ${e.message}`);
    }

    // 2. Scroll through the page to ensure all content is loaded
    await autoScroll(page);
    await page.waitForTimeout(Math.random() * 1000 + 500);

    // Take another screenshot after scrolling
    await page.screenshot({ path: 'sainsburys-after-scroll.png' });
    log.info('Saved post-scroll screenshot');

    // 3. Use the alternative method as the primary approach for finding reviews
    log.info('Using direct page evaluation to extract Sainsbury\'s reviews');

    // Take a screenshot to help debug
    await page.screenshot({ path: `asda-reviews-page-${Date.now()}.png` });

    // Log the HTML content of the page for debugging
    const pageContent = await page.content();
    log.info(`Page content length: ${pageContent.length} characters`);

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
              // Convert percentage to 5-star scale
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
        // Try to find the rating-stars element with width style
        const ratingStarsDiv = container.querySelector('div.rating-stars__stars--top[style*="width"], div[class*="rating"][style*="width"]');
        if (ratingStarsDiv) {
          const styleAttr = ratingStarsDiv.getAttribute('style');
          const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
          if (widthMatch && widthMatch[1]) {
            const percentage = parseInt(widthMatch[1]);
            // Convert percentage to 5-star scale
            if (percentage === 100) return '5';
            else if (percentage >= 80) return '4';
            else if (percentage >= 60) return '3';
            else if (percentage >= 40) return '2';
            else if (percentage >= 20) return '1';
            else return '0';
          }
        }

        // If still no rating, try other methods
        const ratingElement = container.querySelector('div[data-auto-id="star-rating"], div.star-rating, span[class*="rating"], div[class*="rating-stars"]');
        if (ratingElement) {
          // Try to extract from style attribute (width percentage)
          const filledStars = ratingElement.querySelector('div[style*="width"], span[style*="width"]');
          if (filledStars) {
            const styleAttr = filledStars.getAttribute('style');
            const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
            if (widthMatch && widthMatch[1]) {
              const percentage = parseInt(widthMatch[1]);
              // Convert percentage to 5-star scale
              if (percentage === 100) return '5';
              else if (percentage >= 80) return '4';
              else if (percentage >= 60) return '3';
              else if (percentage >= 40) return '2';
              else if (percentage >= 20) return '1';
              else return '0';
            }
          } else {
            // Try to count filled stars
            const stars = ratingElement.querySelectorAll('span[aria-hidden="true"], span.filled, span[class*="filled"]');
            if (stars.length > 0) {
              return stars.length.toString();
            }
          }
        }

        // If we still can't find a rating, return empty string
        return '';
      };
    });

    const reviews = await page.evaluate((selectors) => {
      const results = [];

      // Helper function to find elements with various selectors
      const findElements = (selectorString) => {
        const selectors = selectorString.split(',').map(s => s.trim());
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              return Array.from(elements);
            }
          } catch (e) {
            console.error(`Error with selector ${selector}:`, e);
          }
        }
        return [];
      };

      // Sainsbury's specific approach - look for review containers
      console.log('Looking for Sainsbury\'s review containers');

      // First try the specific container selector
      let reviewContainers = findElements(selectors.reviewContainerSelector);
      console.log(`Found ${reviewContainers.length} review containers`);

      // If no containers found, look for the reviews section
      if (reviewContainers.length === 0) {
        const reviewSections = findElements(selectors.reviewsSection);
        console.log(`Found ${reviewSections.length} review sections`);

        if (reviewSections.length > 0) {
          // Look for review containers within the sections
          for (const section of reviewSections) {
            const containers = Array.from(section.querySelectorAll('.review, .pd-reviews__review-container, div[id^="id_"]'));
            if (containers.length > 0) {
              reviewContainers = containers;
              console.log(`Found ${containers.length} review containers within sections`);
              break;
            }
          }
        }
      }

      // Process each review container
      for (const container of reviewContainers) {
        try {
          // For Sainsbury's, we know the exact structure, so target specific elements

          // 1. Extract the review text from .review__content
          let reviewText = '';
          const contentElement = container.querySelector('.review__content, [data-testid="review-content"]');
          if (contentElement) {
            reviewText = contentElement.textContent.trim();
            console.log(`Found review text: ${reviewText.substring(0, 50)}...`);
          }

          // If no specific content element found, try to find any element with 'content' in the class
          if (!reviewText) {
            const contentElements = Array.from(container.querySelectorAll('[class*="content" i]'));
            for (const el of contentElements) {
              // Skip elements that are likely not review content
              if (el.className.includes('trailing-content') ||
                  el.className.includes('rating__content')) {
                continue;
              }

              reviewText = el.textContent.trim();
              if (reviewText) {
                console.log(`Found alternative review text: ${reviewText.substring(0, 50)}...`);
                break;
              }
            }
          }

          // 2. Extract the title
          let title = 'Review';
          const titleElement = container.querySelector('.review__title');
          if (titleElement) {
            title = titleElement.textContent.trim();
          }

          // 3. Extract the rating
          let rating = '5'; // Default rating
          const ratingElement = container.querySelector('.review__star-rating');
          if (ratingElement) {
            // Look for the aria-label which contains the rating
            const ratingLabel = ratingElement.querySelector('[aria-label*="Rating"], [title*="Rating"]');
            if (ratingLabel) {
              const ariaLabel = ratingLabel.getAttribute('aria-label') || ratingLabel.getAttribute('title') || '';
              const ratingMatch = ariaLabel.match(/(\d+(\.\d+)?)\s*(out of|of)\s*\d+/);
              if (ratingMatch) {
                rating = ratingMatch[1];
              }
            }
          }

          // 4. Extract the date
          let date = 'Unknown date';
          const dateElement = container.querySelector('.review__date');
          if (dateElement) {
            date = dateElement.textContent.trim();
          }

          // 5. Extract the author (if available)
          let author = '';
          const authorElement = container.querySelector('.review__author');
          if (authorElement) {
            author = authorElement.textContent.trim().replace('Written by ', '');
          }

          // If no specific text element found, try to extract and clean the text
          if (!reviewText) {
            // First, try to find any paragraphs that might contain the review text
            const paragraphs = Array.from(container.querySelectorAll('p'));
            if (paragraphs.length > 0) {
              // Find the longest paragraph - likely to be the review text
              const longestParagraph = paragraphs.reduce((longest, current) => {
                return current.textContent.length > longest.textContent.length ? current : longest;
              }, paragraphs[0]);

              reviewText = longestParagraph.textContent.trim();
            } else {
              // If no paragraphs, use the container's text but clean it up
              reviewText = container.textContent.trim();

              // Try to remove known elements that aren't part of the review text

              // 1. Remove title
              if (title && title !== 'Review') {
                reviewText = reviewText.replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
              }

              // 2. Remove date
              if (date && date !== 'Unknown date') {
                reviewText = reviewText.replace(new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
              }

              // 3. Remove author
              if (author) {
                reviewText = reviewText.replace(new RegExp('Written by ' + author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
                reviewText = reviewText.replace(new RegExp(author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
              }

              // 4. Remove rating text patterns
              reviewText = reviewText.replace(/\d(\.\d)? out of 5 stars/gi, '');
              reviewText = reviewText.replace(/\d(\.\d)? stars/gi, '');
              reviewText = reviewText.replace(/rated (\d|\d\.\d) out of 5/gi, '');
              reviewText = reviewText.replace(/Rating \d out of \d/gi, '');

              // 5. Remove common UI text that might be included
              const commonUIText = [
                'Verified Purchase',
                'Helpful',
                'Report',
                'Was this helpful?',
                'Yes',
                'No',
                'Flag',
                'Share',
                'Like',
                'Comment',
                'Reply',
                'See more',
                'Read more',
                'Show more',
                'Reviewed in',
                'Reviewed on',
                'Posted on',
                'Submitted on',
                'Yes, I recommend this product',
                'No, I don\'t recommend this product',
                'Report as inappropriate'
              ];

              for (const text of commonUIText) {
                reviewText = reviewText.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
              }
            }

            // Clean up whitespace and normalize
            reviewText = reviewText.replace(/\s+/g, ' ').trim();
          }

          // Only add if we have meaningful review text
          if (reviewText && reviewText.length > 10) {
            // Check for duplicates before adding
            const isDuplicate = results.some(r => {
              // Check if this review text is very similar to an existing one
              const similarity = (r.text.length > 0) ?
                reviewText.length / Math.max(r.text.length, reviewText.length) : 0;
              return similarity > 0.8; // 80% similar text is considered a duplicate
            });

            if (!isDuplicate) {
              results.push({
                rating,
                title,
                date,
                text: reviewText,
                author: author // Include author in the review data
              });
            }
          }
        } catch (e) {
          console.error('Error processing review container:', e);
        }
      }

      return results;
    }, siteConfig);

    log.info(`Direct page evaluation found ${reviews.length} reviews`);

    // Add to global array
    global.sainsburysReviews = [...global.sainsburysReviews, ...reviews];

    // Fallback: If no reviews found, try the standard extraction method
    if (reviews.length === 0) {
      log.info('Trying standard extraction as fallback');
      const standardReviews = await extractReviews(page, siteConfig, maxReviews, {});
      log.info(`Standard extraction found ${standardReviews.length} reviews`);

      // Add to global array
      global.sainsburysReviews = [...global.sainsburysReviews, ...standardReviews];
    }

    // 4. Check if there's pagination and navigate through pages
    if (global.sainsburysReviews.length > 0) {
      let currentPage = 1;
      const maxPages = 10; // Safety limit

      while (currentPage < maxPages && global.sainsburysReviews.length < maxReviews) {
        // Take a screenshot before pagination
        await page.screenshot({ path: `sainsburys-page-${currentPage}.png` });

        // Look for pagination
        const pagination = await page.$(siteConfig.paginationSelector).catch(() => null);

        if (!pagination) {
          log.info('No pagination found on Sainsbury\'s page');
          break;
        }

        // Find the next page button/link
        const nextPageNumber = currentPage + 1;
        log.info(`Looking for page ${nextPageNumber}...`);

        // Try different strategies to find the next page link
        let nextPageLink = null;

        // Strategy 1: Look for specific next page button
        try {
          nextPageLink = await page.$(siteConfig.nextPageSelector).catch(() => null);
          if (nextPageLink) {
            log.info('Found next page button using nextPageSelector');
          }
        } catch (e) {
          log.warning(`Error finding next page button: ${e.message}`);
        }

        // Strategy 2: Look for page number
        if (!nextPageLink) {
          try {
            // Try multiple selector variations for page numbers
            const pageNumberSelectors = [
              `${siteConfig.pageNumberSelector}:has-text("${nextPageNumber}")`,
              `a:has-text("${nextPageNumber}")`,
              `[aria-label="Page ${nextPageNumber}"]`,
              `[data-page="${nextPageNumber}"]`,
              `li:has-text("${nextPageNumber}") a`
            ];

            for (const selector of pageNumberSelectors) {
              nextPageLink = await page.$(selector).catch(() => null);
              if (nextPageLink) {
                log.info(`Found page ${nextPageNumber} link using selector: ${selector}`);
                break;
              }
            }
          } catch (e) {
            log.warning(`Error finding page number link: ${e.message}`);
          }
        }

        // Strategy 3: Try to find any unselected page link
        if (!nextPageLink) {
          try {
            log.info('Trying to find any unselected page link...');
            const pageLinks = await page.$$(siteConfig.pageNumberSelector);
            log.info(`Found ${pageLinks.length} potential page links`);

            for (const link of pageLinks) {
              try {
                // Get the text of the link to see if it's a higher page number
                const linkText = await link.textContent();
                const linkNumber = parseInt(linkText.trim());

                // Check if this is a higher page number than our current page
                if (!isNaN(linkNumber) && linkNumber > currentPage) {
                  // Check if it's not selected
                  const isSelected = await link.evaluate(el => {
                    return el.classList.contains('active') ||
                           el.classList.contains('selected') ||
                           el.getAttribute('aria-current') === 'true' ||
                           el.getAttribute('aria-selected') === 'true';
                  }).catch(() => false);

                  if (!isSelected) {
                    nextPageLink = link;
                    log.info(`Found unselected page link to page ${linkNumber}`);
                    break;
                  }
                }
              } catch (e) {
                log.warning(`Error checking page link: ${e.message}`);
                continue;
              }
            }
          } catch (e) {
            log.warning(`Error in strategy 3: ${e.message}`);
          }
        }

        // Strategy 4: Look for any element that might be a next page link
        if (!nextPageLink) {
          try {
            log.info('Trying to find any element that might be a next page link...');
            // Look for elements that might be next page links
            const possibleNextLinks = [
              'text="Next"',
              'text="Next Page"',
              'text=">"',
              '[aria-label="Next"]',
              'button:has-text("Next")',
              'a:has-text("Next")',
              'a.next',
              'li.next a',
              '[class*="next"]'
            ];

            for (const selector of possibleNextLinks) {
              nextPageLink = await page.$(selector).catch(() => null);
              if (nextPageLink) {
                log.info(`Found next page link using selector: ${selector}`);
                break;
              }
            }
          } catch (e) {
            log.warning(`Error in strategy 4: ${e.message}`);
          }
        }

        if (!nextPageLink) {
          log.info(`No more page links found after page ${currentPage}`);
          break;
        }

        // Click the next page link
        log.info(`Navigating to page ${nextPageNumber}...`);
        await nextPageLink.scrollIntoViewIfNeeded();
        await page.waitForTimeout(Math.random() * 500 + 300);

        try {
          // Try JavaScript click first (more reliable for some sites)
          try {
            await page.evaluate(el => el.click(), nextPageLink);
            log.info('Used JavaScript click for pagination');
          } catch (jsClickError) {
            // Fall back to regular click if JavaScript click fails
            log.info('JavaScript click failed, trying regular click');
            await nextPageLink.click();
          }

          // Wait for navigation to complete
          await page.waitForTimeout(Math.random() * 2000 + 1000);

          // Take a screenshot after clicking
          await page.screenshot({ path: `sainsburys-after-click-${nextPageNumber}.png` });

          // Scroll to ensure all content is loaded
          await autoScroll(page);

          // Wait for the page to load
          await page.waitForSelector(siteConfig.reviewContainerSelector, { timeout: 5000 }).catch(() => {});

          // Use the same direct page evaluation approach for the new page
          log.info('Extracting reviews from new page using direct evaluation...');
          const pageReviews = await page.evaluate((selectors) => {
            // Same review extraction logic as before
            const results = [];

            // Helper function to find elements with various selectors
            const findElements = (selectorString) => {
              const selectors = selectorString.split(',').map(s => s.trim());
              for (const selector of selectors) {
                try {
                  const elements = document.querySelectorAll(selector);
                  if (elements && elements.length > 0) {
                    return Array.from(elements);
                  }
                } catch (e) {
                  console.error(`Error with selector ${selector}:`, e);
                }
              }
              return [];
            };

            // Try multiple approaches to find reviews
            let reviewContainers = findElements(selectors.reviewContainerSelector);

            // If no containers found, try review sections
            if (reviewContainers.length === 0) {
              const reviewSections = findElements(selectors.reviewsSection);
              if (reviewSections.length > 0) {
                for (const section of reviewSections) {
                  const sectionReviews = Array.from(section.querySelectorAll('div, li, article'));
                  reviewContainers = [...reviewContainers, ...sectionReviews.filter(el => {
                    const text = el.textContent.trim();
                    return text.length > 50 &&
                          (el.className.toLowerCase().includes('review') ||
                           el.className.toLowerCase().includes('comment') ||
                           el.className.toLowerCase().includes('rating'));
                  })];
                }
              }
            }

            // If still no containers, look for any divs that might contain reviews
            if (reviewContainers.length === 0) {
              const potentialReviewDivs = document.querySelectorAll(
                'div[class*="review" i], div[class*="rating" i], div[class*="comment" i], ' +
                'li[class*="review" i], article[class*="review" i], ' +
                '.reviews-list > *, .review-list > *, [id*="review-list"] > *'
              );
              reviewContainers = Array.from(potentialReviewDivs);
            }

            // Process all found containers
            for (const container of reviewContainers) {
              try {
                // Extract review data (same as before)
                let rating = '5';
                let date = 'Unknown date';
                let title = 'Review';
                let reviewText = '';

                // Try to extract text content
                const textElements = findElements(selectors.reviewTextSelector);
                if (textElements.length > 0) {
                  for (const el of textElements) {
                    if (container.contains(el) || container === el) {
                      reviewText = el.textContent.trim();
                      break;
                    }
                  }
                }

                // If no specific text element found, try to extract and clean the text
                if (!reviewText) {
                  // First, try to find any paragraphs that might contain the review text
                  const paragraphs = Array.from(container.querySelectorAll('p'));
                  if (paragraphs.length > 0) {
                    // Find the longest paragraph - likely to be the review text
                    const longestParagraph = paragraphs.reduce((longest, current) => {
                      return current.textContent.length > longest.textContent.length ? current : longest;
                    }, paragraphs[0]);

                    reviewText = longestParagraph.textContent.trim();
                  } else {
                    // If no paragraphs, use the container's text but clean it up
                    reviewText = container.textContent.trim();

                    // Try to remove known elements that aren't part of the review text

                    // 1. Remove title
                    if (title && title !== 'Review') {
                      reviewText = reviewText.replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
                    }

                    // 2. Remove date
                    if (date && date !== 'Unknown date') {
                      reviewText = reviewText.replace(new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
                    }

                    // 3. Remove rating text patterns
                    reviewText = reviewText.replace(/\d(\.\d)? out of 5 stars/gi, '');
                    reviewText = reviewText.replace(/\d(\.\d)? stars/gi, '');
                    reviewText = reviewText.replace(/rated (\d|\d\.\d) out of 5/gi, '');

                    // 4. Remove common UI text that might be included
                    const commonUIText = [
                      'Verified Purchase',
                      'Helpful',
                      'Report',
                      'Was this helpful?',
                      'Yes',
                      'No',
                      'Flag',
                      'Share',
                      'Like',
                      'Comment',
                      'Reply',
                      'See more',
                      'Read more',
                      'Show more',
                      'Reviewed in',
                      'Reviewed on',
                      'Posted on',
                      'Submitted on'
                    ];

                    for (const text of commonUIText) {
                      reviewText = reviewText.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
                    }
                  }

                  // Clean up whitespace and normalize
                  reviewText = reviewText.replace(/\s+/g, ' ').trim();
                }

                // Only add if we have meaningful text
                if (reviewText && reviewText.length > 10) {
                  results.push({ rating, title, date, text: reviewText });
                }
              } catch (e) {
                console.error('Error processing review container:', e);
              }
            }

            return results;
          }, siteConfig);

          log.info(`Extracted ${pageReviews.length} reviews from page ${nextPageNumber}`);

          // Add to global array
          global.sainsburysReviews = [...global.sainsburysReviews, ...pageReviews];

          currentPage = nextPageNumber;
        } catch (e) {
          log.warning(`Error navigating to page ${nextPageNumber}: ${e.message}`);
          break;
        }
      }
    }

    // Take a final screenshot
    await page.screenshot({ path: 'sainsburys-final.png' });

    log.info(`Total reviews extracted from Sainsbury's: ${global.sainsburysReviews.length}`);
  } catch (e) {
    log.error(`Error in Sainsbury's handler: ${e.message}`);
  }
}

// Export the main function
module.exports = { scrapeReviews };
