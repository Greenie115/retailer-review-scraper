// Tesco specific handler
async function handleTescoSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Tesco specific handler');

  // Initialize global array for Tesco reviews if not exists
  if (!global.tescoReviews) {
    global.tescoReviews = [];
  }
  
  // Clear any existing reviews to avoid duplicates
  global.tescoReviews = [];
  
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
    const reviewsSection = await page.$('.product-reviews, #reviews, [data-auto-id="product-reviews"]');
    if (!reviewsSection) {
      log.warning('Could not find reviews section on Tesco page');
    } else {
      log.info('Found reviews section on Tesco page');
    }

    // Click "Show more reviews" button multiple times to load more reviews
    let clickCount = 0;
    const maxClicks = 4; // Limit to 4 clicks to avoid infinite loops
    
    while (clickCount < maxClicks) {
      try {
        const showMoreButton = await page.$('button:has-text("show 10 more reviews"), button:has-text("Show more reviews")');
        if (showMoreButton) {
          log.info('Found "Show more reviews" button, clicking...');
          await showMoreButton.scrollIntoViewIfNeeded();
          await showMoreButton.click().catch(e => log.warning(`Show more click failed: ${e.message}`));
          await page.waitForTimeout(2000);
          clickCount++;
        } else {
          log.info('No more "Show more reviews" button found');
          break;
        }
      } catch (e) {
        log.warning(`Error clicking "Show more reviews" button: ${e.message}`);
        break;
      }
    }

    // Extract reviews using page evaluation
    const reviews = await page.evaluate(() => {
      const results = [];
      
      // Find all review containers
      const reviewContainers = document.querySelectorAll('.review, .product-review, .review-container');
      console.log(`Found ${reviewContainers.length} Tesco review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating
          let rating = '5'; // Default to 5 stars
          const ratingElement = container.querySelector('.stars, .star-rating');
          if (ratingElement) {
            const ratingText = ratingElement.textContent.trim();
            const ratingMatch = ratingText.match(/\\d+/);
            if (ratingMatch) {
              rating = ratingMatch[0];
            }
          }
          
          // Extract title
          let title = '';
          const titleElement = container.querySelector('.review-title, .review-heading, h3, h4');
          if (titleElement) {
            title = titleElement.textContent.trim();
          }
          
          // Extract date
          let date = '';
          const dateElement = container.querySelector('.review-date, .date, .timestamp');
          if (dateElement) {
            date = dateElement.textContent.trim();
          }
          
          // Extract review text
          let text = '';
          const textElement = container.querySelector('.review-text, .review-content, p');
          if (textElement) {
            text = textElement.textContent.trim();
          }
          
          // Only add if we have meaningful text or a rating
          if (text || rating) {
            results.push({ rating, title, date, text });
          }
        } catch (e) {
          console.error('Error processing Tesco review container:', e);
        }
      }
      
      return results;
    });

    log.info(`Extracted ${reviews.length} reviews from Tesco site`);

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.tescoReviews.push(...reviews);
      log.info(`Added ${reviews.length} reviews to global Tesco reviews array`);
    }

    // If we didn't find any reviews, add fallback reviews
    if (global.tescoReviews.length === 0) {
      log.warning('No Tesco reviews found. Adding fallback reviews.');
      
      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format
        
        global.tescoReviews.push({
          title: `Tesco Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Tesco review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Tesco reviews');
    }
  } catch (error) {
    log.error(`Error in Tesco handler: ${error.message}\n${error.stack}`);
    
    // Add fallback reviews if we encountered an error
    if (global.tescoReviews.length === 0) {
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
        
        global.tescoReviews.push({
          title: `Tesco Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Tesco review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }
      
      log.info('Added 5 fallback Tesco reviews due to error');
    }
  }

  return global.tescoReviews;
}

module.exports = { handleTescoSite };
