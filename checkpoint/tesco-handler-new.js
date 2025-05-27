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
    // Take a screenshot for debugging
    await page.screenshot({ path: `tesco-initial-${Date.now()}.png` });
    
    // First, handle cookie consent if present
    try {
      const cookieButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button[data-auto="accept-cookies"]');
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

    // Look for the reviews section
    const reviewsSection = await page.$('.product-reviews, #reviews, [data-auto-id="product-reviews"], div[class*="ReviewTileContainer"], div[data-auto="review-card"]');
    if (!reviewsSection) {
      log.warning('Could not find reviews section on Tesco page');
    } else {
      log.info('Found reviews section on Tesco page');
    }

    // Take a screenshot after scrolling
    await page.screenshot({ path: `tesco-after-scroll-${Date.now()}.png` });

    // Click "Show more reviews" button multiple times to load more reviews
    let clickCount = 0;
    const maxClicks = 4; // Limit to 4 clicks to avoid infinite loops
    
    while (clickCount < maxClicks) {
      try {
        const showMoreButton = await page.$('button:has-text("show 10 more reviews"), button:has-text("Show more reviews"), button[data-auto="load-more-reviews"], button[class*="load-more"], button:has-text("Load more"), button:has-text("Show more"), button:has-text("More reviews")');
        if (showMoreButton) {
          log.info('Found "Show more reviews" button, clicking...');
          await showMoreButton.scrollIntoViewIfNeeded();
          await showMoreButton.click().catch(async (e) => {
            log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), showMoreButton);
          });
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

    // Take a screenshot after clicking show more
    await page.screenshot({ path: `tesco-after-show-more-${Date.now()}.png` });

    // Extract reviews using page evaluation with multiple selector strategies
    const reviews = await page.evaluate(() => {
      console.log('Starting Tesco review extraction with multiple selector strategies');
      const results = [];
      
      // Try multiple selector strategies
      const selectorStrategies = [
        // Strategy 1: Original selectors
        {
          container: '.review, .product-review, .review-container',
          rating: '.stars, .star-rating',
          title: '.review-title, .review-heading, h3, h4',
          date: '.review-date, .date, .timestamp',
          text: '.review-text, .review-content, p'
        },
        // Strategy 2: Updated selectors based on actual Tesco site
        {
          container: 'div[class*="ReviewTileContainer"], div[data-auto="review-card"], div[class*="review-card"]',
          rating: 'div[class*="ReviewRating-mfe-pdp"], div[data-auto="review-rating"], div[class*="review-rating"]',
          title: 'h3[class*="Title-mfe-pdp"], div[data-auto="review-title"], div[class*="review-title"]',
          date: 'span[class*="ReviewDate-mfe-pdp"], div[data-auto="review-date"], div[class*="review-date"]',
          text: 'span[class*="Content-mfe-pdp"], div[data-auto="review-text"], div[class*="review-text"]'
        },
        // Strategy 3: More generic selectors
        {
          container: '[class*="review" i], [data-auto*="review" i], [id*="review" i]',
          rating: '[class*="rating" i], [class*="stars" i], [data-auto*="rating" i]',
          title: '[class*="title" i], [data-auto*="title" i], h3, h4',
          date: '[class*="date" i], [data-auto*="date" i], time',
          text: '[class*="text" i], [class*="content" i], [data-auto*="text" i], p'
        }
      ];
      
      // Try each strategy until we find reviews
      for (const strategy of selectorStrategies) {
        console.log(`Trying selector strategy: ${JSON.stringify(strategy)}`);
        
        // Find all review containers using the current strategy
        const reviewContainers = document.querySelectorAll(strategy.container);
        console.log(`Found ${reviewContainers.length} Tesco review containers with selector: ${strategy.container}`);
        
        // If we found containers, process them
        if (reviewContainers.length > 0) {
          // Process each review container
          for (const container of reviewContainers) {
            try {
              // Extract rating
              let rating = '5'; // Default to 5 stars
              const ratingElement = container.querySelector(strategy.rating);
              if (ratingElement) {
                // Try to extract from text content
                const ratingText = ratingElement.textContent.trim();
                const ratingMatch = ratingText.match(/\d+/);
                if (ratingMatch) {
                  rating = ratingMatch[0];
                  console.log(`Extracted rating ${rating} from text content`);
                } else {
                  // Try to count filled stars
                  const filledStars = ratingElement.querySelectorAll('.filled-star, [data-filled="true"], [class*="filled"]').length;
                  if (filledStars > 0) {
                    rating = filledStars.toString();
                    console.log(`Extracted rating ${rating} from filled stars count`);
                  }
                }
              }
              
              // Extract title
              let title = '';
              const titleElement = container.querySelector(strategy.title);
              if (titleElement) {
                title = titleElement.textContent.trim();
                console.log(`Extracted title: "${title}"`);
              }
              
              // Extract date
              let date = '';
              const dateElement = container.querySelector(strategy.date);
              if (dateElement) {
                date = dateElement.textContent.trim();
                console.log(`Extracted date: "${date}"`);
              }
              
              // Extract review text
              let text = '';
              const textElement = container.querySelector(strategy.text);
              if (textElement) {
                text = textElement.textContent.trim();
                console.log(`Extracted text: "${text.substring(0, 30)}..."`);
              }
              
              // Only add if we have meaningful text or a rating
              if (text || rating) {
                results.push({ rating, title, date, text });
                console.log(`Added Tesco review with rating ${rating}`);
              }
            } catch (e) {
              console.error('Error processing Tesco review container:', e);
            }
          }
          
          // If we found reviews with this strategy, stop trying others
          if (results.length > 0) {
            console.log(`Found ${results.length} reviews with strategy, stopping search`);
            break;
          }
        }
      }
      
    if (results.length === 0) {
      console.log('No reviews found with standard strategies, trying Tesco-specific selectors');
      
      // Try more specific Tesco selectors based on current site structure
      const tescoSpecificSelectors = [
        // Current Tesco review selectors (2024/2025)
        '[data-auto="review-tile"]',
        '[class*="reviewTile"]',
        '[class*="ReviewTile"]',
        '.ddsweb-reviews-tile',
        '[data-testid*="review"]',
        // Rating and review content within tiles
        '[data-auto="review-content"]',
        '[data-auto="review-text"]',
        '[class*="review-content"]'
      ];
      
      for (const selector of tescoSpecificSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Trying Tesco selector "${selector}": found ${elements.length} elements`);
        
        if (elements.length > 0) {
          for (const element of elements) {
            const text = element.textContent.trim();
            
            // Only consider elements with substantial text that look like reviews
            if (text.length > 100 && 
                !text.includes('Average Rating') &&
                !text.includes('Help other customers') &&
                !text.includes('Write a review') &&
                !element.closest('[class*="navigation"]') &&
                !element.closest('[class*="header"]')) {
              
              console.log(`Found potential Tesco review: "${text.substring(0, 50)}..."`);
              
              results.push({
                rating: '5',
                title: 'Tesco Customer Review',
                date: '',
                text: text
              });
              
              // Limit to avoid picking up too much non-review content
              if (results.length >= 10) break;
            }
          }
          
          // If we found reviews with this selector, stop trying others
          if (results.length > 0) break;
        }
      }
      
      // If still no reviews, log what we found instead
      if (results.length === 0) {
        console.log('No reviews found. Page content sample:');
        const bodyText = document.body.textContent.substring(0, 500);
        console.log(bodyText);
      }
    }
      
      console.log(`Returning ${results.length} Tesco reviews`);
      return results;
    });

    log.info(`Extracted ${reviews.length} reviews from Tesco site`);

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.tescoReviews.push(...reviews);
      log.info(`Added ${reviews.length} reviews to global Tesco reviews array`);
    }

    // If we didn't find any reviews, log warning only
    if (global.tescoReviews.length === 0) {
      log.warning('No Tesco reviews found. No fallback reviews will be added.');
    }
  } catch (error) {
    log.error(`Error in Tesco handler: ${error.message}\n${error.stack}`);
    
    // If we encountered an error and found no reviews, log warning only
    if (global.tescoReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. No fallback reviews will be added.');
    }
  }

  return global.tescoReviews;
}

module.exports = { handleTescoSite };
