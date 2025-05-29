// Tesco specific handler with direct navigation to reviews page
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using direct navigation approach for Tesco reviews');

  // Initialize global array for Tesco reviews
  global.tescoReviews = [];

  try {
    // Implementation for Tesco site
    log.info('Tesco handler implementation');
    
    // Extract the product ID from the URL
    const url = page.url();
    log.info(`Original URL: ${url}`);
    
    // Extract product ID using regex
    const productIdMatch = url.match(/\/products\/(\d+)/);
    if (!productIdMatch || !productIdMatch[1]) {
      log.error('Could not extract product ID from URL');
      return global.tescoReviews;
    }
    
    const productId = productIdMatch[1];
    log.info(`Extracted product ID: ${productId}`);
    
    // Construct the reviews URL
    const reviewsUrl = `https://www.tesco.com/groceries/en-GB/reviews/${productId}`;
    log.info(`Navigating to reviews URL: ${reviewsUrl}`);
    
    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `tesco-initial-${Date.now()}.png` });
    
    // Navigate to the reviews page
    await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log.info('Navigated to reviews page');
    
    // Handle cookie consent if present
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
    
    // Take a screenshot after navigation
    await page.screenshot({ path: `tesco-reviews-page-${Date.now()}.png` });
    
    // Scroll down to load all reviews
    console.log('DEBUGGING: Scrolling page to load all reviews');
    await autoScroll(page);
    await page.waitForTimeout(2000);
    
    // Take a screenshot after scrolling
    await page.screenshot({ path: `tesco-after-scroll-${Date.now()}.png` });
    
    // Alternative approach: If direct navigation doesn't work, try to find and click the "See all reviews" link
    if (await page.$('a:has-text("See all reviews"), a:has-text("View all reviews"), a[href*="reviews"]')) {
      log.info('Found "See all reviews" link, trying to click it');
      
      try {
        const allReviewsLink = await page.$('a:has-text("See all reviews"), a:has-text("View all reviews"), a[href*="reviews"]');
        if (allReviewsLink) {
          await allReviewsLink.click().catch(async (e) => {
            log.warning(`Direct link click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(link => link.click(), allReviewsLink);
          });
          
          log.info('Clicked "See all reviews" link');
          await page.waitForTimeout(3000);
          
          // Take a screenshot after clicking the link
          await page.screenshot({ path: `tesco-after-all-reviews-click-${Date.now()}.png` });
          
          // Scroll down again to load all reviews
          await autoScroll(page);
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log.warning(`Error clicking "See all reviews" link: ${e.message}`);
      }
    }
    
    // Extract reviews using direct page evaluation
    console.log('DEBUGGING: Extracting reviews');
    const reviews = await page.evaluate(() => {
      console.log('Starting Tesco review extraction');
      const results = [];
      
      // Try different selectors for review containers
      const selectors = [
        '.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0',
        'div[class*="ReviewTileContainer"]',
        '.review-card',
        '.review-item',
        'div[class*="review"]'
      ];
      
      let reviewContainers = [];
      
      // Try each selector until we find reviews
      for (const selector of selectors) {
        const containers = document.querySelectorAll(selector);
        if (containers && containers.length > 0) {
          console.log(`Found ${containers.length} review containers with selector: ${selector}`);
          reviewContainers = containers;
          break;
        }
      }
      
      console.log(`Found ${reviewContainers.length} Tesco review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating
          let rating = '5'; // Default to 5 stars
          
          // Try different methods to extract rating
          
          // Method 1: From aria-label
          const ratingContainer = container.querySelector('div[aria-label*="rating"], div[aria-label*="stars"], div[class*="Rating"]');
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
          
          // Method 3: Look for text containing stars
          if (rating === '5') {
            const ratingText = container.textContent.match(/(\d+) stars/i) || container.textContent.match(/(\d+) out of 5/i);
            if (ratingText && ratingText[1]) {
              rating = ratingText[1];
              console.log(`Extracted rating from text: ${rating}`);
            }
          }
          
          // Extract title
          let title = 'Product Review'; // Default title
          const titleSelectors = [
            'h3[class*="Title"]',
            'h3.ddsweb-heading',
            'h3',
            'h4',
            'div[class*="title"]',
            'div[class*="Title"]'
          ];
          
          for (const selector of titleSelectors) {
            const titleElement = container.querySelector(selector);
            if (titleElement) {
              title = titleElement.textContent.trim();
              console.log(`Extracted title: "${title}"`);
              break;
            }
          }
          
          // Extract date
          let date = 'Unknown date';
          const dateSelectors = [
            'span[class*="ReviewDate"]',
            'span[class*="Date"]',
            'div[class*="date"]',
            'div[class*="Date"]',
            'p[class*="date"]',
            'p[class*="Date"]'
          ];
          
          for (const selector of dateSelectors) {
            const dateElement = container.querySelector(selector);
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date: "${date}"`);
              break;
            }
          }
          
          // Extract review text
          let text = '';
          const textSelectors = [
            'span[class*="Content"]',
            'div[class*="content"]',
            'div[class*="Content"]',
            'p[class*="content"]',
            'p[class*="Content"]',
            'p'
          ];
          
          for (const selector of textSelectors) {
            const textElement = container.querySelector(selector);
            if (textElement && !textElement.classList.contains('ddsweb-rating__hint')) {
              text = textElement.textContent.trim();
              if (text && text.length > 5) {
                console.log(`Extracted text: "${text.substring(0, 30)}..."`);
                break;
              }
            }
          }
          
          // If we still don't have text, try to get it from the container itself
          if (!text || text.length <= 5) {
            text = container.textContent.trim();
            // Remove the title and date from the text if they exist
            if (title !== 'Product Review') {
              text = text.replace(title, '');
            }
            if (date !== 'Unknown date') {
              text = text.replace(date, '');
            }
            text = text.trim();
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
