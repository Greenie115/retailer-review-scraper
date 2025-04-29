// Sainsbury's specific handler with compatible selectors
async function handleSainsburysSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Sainsbury\'s specific handler');
  console.log('DEBUGGING: Using fixed Sainsbury\'s handler with compatible selectors');

  // Initialize global array for Sainsbury's reviews
  global.sainsburysReviews = [];

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
    
    // Extract reviews from the page
    log.info('Extracting reviews from page');
    const reviews = await page.evaluate(() => {
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
          
          // Only add if we have meaningful text
          if (text && text.length > 5) {
            results.push({ rating, title, date, text });
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
    
    // Process pagination if needed
    if (reviews.length > 0) {
      log.info(`Found ${reviews.length} reviews on first page`);
      global.sainsburysReviews = reviews;
      
      // Check if we need to get more reviews and if pagination is available
      if (reviews.length < maxReviews) {
        log.info(`Need more reviews, found ${reviews.length}, max is ${maxReviews}`);
        
        // Check if pagination is available
        const hasPagination = await page.evaluate(() => {
          return !!document.querySelector('.ln-c-pagination, .pd-reviews__pagination-container, [class*="pagination"]');
        });
        
        if (hasPagination) {
          log.info('Pagination found, will try to navigate to more pages');
          
          // Try to click through pagination up to 5 more pages
          for (let i = 0; i < 5; i++) {
            if (global.sainsburysReviews.length >= maxReviews) {
              log.info(`Reached max reviews (${maxReviews}), stopping pagination`);
              break;
            }
            
            // Take a screenshot before clicking next
            await page.screenshot({ path: `sainsburys-before-next-${i+1}-${Date.now()}.png` });
            
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
              await page.screenshot({ path: `sainsburys-after-next-${i+1}-${Date.now()}.png` });
              
              // Extract reviews from the new page
              const nextPageReviews = await page.evaluate(() => {
                console.log('Extracting reviews from next page');
                const results = [];
                
                // Find all review containers
                const reviewContainers = document.querySelectorAll('.pd-reviews__review-container, .review, [id*="review-"]');
                console.log(`Found ${reviewContainers.length} potential review containers on next page`);
                
                // Process each review container
                for (const container of reviewContainers) {
                  try {
                    // Find the actual review element
                    const reviewElement = container.classList.contains('review') ? container : container.querySelector('.review');
                    if (!reviewElement) continue;
                    
                    // Extract title
                    let title = 'Product Review'; // Default title
                    const titleElement = reviewElement.querySelector('.review__title');
                    if (titleElement) {
                      title = titleElement.textContent.trim();
                    }
                    
                    // Extract review text
                    let text = '';
                    const contentElement = reviewElement.querySelector('.review__content, [data-testid="review-content"]');
                    if (contentElement) {
                      text = contentElement.textContent.trim();
                    }
                    
                    // Extract rating
                    let rating = '5'; // Default to 5 stars
                    const ratingElement = reviewElement.querySelector('.review__star-rating, .ds-c-rating__trailing-content');
                    if (ratingElement) {
                      const ratingText = ratingElement.textContent.trim();
                      const ratingMatch = ratingText.match(/(\d+) out of 5/);
                      if (ratingMatch && ratingMatch[1]) {
                        rating = ratingMatch[1];
                      }
                    }
                    
                    // Extract date
                    let date = 'Unknown date';
                    const dateElement = reviewElement.querySelector('.review__date');
                    if (dateElement) {
                      date = dateElement.textContent.trim();
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
                
                // Check for duplicates before adding
                const newReviews = nextPageReviews.filter(newReview => {
                  return !global.sainsburysReviews.some(existingReview => 
                    existingReview.title === newReview.title && 
                    existingReview.text === newReview.text
                  );
                });
                
                if (newReviews.length > 0) {
                  global.sainsburysReviews = global.sainsburysReviews.concat(newReviews);
                  log.info(`Added ${newReviews.length} new reviews, total: ${global.sainsburysReviews.length}`);
                } else {
                  log.warning('No new reviews found on this page, might be duplicates');
                  break;
                }
              } else {
                log.warning(`No reviews found on page ${i+2}, stopping pagination`);
                break;
              }
            } else {
              log.info('Could not click next page button, no more pages');
              break;
            }
          }
        } else {
          log.info('No pagination found, only one page of reviews available');
        }
      }
    } else {
      log.warning('No reviews found on the page');
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
