// Tesco specific handler with updated selectors and fixed button click
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using optimized Tesco handler with fixed button selector');

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
          await showMoreButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          
          // Take a screenshot before clicking the button
          await page.screenshot({ path: `tesco-before-click-${i+1}-${Date.now()}.png` });
          
          // Try clicking with force option
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

module.exports = { handleTescoSite, autoScroll };
