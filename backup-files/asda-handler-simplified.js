// ASDA specific handler with simplified approach
async function handleAsdaSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using ASDA specific handler (NO FALLBACKS)');
  console.log('DEBUGGING: Using simplified ASDA handler');

  // Initialize global array for ASDA reviews
  global.asdaReviews = [];

  try {
    // Implementation for ASDA site
    log.info('ASDA handler implementation');
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: `asda-initial-${Date.now()}.png` });
    
    // First, handle cookie consent if present
    try {
      const cookieButton = await page.$('button:has-text("Accept all cookies"), #onetrust-accept-btn-handler');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }
    
    // Scroll down to make sure all elements are loaded
    log.info('Scrolling page to load all elements');
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await page.waitForTimeout(2000);
    
    // Take a screenshot after scrolling
    await page.screenshot({ path: `asda-after-scroll-${Date.now()}.png` });
    
    // Find and click on the reviews tab - using a more direct approach
    log.info('Looking for reviews tab');
    
    // Try to click the reviews tab using JavaScript directly
    const tabClicked = await page.evaluate(() => {
      // Look for any tab that contains "Reviews" text
      const tabs = document.querySelectorAll('button.asda-tab');
      console.log(`Found ${tabs.length} tabs`);
      
      for (const tab of tabs) {
        if (tab.textContent.includes('Reviews')) {
          console.log(`Found reviews tab with text: ${tab.textContent}`);
          tab.click();
          return true;
        }
      }
      
      // If we didn't find a tab with class asda-tab, try any button with Reviews text
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        if (button.textContent.includes('Reviews')) {
          console.log(`Found reviews button with text: ${button.textContent}`);
          button.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (tabClicked) {
      log.info('Successfully clicked reviews tab');
    } else {
      log.warning('Could not find reviews tab');
    }
    
    // Wait for reviews to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot after clicking the tab
    await page.screenshot({ path: `asda-after-tab-click-${Date.now()}.png` });
    
    // Scroll down to make sure all reviews are loaded
    log.info('Scrolling page to load all reviews');
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
    await page.waitForTimeout(2000);
    
    // Take a screenshot after scrolling to reviews
    await page.screenshot({ path: `asda-reviews-loaded-${Date.now()}.png` });
    
    // Extract the HTML of the page for debugging
    const pageHtml = await page.content();
    const fs = require('fs');
    fs.writeFileSync(`asda-page-html-${Date.now()}.html`, pageHtml);
    log.info('Saved page HTML for debugging');
    
    // Extract reviews using direct page evaluation
    log.info('Extracting reviews from page');
    const reviews = await page.evaluate(() => {
      console.log('Starting ASDA review extraction');
      const results = [];
      
      // Find all review containers
      const reviewContainers = document.querySelectorAll('.pdp-description-reviews__content-cntr');
      console.log(`Found ${reviewContainers.length} review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating from stars
          let rating = '5'; // Default to 5 stars
          const ratingStars = container.querySelector('.rating-stars__stars--top');
          if (ratingStars) {
            const style = ratingStars.getAttribute('style');
            if (style && style.includes('width:')) {
              const widthMatch = style.match(/width:\s*(\d+)%/);
              if (widthMatch && widthMatch[1]) {
                const percentage = parseInt(widthMatch[1]);
                rating = Math.round(percentage / 20).toString();
                console.log(`Extracted rating ${rating} from width ${percentage}%`);
              }
            }
          }
          
          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('.pdp-description-reviews__rating-title');
          if (titleElement) {
            title = titleElement.textContent.trim();
            console.log(`Extracted title: "${title}"`);
          }
          
          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('.pdp-description-reviews__submitted-date');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }
          
          // Extract review text
          let text = '';
          const textElement = container.querySelector('.pdp-description-reviews__content-text');
          if (textElement) {
            text = textElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }
          
          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
            console.log(`Added review with rating ${rating}`);
          }
        } catch (e) {
          console.error('Error processing review container:', e);
        }
      }
      
      console.log(`Returning ${results.length} reviews`);
      return results;
    });
    
    // Process pagination if needed
    if (reviews.length > 0) {
      log.info(`Found ${reviews.length} reviews on first page`);
      global.asdaReviews = reviews;
      
      // Check if we need to get more reviews
      if (reviews.length < maxReviews) {
        log.info(`Need more reviews, found ${reviews.length}, max is ${maxReviews}`);
        
        // Try to click the next page button up to 9 times (for a total of 10 pages)
        for (let i = 0; i < 9; i++) {
          if (global.asdaReviews.length >= maxReviews) {
            log.info(`Reached max reviews (${maxReviews}), stopping pagination`);
            break;
          }
          
          log.info(`Trying to click next page button, attempt ${i+1}`);
          
          // Take a screenshot before clicking next
          await page.screenshot({ path: `asda-before-next-${i+1}-${Date.now()}.png` });
          
          // Try to click the next page button
          const nextClicked = await page.evaluate(() => {
            // Look for the next page button
            const nextButton = document.querySelector('a[data-auto-id="btnright"]');
            if (!nextButton) {
              console.log('Next button not found');
              return false;
            }
            
            // Check if the button is disabled
            if (nextButton.classList.contains('co-pagination__arrow--disabled') || 
                nextButton.getAttribute('aria-disabled') === 'true') {
              console.log('Next button is disabled');
              return false;
            }
            
            // Click the button
            console.log('Clicking next button');
            nextButton.click();
            return true;
          });
          
          if (nextClicked) {
            log.info('Successfully clicked next page button');
            
            // Wait for the next page to load
            await page.waitForTimeout(3000);
            
            // Take a screenshot after clicking next
            await page.screenshot({ path: `asda-after-next-${i+1}-${Date.now()}.png` });
            
            // Extract reviews from the new page
            const nextPageReviews = await page.evaluate(() => {
              console.log('Extracting reviews from next page');
              const results = [];
              
              // Find all review containers
              const reviewContainers = document.querySelectorAll('.pdp-description-reviews__content-cntr');
              console.log(`Found ${reviewContainers.length} review containers on next page`);
              
              // Process each review container
              for (const container of reviewContainers) {
                try {
                  // Extract rating from stars
                  let rating = '5'; // Default to 5 stars
                  const ratingStars = container.querySelector('.rating-stars__stars--top');
                  if (ratingStars) {
                    const style = ratingStars.getAttribute('style');
                    if (style && style.includes('width:')) {
                      const widthMatch = style.match(/width:\s*(\d+)%/);
                      if (widthMatch && widthMatch[1]) {
                        const percentage = parseInt(widthMatch[1]);
                        rating = Math.round(percentage / 20).toString();
                      }
                    }
                  }
                  
                  // Extract title
                  let title = 'Product Review'; // Default title
                  const titleElement = container.querySelector('.pdp-description-reviews__rating-title');
                  if (titleElement) {
                    title = titleElement.textContent.trim();
                  }
                  
                  // Extract date
                  let date = 'Unknown date';
                  const dateElement = container.querySelector('.pdp-description-reviews__submitted-date');
                  if (dateElement) {
                    date = dateElement.textContent.trim();
                  }
                  
                  // Extract review text
                  let text = '';
                  const textElement = container.querySelector('.pdp-description-reviews__content-text');
                  if (textElement) {
                    text = textElement.textContent.trim();
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
            
            if (nextPageReviews.length > 0) {
              log.info(`Found ${nextPageReviews.length} reviews on page ${i+2}`);
              global.asdaReviews = global.asdaReviews.concat(nextPageReviews);
              log.info(`Total reviews so far: ${global.asdaReviews.length}`);
            } else {
              log.warning(`No reviews found on page ${i+2}, stopping pagination`);
              break;
            }
          } else {
            log.info('Could not click next page button, stopping pagination');
            break;
          }
        }
      }
    } else {
      log.warning('No reviews found on first page');
    }
    
    // Take a final screenshot
    await page.screenshot({ path: `asda-final-${Date.now()}.png` });
    
    // Log the results
    log.info(`Extracted a total of ${global.asdaReviews.length} reviews from ASDA site`);
    
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
