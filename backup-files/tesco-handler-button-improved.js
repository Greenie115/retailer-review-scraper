// Tesco specific handler with improved button clicking
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

    // Count initial reviews
    const initialReviewCount = await page.evaluate(() => {
      const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0, div[class*="ReviewTileContainer"]');
      return reviewContainers.length;
    });
    
    log.info(`Initial review count: ${initialReviewCount}`);

    // Try to click the "Show more reviews" button multiple times
    let clickCount = 0;
    let maxClicks = 20; // Increase the maximum number of clicks to handle up to 200 reviews
    let totalReviewsFound = initialReviewCount;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    while (clickCount < maxClicks && totalReviewsFound < maxReviews && consecutiveFailures < maxConsecutiveFailures) {
      try {
        console.log(`DEBUGGING: Looking for show more reviews button (attempt ${clickCount+1})`);
        
        // Use the exact button selector from the HTML provided
        const exactButtonSelector = 'button.styled__ShowMoreButton-mfe-pdp__sc-c5rmfv-2';
        const textButtonSelector = 'button.ddsweb-button--text-button';
        const textContentSelector = 'button:has-text("Show 10 more reviews")';
        
        // Try multiple approaches to find the button
        let showMoreButton = null;
        
        // Approach 1: Try the exact class selector
        showMoreButton = await page.$(exactButtonSelector);
        if (showMoreButton) {
          log.info('Found button using exact class selector');
        } else {
          // Approach 2: Try the text button selector with text content check
          const textButtons = await page.$$(textButtonSelector);
          log.info(`Found ${textButtons.length} text buttons`);
          
          for (const button of textButtons) {
            const buttonText = await button.evaluate(el => el.textContent);
            if (buttonText.includes('Show 10 more reviews') || buttonText.includes('Show more reviews')) {
              showMoreButton = button;
              log.info(`Found button with text: ${buttonText}`);
              break;
            }
          }
          
          // Approach 3: Try the text content selector directly
          if (!showMoreButton) {
            showMoreButton = await page.$(textContentSelector);
            if (showMoreButton) {
              log.info('Found button using text content selector');
            }
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
          
          // Try clicking with multiple methods
          let clickSuccess = false;
          
          // Method 1: Standard click
          try {
            await showMoreButton.click();
            clickSuccess = true;
            log.info('Clicked button using standard click');
          } catch (e) {
            log.warning(`Standard click failed: ${e.message}, trying force click...`);
            
            // Method 2: Force click
            try {
              await showMoreButton.click({ force: true });
              clickSuccess = true;
              log.info('Clicked button using force click');
            } catch (e2) {
              log.warning(`Force click failed: ${e2.message}, trying JavaScript click...`);
              
              // Method 3: JavaScript click
              try {
                await page.evaluate(button => button.click(), showMoreButton);
                clickSuccess = true;
                log.info('Clicked button using JavaScript click');
              } catch (e3) {
                log.warning(`JavaScript click failed: ${e3.message}`);
              }
            }
          }
          
          if (clickSuccess) {
            log.info(`Successfully clicked show more button, attempt ${clickCount+1}`);
            
            // Wait longer for reviews to load (3-5 seconds as you mentioned)
            await page.waitForTimeout(5000);
            
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
            
            // If new reviews were loaded, reset consecutive failures
            if (afterClickCount > beforeClickCount) {
              consecutiveFailures = 0;
              clickCount++;
            } else {
              // If no new reviews were loaded, increment consecutive failures
              consecutiveFailures++;
              log.warning(`No new reviews loaded after click, consecutive failures: ${consecutiveFailures}`);
            }
          } else {
            consecutiveFailures++;
            log.warning(`Failed to click button, consecutive failures: ${consecutiveFailures}`);
          }
        } else {
          // If button not found, try scrolling more to reveal it
          log.warning('Show more button not found, trying to scroll more');
          
          // Scroll down more to try to reveal the button
          await page.evaluate(() => {
            window.scrollBy(0, 500);
          });
          await page.waitForTimeout(1000);
          
          consecutiveFailures++;
          log.warning(`Button not found, consecutive failures: ${consecutiveFailures}`);
        }
      } catch (e) {
        log.warning(`Error in button click loop: ${e.message}`);
        consecutiveFailures++;
      }
      
      // If we've had too many consecutive failures, try a different approach
      if (consecutiveFailures >= maxConsecutiveFailures) {
        log.warning(`${maxConsecutiveFailures} consecutive failures, trying a different approach`);
        
        // Try to find the button using JavaScript and click it
        const jsClickResult = await page.evaluate(() => {
          // Look for any button that might be the "Show more reviews" button
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const button of buttons) {
            if (button.textContent.includes('Show 10 more reviews') || 
                button.textContent.includes('Show more reviews') ||
                button.className.includes('ShowMoreButton')) {
              // Try to scroll to the button
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Try to click it
              button.click();
              return { clicked: true, text: button.textContent };
            }
          }
          return { clicked: false };
        });
        
        if (jsClickResult.clicked) {
          log.info(`Clicked button using JavaScript approach: ${jsClickResult.text}`);
          await page.waitForTimeout(5000);
          consecutiveFailures = 0;
        } else {
          log.warning('Failed to find and click button using JavaScript approach');
          break;
        }
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
