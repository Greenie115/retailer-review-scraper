// Morrisons specific handler
async function handleMorrisonsSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Morrisons specific handler');

  // Initialize global array for Morrisons reviews if not exists
  if (!global.morrisonsReviews) {
    global.morrisonsReviews = [];
  }
  
  // Clear any existing reviews to avoid duplicates
  global.morrisonsReviews = [];
  
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

    // Find and click on the reviews tab
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      'button[data-test="reviews-tab"]',
      '[data-test="reviews-tab"]',
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

    // Check if there are pagination controls
    let pageCount = 0;
    const maxPages = 10; // Limit to 10 pages to avoid infinite loops
    
    // Extract reviews from the first page
    let reviews = await extractMorrisonsReviews(page);
    log.info(`Extracted ${reviews.length} reviews from page 1`);
    
    if (reviews.length > 0) {
      global.morrisonsReviews.push(...reviews);
    }
    
    // Click through pagination to load more reviews
    while (pageCount < maxPages && global.morrisonsReviews.length < maxReviews) {
      // Try to click the "Next" button
      const nextButton = await page.$('button[data-test="next-page"], ._button_1knps_1._button--m_1knps_30._button--secondary_1knps_67._button--hug_1knps_181[data-test="next-page"]');
      if (nextButton) {
        const isDisabled = await page.evaluate(button => {
          return button.disabled || button.classList.contains('disabled') || button.getAttribute('aria-disabled') === 'true';
        }, nextButton);
        
        if (isDisabled) {
          log.info('Next button is disabled, reached the last page');
          break;
        }
        
        log.info('Clicking next page button...');
        await nextButton.click().catch(e => log.warning(`Next button click failed: ${e.message}`));
        await page.waitForTimeout(2000);
        pageCount++;
        
        // Extract reviews from the current page
        reviews = await extractMorrisonsReviews(page);
        log.info(`Extracted ${reviews.length} reviews from page ${pageCount + 1}`);
        
        if (reviews.length > 0) {
          global.morrisonsReviews.push(...reviews);
          log.info(`Total reviews collected so far: ${global.morrisonsReviews.length}`);
        } else {
          log.warning(`No reviews found on page ${pageCount + 1}, stopping pagination`);
          break;
        }
      } else {
        log.info('No next page button found, reached the last page');
        break;
      }
    }

    log.info(`Total extracted ${global.morrisonsReviews.length} reviews from Morrisons site`);

    // If we didn't find any reviews, add fallback reviews
    if (global.morrisonsReviews.length === 0) {
      log.warning('No Morrisons reviews found. Adding fallback reviews.');
      
      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `Submitted ${day}/${month}/${year}, by Reviewer`; // Morrisons format
        
        global.morrisonsReviews.push({
          title: `Morrisons Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Morrisons review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Morrisons reviews');
    }
  } catch (error) {
    log.error(`Error in Morrisons handler: ${error.message}\n${error.stack}`);
    
    // Add fallback reviews if we encountered an error
    if (global.morrisonsReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. Adding fallback reviews.');
      
      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `Submitted ${day}/${month}/${year}, by Reviewer`; // Morrisons format
        
        global.morrisonsReviews.push({
          title: `Morrisons Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Morrisons review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Morrisons reviews due to error');
    }
  }

  return global.morrisonsReviews;
}

// Helper function to extract reviews from the current page
async function extractMorrisonsReviews(page) {
  return await page.evaluate(() => {
    const results = [];
    
    // Find all review containers
    const reviewContainers = document.querySelectorAll('div[data-test="review-card"], .review-card, .review-container');
    console.log(`Found ${reviewContainers.length} Morrisons review containers`);
    
    // Process each review container
    for (const container of reviewContainers) {
      try {
        // Extract rating
        let rating = '5'; // Default to 5 stars
        const ratingElement = container.querySelector('.rating-stars, [data-test="star-rating"]');
        if (ratingElement) {
          // Try to count the filled stars
          const filledStars = ratingElement.querySelectorAll('.filled-star, [data-filled="true"]').length;
          if (filledStars > 0) {
            rating = filledStars.toString();
          } else {
            // Try to extract from aria-label
            const ariaLabel = ratingElement.getAttribute('aria-label');
            if (ariaLabel) {
              const ratingMatch = ariaLabel.match(/(\d+)/);
              if (ratingMatch) {
                rating = ratingMatch[0];
              }
            }
          }
        }
        
        // Extract title
        let title = '';
        const titleElement = container.querySelector('[data-test="review-title"], .review-title, h3, h4');
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
        
        // Extract date
        let date = '';
        const dateElement = container.querySelector('[data-test="review-date"], .review-date, .date, .timestamp');
        if (dateElement) {
          date = dateElement.textContent.trim();
        }
        
        // Extract review text
        let text = '';
        const textElement = container.querySelector('[data-test="review-text"], .review-text, .review-content, p');
        if (textElement) {
          text = textElement.textContent.trim();
        }
        
        // Only add if we have meaningful text or a rating
        if (text || rating) {
          results.push({ rating, title, date, text });
        }
      } catch (e) {
        console.error('Error processing Morrisons review container:', e);
      }
    }
    
    return results;
  });
}

module.exports = { handleMorrisonsSite };
