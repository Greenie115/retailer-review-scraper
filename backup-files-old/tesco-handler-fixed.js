// Tesco specific handler with fixed rating extraction and multiple button clicks
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using fixed Tesco handler with correct rating extraction');

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

    // Count initial reviews
    const initialReviewCount = await page.evaluate(() => {
      const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
      return reviewContainers.length;
    });
    
    log.info(`Initial review count: ${initialReviewCount}`);

    // Try to click the "Show more reviews" button multiple times
    let clickCount = 0;
    let maxClicks = 10; // Increase the maximum number of clicks
    let totalReviewsFound = initialReviewCount;
    
    while (clickCount < maxClicks && totalReviewsFound < maxReviews) {
      try {
        console.log(`DEBUGGING: Looking for show more reviews button (attempt ${clickCount+1})`);
        
        // Use the exact button selector from the HTML
        const showMoreButtonSelectors = [
          'button.styled__ShowMoreButton-mfe-pdp__sc-c5rmfv-2',
          'button:has-text("Show 10 more reviews")',
          'button:has-text("Show more reviews")',
          'button.ddsweb-button--text-button:has-text("Show")',
          'button[class*="ShowMoreButton"]'
        ];
        
        let showMoreButton = null;
        for (const selector of showMoreButtonSelectors) {
          showMoreButton = await page.$(selector);
          if (showMoreButton) {
            console.log(`DEBUGGING: Found show more button with selector: ${selector}`);
            break;
          }
        }
        
        if (showMoreButton) {
          console.log('DEBUGGING: Found show more reviews button');
          
          // Check if the button is visible
          const isVisible = await showMoreButton.isVisible();
          if (!isVisible) {
            log.warning('Show more button is not visible, trying to scroll to it');
            await showMoreButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
          }
          
          // Take a screenshot before clicking the button
          await page.screenshot({ path: `tesco-before-click-${clickCount+1}-${Date.now()}.png` });
          
          // Get current review count before clicking
          const beforeClickCount = await page.evaluate(() => {
            const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
            return reviewContainers.length;
          });
          
          // Try clicking with force option
          await showMoreButton.click({ force: true }).catch(async (e) => {
            log.warning(`Direct show more click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), showMoreButton);
          });
          
          log.info(`Clicked show more button, attempt ${clickCount+1}`);
          await page.waitForTimeout(3000); // Wait longer for reviews to load
          
          // Take a screenshot after clicking show more
          await page.screenshot({ path: `tesco-after-show-more-${clickCount+1}-${Date.now()}.png` });
          
          // Get new review count after clicking
          const afterClickCount = await page.evaluate(() => {
            const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
            return reviewContainers.length;
          });
          
          log.info(`Reviews before click: ${beforeClickCount}, after click: ${afterClickCount}`);
          
          // Update total reviews found
          totalReviewsFound = afterClickCount;
          
          // If no new reviews were loaded, break the loop
          if (afterClickCount <= beforeClickCount) {
            log.info('No new reviews loaded, stopping pagination');
            break;
          }
          
          clickCount++;
        } else {
          log.info('No show more button found, all reviews may be loaded');
          break;
        }
      } catch (e) {
        log.warning(`Error clicking show more button: ${e.message}`);
        break;
      }
    }

    log.info(`Clicked "Show more reviews" button ${clickCount} times, found ${totalReviewsFound} reviews`);

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
      
      // Try to find all review containers
      const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
      console.log(`Found ${reviewContainers.length} Tesco review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract all text from the container for debugging
          const allText = container.textContent.trim();
          console.log(`Review container text: ${allText.substring(0, 100)}...`);
          
          // Extract rating - FIXED to correctly extract star rating
          let rating = '5'; // Default to 5 stars
          
          // Method 1: From aria-label
          const ratingContainer = container.querySelector('.styled__ReviewRating-mfe-pdp__sc-je4k7f-3, div[class*="ReviewRating"], .ddsweb-rating__container');
          if (ratingContainer) {
            const ariaLabel = ratingContainer.getAttribute('aria-label');
            if (ariaLabel) {
              const ratingMatch = ariaLabel.match(/rating of (\d+) stars/i) || ariaLabel.match(/(\d+) stars/i) || ariaLabel.match(/(\d+) out of 5/i);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted rating from aria-label: ${rating}`);
              }
            }
          }
          
          // Method 2: Count active star SVGs
          if (rating === '5') {
            const activeStars = container.querySelectorAll('.ddsweb-rating__icon-active, svg[class*="active"]');
            if (activeStars && activeStars.length > 0) {
              rating = activeStars.length.toString();
              console.log(`Extracted rating by counting active stars: ${rating}`);
            }
          }
          
          // Method 3: Look for rating hint text
          if (rating === '5') {
            const ratingHint = container.querySelector('.ddsweb-rating__hint');
            if (ratingHint) {
              const hintText = ratingHint.textContent.trim();
              const ratingMatch = hintText.match(/(\d+) stars/i);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted rating from hint text: ${rating}`);
              }
            }
          }
          
          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('.styled__Title-mfe-pdp__sc-je4k7f-2, h3[class*="Title"], h3.ddsweb-heading');
          if (titleElement) {
            title = safeTextContent(titleElement);
            console.log(`Extracted title: "${title}"`);
          }
          
          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('.styled__ReviewDate-mfe-pdp__sc-je4k7f-9, span[class*="ReviewDate"]');
          if (dateElement) {
            date = safeTextContent(dateElement);
            console.log(`Extracted date: "${date}"`);
          }
          
          // Extract review text - FIXED to correctly extract review text
          let text = '';
          const contentElement = container.querySelector('.styled__Content-mfe-pdp__sc-je4k7f-6, span[class*="Content"]');
          if (contentElement) {
            text = safeTextContent(contentElement);
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
