// Sainsbury's specific handler with improved review extraction and pagination
async function handleSainsburysSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Sainsbury\'s specific handler');
  console.log('DEBUGGING: Using updated Sainsbury\'s handler with improved review extraction');

  // Initialize global array for Sainsbury's reviews
  global.sainsburysReviews = [];

  try {
    // Implementation for Sainsbury's site
    log.info('Sainsbury\'s handler implementation');
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` });
    
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
    await autoScroll(page);
    await page.waitForTimeout(2000);
    
    // Take a screenshot after scrolling
    await page.screenshot({ path: `sainsburys-after-scroll-${Date.now()}.png` });
    
    // Find and click on the reviews accordion if it's not already expanded
    log.info('Looking for reviews accordion');
    
    // Try to find and click the reviews accordion
    const accordionClicked = await page.evaluate(() => {
      // Look for the reviews accordion
      const reviewsAccordion = document.querySelector('.ds-c-accordion-item__header:has-text("Reviews"), button:has-text("Reviews"), button[aria-controls*="reviews"]');
      
      if (reviewsAccordion) {
        console.log('Found reviews accordion');
        
        // Check if it's already expanded
        const isExpanded = reviewsAccordion.getAttribute('aria-expanded') === 'true';
        if (!isExpanded) {
          console.log('Clicking reviews accordion to expand it');
          reviewsAccordion.click();
        } else {
          console.log('Reviews accordion is already expanded');
        }
        return true;
      }
      
      return false;
    });
    
    if (accordionClicked) {
      log.info('Successfully found reviews accordion');
    } else {
      log.warning('Could not find reviews accordion, trying alternative approach');
      
      // Try to find and click any element that might be the reviews section
      const altClicked = await page.evaluate(() => {
        // Try various selectors that might be the reviews section
        const possibleSelectors = [
          'button:has-text("Reviews")',
          'button:has-text("Customer reviews")',
          'button[aria-controls*="review"]',
          'button.ds-c-accordion-item__header',
          'a[href="#reviews"]'
        ];
        
        for (const selector of possibleSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found potential reviews element with selector: ${selector}`);
            element.click();
            return true;
          }
        }
        
        return false;
      });
      
      if (altClicked) {
        log.info('Successfully clicked alternative reviews element');
      } else {
        log.warning('Could not find any reviews element to click');
      }
    }
    
    // Wait for reviews to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot after clicking the accordion
    await page.screenshot({ path: `sainsburys-after-accordion-${Date.now()}.png` });
    
    // Extract the HTML of the page for debugging
    const pageHtml = await page.content();
    const fs = require('fs');
    fs.writeFileSync(`sainsburys-page-html-${Date.now()}.html`, pageHtml);
    log.info('Saved page HTML for debugging');
    
    // Process multiple pages of reviews if available
    let currentPage = 1;
    let hasMorePages = true;
    let allReviews = [];
    
    while (hasMorePages && allReviews.length < maxReviews && currentPage <= 10) {
      log.info(`Processing Sainsbury's reviews page ${currentPage}`);
      
      // Extract reviews from the current page
      const pageReviews = await page.evaluate(() => {
        console.log('Starting Sainsbury\'s review extraction');
        const results = [];
        
        // Find all review containers using the exact class from the provided HTML
        const reviewContainers = document.querySelectorAll('.pd-reviews__review-container');
        console.log(`Found ${reviewContainers.length} review containers`);
        
        // Process each review container
        for (const container of reviewContainers) {
          try {
            // Extract the review element
            const reviewElement = container.querySelector('.review');
            if (!reviewElement) continue;
            
            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = reviewElement.querySelector('.review__title');
            if (titleElement) {
              title = titleElement.textContent.trim();
              console.log(`Extracted title: "${title}"`);
            }
            
            // Extract review text
            let text = '';
            const contentElement = reviewElement.querySelector('.review__content[data-testid="review-content"]');
            if (contentElement) {
              text = contentElement.textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }
            
            // Extract rating
            let rating = '5'; // Default to 5 stars
            const ratingElement = reviewElement.querySelector('.review__star-rating .ds-c-rating__trailing-content');
            if (ratingElement) {
              const ratingText = ratingElement.textContent.trim();
              const ratingMatch = ratingText.match(/(\d+) out of 5/);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted rating: ${rating}`);
              }
            }
            
            // Extract date
            let date = 'Unknown date';
            const dateElement = reviewElement.querySelector('.review__date');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date: "${date}"`);
            }
            
            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ rating, title, date, text });
              console.log(`Added Sainsbury's review with rating ${rating}`);
            }
          } catch (e) {
            console.error('Error processing review container:', e);
          }
        }
        
        console.log(`Returning ${results.length} Sainsbury's reviews from current page`);
        return results;
      });
      
      // Add the reviews to our collection
      if (pageReviews && pageReviews.length > 0) {
        allReviews = allReviews.concat(pageReviews);
        log.info(`Added ${pageReviews.length} reviews from page ${currentPage}, total: ${allReviews.length}`);
      } else {
        log.warning(`No reviews found on page ${currentPage}`);
      }
      
      // Check if there's a next page button and click it
      if (allReviews.length < maxReviews) {
        // Take a screenshot before clicking next
        await page.screenshot({ path: `sainsburys-before-next-${currentPage}-${Date.now()}.png` });
        
        // Try to click the next page button
        const nextClicked = await page.evaluate(() => {
          // Look for the next page link/button
          const nextButton = document.querySelector('.ln-c-pagination__item--next a, a[rel="next"], a[aria-label="Next page"]');
          if (!nextButton) {
            console.log('Next page button not found');
            return false;
          }
          
          // Check if the button is disabled
          if (nextButton.classList.contains('is-disabled') || 
              nextButton.getAttribute('aria-disabled') === 'true' ||
              nextButton.hasAttribute('disabled')) {
            console.log('Next page button is disabled');
            return false;
          }
          
          // Get the href attribute to navigate to the next page
          const href = nextButton.getAttribute('href');
          if (href && href.startsWith('#')) {
            // It's a hash link, just click it
            console.log('Clicking next page button (hash link)');
            nextButton.click();
            return true;
          } else if (href) {
            // It's a full URL, navigate to it
            console.log(`Navigating to next page URL: ${href}`);
            window.location.href = href;
            return true;
          } else {
            // No href, try clicking it anyway
            console.log('Clicking next page button (no href)');
            nextButton.click();
            return true;
          }
        });
        
        if (nextClicked) {
          log.info(`Successfully clicked next page button, going to page ${currentPage + 1}`);
          await page.waitForTimeout(3000); // Wait for the next page to load
          
          // Take a screenshot after clicking next
          await page.screenshot({ path: `sainsburys-after-next-${currentPage}-${Date.now()}.png` });
          
          currentPage++;
        } else {
          log.info('Could not click next page button, no more pages');
          hasMorePages = false;
        }
      } else {
        log.info(`Reached maximum number of reviews (${maxReviews}), stopping pagination`);
        hasMorePages = false;
      }
    }
    
    // Add the reviews to the global array
    if (allReviews.length > 0) {
      global.sainsburysReviews = allReviews;
      log.info(`Added ${allReviews.length} reviews to global Sainsbury's reviews array`);
    } else {
      log.warning('No Sainsbury\'s reviews found');
    }
    
    // Take a final screenshot
    await page.screenshot({ path: `sainsburys-final-${Date.now()}.png` });
    
    // No fallbacks - only use actual reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found. NOT adding fallback reviews.');
    }
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);
    
    // No fallbacks - only use actual reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }
  
  return global.sainsburysReviews;
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

module.exports = { handleSainsburysSite, autoScroll };
