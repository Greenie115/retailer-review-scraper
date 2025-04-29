// Sainsbury's specific handler with duplicate prevention
async function handleSainsburysSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Sainsbury\'s specific handler');
  console.log('DEBUGGING: Using fixed Sainsbury\'s handler with duplicate prevention');

  // Initialize global array for Sainsbury's reviews
  global.sainsburysReviews = [];
  
  // Create a Set to track unique review identifiers
  const uniqueReviewIds = new Set();

  try {
    // Implementation for Sainsbury's site
    log.info('Sainsbury\'s handler implementation');
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` });
    
    // First, handle cookie consent if present
    try {
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        'button[id*="cookie"]',
        'button[class*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        const cookieButton = await page.$(selector);
        if (cookieButton) {
          log.info(`Found cookie consent button with selector ${selector}, clicking...`);
          await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
          await page.waitForTimeout(2000);
          break;
        }
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
    await page.screenshot({ path: `sainsburys-after-scroll-${Date.now()}.png` });
    
    // Find and click on the reviews accordion if it's not already expanded
    log.info('Looking for reviews accordion');
    
    // Try to find and click the reviews accordion using compatible selectors
    const accordionSelectors = [
      '.ds-c-accordion-item__header',
      'button.ds-c-accordion-item__header',
      'button[aria-controls*="reviews"]',
      'button[aria-controls*="review"]',
      'button[id*="reviews"]',
      'button[id*="review"]',
      'button[class*="accordion"]',
      'button[class*="Accordion"]'
    ];
    
    let accordionClicked = false;
    for (const selector of accordionSelectors) {
      try {
        const buttons = await page.$$(selector);
        log.info(`Found ${buttons.length} potential accordion buttons with selector ${selector}`);
        
        for (const button of buttons) {
          const buttonText = await page.evaluate(el => el.textContent, button);
          log.info(`Button text: ${buttonText}`);
          
          if (buttonText && buttonText.toLowerCase().includes('review')) {
            log.info('Found reviews accordion button, clicking...');
            await button.click().catch(e => log.warning(`Button click failed: ${e.message}`));
            accordionClicked = true;
            await page.waitForTimeout(3000);
            break;
          }
        }
        
        if (accordionClicked) break;
      } catch (e) {
        log.warning(`Error with selector ${selector}: ${e.message}`);
      }
    }
    
    if (!accordionClicked) {
      log.warning('Could not find reviews accordion with specific selectors, trying JavaScript approach');
      
      // Try to find and click any element that might be the reviews section using JavaScript
      const jsClicked = await page.evaluate(() => {
        // Try to find any element containing "Reviews" text
        const elements = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        for (const element of elements) {
          if (element.textContent && element.textContent.toLowerCase().includes('review')) {
            console.log(`Found element with Reviews text: ${element.textContent}`);
            element.click();
            return true;
          }
        }
        return false;
      });
      
      if (jsClicked) {
        log.info('Successfully clicked element with Reviews text using JavaScript');
        await page.waitForTimeout(3000);
      } else {
        log.warning('Could not find any reviews element to click');
      }
    }
    
    // Take a screenshot after clicking the accordion
    await page.screenshot({ path: `sainsburys-after-accordion-${Date.now()}.png` });
    
    // Extract the HTML of the page for debugging
    const pageHtml = await page.content();
    const fs = require('fs');
    fs.writeFileSync(`sainsburys-page-html-${Date.now()}.html`, pageHtml);
    log.info('Saved page HTML for debugging');
    
    // Scroll to make sure reviews are visible
    await page.evaluate(() => {
      // Try to find the reviews section and scroll to it
      const reviewsSection = document.querySelector('#reviews-section, .pd-reviews, [id*="reviews"]');
      if (reviewsSection) {
        reviewsSection.scrollIntoView();
        console.log('Scrolled to reviews section');
      } else {
        // If no specific reviews section found, just scroll down more
        window.scrollBy(0, 500);
        console.log('Scrolled down 500px');
      }
    });
    await page.waitForTimeout(2000);
    
    // Take a screenshot after scrolling to reviews
    await page.screenshot({ path: `sainsburys-reviews-visible-${Date.now()}.png` });
    
    // Process multiple pages of reviews if available
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && global.sainsburysReviews.length < maxReviews && currentPage <= 10) {
      log.info(`Processing Sainsbury's reviews page ${currentPage}`);
      
      // Extract reviews from the current page
      const pageReviews = await page.evaluate(() => {
        console.log('Starting Sainsbury\'s review extraction');
        const results = [];
        
        // Find all review containers
        const reviewContainers = document.querySelectorAll('.pd-reviews__review-container, .review, [id*="review-"]');
        console.log(`Found ${reviewContainers.length} potential review containers`);
        
        // Process each review container
        for (const container of reviewContainers) {
          try {
            // Find the actual review element (might be the container itself or a child)
            const reviewElement = container.classList.contains('review') ? container : container.querySelector('.review');
            if (!reviewElement) {
              console.log('No review element found in container, skipping');
              continue;
            }
            
            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = reviewElement.querySelector('.review__title');
            if (titleElement) {
              title = titleElement.textContent.trim();
              console.log(`Extracted title: "${title}"`);
            }
            
            // Extract review text
            let text = '';
            const contentElement = reviewElement.querySelector('.review__content, [data-testid="review-content"]');
            if (contentElement) {
              text = contentElement.textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }
            
            // Extract rating
            let rating = '5'; // Default to 5 stars
            const ratingElement = reviewElement.querySelector('.review__star-rating, .ds-c-rating__trailing-content');
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
            
            // Extract review ID if available
            let reviewId = '';
            if (container.id) {
              reviewId = container.id;
              console.log(`Found review ID: ${reviewId}`);
            }
            
            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ 
                rating, 
                title, 
                date, 
                text,
                reviewId,
                // Create a unique identifier for deduplication
                uniqueId: `${title}-${text.substring(0, 50)}`
              });
              console.log(`Added Sainsbury's review with rating ${rating}`);
            } else {
              console.log('Review text too short or missing, skipping');
            }
          } catch (e) {
            console.error('Error processing review container:', e);
          }
        }
        
        console.log(`Returning ${results.length} Sainsbury's reviews`);
        return results;
      });
      
      // Add non-duplicate reviews to our collection
      if (pageReviews && pageReviews.length > 0) {
        log.info(`Found ${pageReviews.length} reviews on page ${currentPage}`);
        
        // Filter out duplicates
        const newReviews = pageReviews.filter(review => {
          // Use the uniqueId for deduplication
          if (!uniqueReviewIds.has(review.uniqueId)) {
            uniqueReviewIds.add(review.uniqueId);
            return true;
          }
          return false;
        });
        
        // Remove the uniqueId property before adding to global reviews
        const cleanedReviews = newReviews.map(({ uniqueId, reviewId, ...rest }) => rest);
        
        if (newReviews.length > 0) {
          global.sainsburysReviews = global.sainsburysReviews.concat(cleanedReviews);
          log.info(`Added ${newReviews.length} new reviews, total: ${global.sainsburysReviews.length}`);
        } else {
          log.warning('No new reviews found on this page, all were duplicates');
        }
      } else {
        log.warning(`No reviews found on page ${currentPage}`);
      }
      
      // Check if we need more reviews and if there are more pages
      if (global.sainsburysReviews.length < maxReviews) {
        // Take a screenshot before clicking next
        await page.screenshot({ path: `sainsburys-before-next-${currentPage}-${Date.now()}.png` });
        
        // Try to click the next page button
        const nextClicked = await page.evaluate(() => {
          // Look for next page buttons/links
          const nextSelectors = [
            '.ln-c-pagination__item--next a',
            'a[rel="next"]',
            'a[aria-label="Next page"]',
            'button[aria-label="Next page"]',
            'a.ln-c-pagination__link[href="#2"]',
            'a[href*="page="]'
          ];
          
          for (const selector of nextSelectors) {
            const nextButton = document.querySelector(selector);
            if (nextButton) {
              console.log(`Found next button with selector: ${selector}`);
              
              // Check if disabled
              if (nextButton.classList.contains('is-disabled') || 
                  nextButton.getAttribute('aria-disabled') === 'true' ||
                  nextButton.hasAttribute('disabled')) {
                console.log('Next button is disabled');
                return false;
              }
              
              // Click the button
              console.log('Clicking next button');
              nextButton.click();
              return true;
            }
          }
          
          // If no specific next button found, try to find any page number links
          const pageLinks = document.querySelectorAll('.ln-c-pagination__item--page a');
          const currentPage = document.querySelector('.ln-c-pagination__item--page.is-current a');
          
          if (pageLinks.length > 0 && currentPage) {
            const currentPageNum = parseInt(currentPage.textContent.trim());
            console.log(`Current page: ${currentPageNum}`);
            
            // Find the next page link
            for (const link of pageLinks) {
              const pageNum = parseInt(link.textContent.trim());
              if (pageNum === currentPageNum + 1) {
                console.log(`Found link to page ${pageNum}`);
                link.click();
                return true;
              }
            }
          }
          
          return false;
        });
        
        if (nextClicked) {
          log.info('Successfully clicked next page button');
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
    
    // Take a final screenshot
    await page.screenshot({ path: `sainsburys-final-${Date.now()}.png` });
    
    // Log the results
    log.info(`Extracted a total of ${global.sainsburysReviews.length} reviews from Sainsbury's site`);
    
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
