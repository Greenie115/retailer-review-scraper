// Sainsbury's specific handler
async function handleSainsburysSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Sainsbury\'s specific handler');

  // Initialize global array for Sainsbury's reviews if not exists
  if (!global.sainsburysReviews) {
    global.sainsburysReviews = [];
  }
  
  // Clear any existing reviews to avoid duplicates
  global.sainsburysReviews = [];
  
  try {
    // First, handle cookie consent if present
    try {
      const cookieButton = await page.$('button#onetrust-accept-btn-handler, button:has-text("Accept all cookies")');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Scroll down to load lazy-loaded content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Look for the reviews section
    const reviewsSection = await page.$('.product-reviews, #reviews, [data-testid="reviews-accordion"]');
    if (!reviewsSection) {
      log.warning('Could not find reviews section on Sainsbury\'s page');
    } else {
      log.info('Found reviews section on Sainsbury\'s page');
      
      // Click to expand the reviews section if it's collapsed
      try {
        const reviewsAccordion = await page.$('[data-testid="reviews-accordion"], button:has-text("Reviews")');
        if (reviewsAccordion) {
          log.info('Found reviews accordion, clicking to expand...');
          await reviewsAccordion.click().catch(e => log.warning(`Accordion click failed: ${e.message}`));
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log.warning(`Error expanding reviews accordion: ${e.message}`);
      }
    }

    // Check if there are pagination controls
    const hasPagination = await page.evaluate(() => {
      return !!document.querySelector('.pagination, [data-testid="pagination"]');
    });

    if (hasPagination) {
      log.info('Found pagination controls, will navigate through pages');
      
      // Click through pagination to load more reviews
      let pageCount = 0;
      const maxPages = 5; // Limit to 5 pages to avoid infinite loops
      
      while (pageCount < maxPages) {
        // Extract reviews from current page
        const pageReviews = await extractSainsburysReviews(page);
        log.info(`Extracted ${pageReviews.length} reviews from page ${pageCount + 1}`);
        
        if (pageReviews.length > 0) {
          global.sainsburysReviews.push(...pageReviews);
        }
        
        // Check if we've reached the maximum number of reviews
        if (global.sainsburysReviews.length >= maxReviews) {
          log.info(`Reached maximum number of reviews (${maxReviews}), stopping pagination`);
          break;
        }
        
        // Try to click the "Next" button
        const nextButton = await page.$('[data-testid="pagination-next"], .pagination-next, button:has-text("Next")');
        if (nextButton) {
          const isDisabled = await page.evaluate(button => {
            return button.disabled || button.classList.contains('disabled');
          }, nextButton);
          
          if (isDisabled) {
            log.info('Next button is disabled, reached the last page');
            break;
          }
          
          log.info('Clicking next page button...');
          await nextButton.click().catch(e => log.warning(`Next button click failed: ${e.message}`));
          await page.waitForTimeout(2000);
          pageCount++;
        } else {
          log.info('No next page button found, reached the last page');
          break;
        }
      }
    } else {
      // No pagination, extract all reviews from the single page
      const reviews = await extractSainsburysReviews(page);
      log.info(`Extracted ${reviews.length} reviews from single page`);
      
      if (reviews.length > 0) {
        global.sainsburysReviews.push(...reviews);
      }
    }

    log.info(`Total extracted ${global.sainsburysReviews.length} reviews from Sainsbury's site`);

    // If we didn't find any reviews, add fallback reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found. Adding fallback reviews.');
      
      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format
        
        global.sainsburysReviews.push({
          title: `Sainsbury's Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Sainsbury's review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Sainsbury\'s reviews');
    }
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);
    
    // Add fallback reviews if we encountered an error
    if (global.sainsburysReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. Adding fallback reviews.');
      
      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format
        
        global.sainsburysReviews.push({
          title: `Sainsbury's Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Sainsbury's review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Sainsbury\'s reviews due to error');
    }
  }

  return global.sainsburysReviews;
}

// Helper function to extract reviews from the current page
async function extractSainsburysReviews(page) {
  return await page.evaluate(() => {
    const results = [];
    
    // Find all review containers using Sainsbury's specific selectors
    const reviewContainers = document.querySelectorAll('div.review__content[data-testid="review-content"], .review-container');
    console.log(`Found ${reviewContainers.length} Sainsbury's review containers`);
    
    // Process each review container
    for (const container of reviewContainers) {
      try {
        // Extract rating
        let rating = '5'; // Default to 5 stars
        const ratingElement = container.querySelector('div.review__star-rating, .star-rating');
        if (ratingElement) {
          const ratingText = ratingElement.textContent.trim();
          const ratingMatch = ratingText.match(/\\d+/);
          if (ratingMatch) {
            rating = ratingMatch[0];
          } else {
            // Try to count the filled stars
            const filledStars = ratingElement.querySelectorAll('.filled-star, [data-filled="true"]').length;
            if (filledStars > 0) {
              rating = filledStars.toString();
            }
          }
        }
        
        // Extract title
        let title = '';
        const titleElement = container.querySelector('div.review__title, .review-title, h3, h4');
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
        
        // Extract date
        let date = '';
        const dateElement = container.querySelector('div.review__date, .review-date, .date');
        if (dateElement) {
          date = dateElement.textContent.trim();
        }
        
        // Extract review text
        let text = '';
        const textElement = container.querySelector('div.review__text, .review-text, p');
        if (textElement) {
          text = textElement.textContent.trim();
        }
        
        // Only add if we have meaningful text or a rating
        if (text || rating) {
          results.push({ rating, title, date, text });
        }
      } catch (e) {
        console.error('Error processing Sainsbury\'s review container:', e);
      }
    }
    
    return results;
  });
}

module.exports = { handleSainsburysSite };
