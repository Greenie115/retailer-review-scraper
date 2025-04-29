// Tesco specific handler - back to original page with improved extraction
async function handleTescoSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Tesco specific handler');
  console.log('DEBUGGING: Using original page approach with improved extraction');

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

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Take a screenshot after scrolling
    await page.screenshot({ path: `tesco-after-scroll-${Date.now()}.png` });

    // Try to find the reviews section
    console.log('DEBUGGING: Looking for reviews section');
    const reviewsSection = await page.evaluate(() => {
      // Try different selectors to find the reviews section
      const selectors = [
        'div[id="review-container"]',
        'div[class*="review-container"]',
        'div[class*="ReviewContainer"]',
        'section[class*="review"]',
        'section[class*="Review"]'
      ];
      
      for (const selector of selectors) {
        const section = document.querySelector(selector);
        if (section) {
          return {
            found: true,
            selector: selector,
            html: section.outerHTML.substring(0, 500) + '...' // First 500 chars for debugging
          };
        }
      }
      
      return { found: false };
    });
    
    if (reviewsSection.found) {
      log.info(`Found reviews section with selector: ${reviewsSection.selector}`);
      log.info(`Reviews section HTML preview: ${reviewsSection.html}`);
    } else {
      log.warning('Could not find reviews section, will try to extract reviews anyway');
    }

    // Try to click the "Show more reviews" button a few times
    for (let i = 0; i < 5; i++) {
      try {
        console.log(`DEBUGGING: Looking for show more reviews button (attempt ${i+1})`);
        
        // Use the exact button selector from the HTML
        const showMoreButtonSelectors = [
          'button.styled__ShowMoreButton-mfe-pdp__sc-c5rmfv-2',
          'button:has-text("Show 10 more reviews")',
          'button:has-text("Show more reviews")',
          'button.ddsweb-button--text-button:has-text("Show")',
          'button[class*="ShowMoreButton"]'
        ];
        
        let showMoreButton = null;
        for (const selector of showMoreButtonSelectors) {
          showMoreButton = await page.$(selector);
          if (showMoreButton) {
            console.log(`DEBUGGING: Found show more button with selector: ${selector}`);
            break;
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
          await page.screenshot({ path: `tesco-before-click-${i+1}-${Date.now()}.png` });
          
          // Try clicking with force option
          await showMoreButton.click({ force: true }).catch(async (e) => {
            log.warning(`Direct show more click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), showMoreButton);
          });
          
          log.info(`Clicked show more button, attempt ${i+1}`);
          await page.waitForTimeout(3000); // Wait longer for reviews to load
          
          // Take a screenshot after clicking show more
          await page.screenshot({ path: `tesco-after-show-more-${i+1}-${Date.now()}.png` });
        } else {
          log.info('No show more button found, all reviews may be loaded');
          break;
        }
      } catch (e) {
        log.warning(`Error clicking show more button: ${e.message}`);
        break;
      }
    }

    // Extract the entire page HTML for debugging
    const pageHtml = await page.content();
    log.info(`Page HTML length: ${pageHtml.length}`);
    
    // Save the page HTML to a file for debugging
    const fs = require('fs');
    fs.writeFileSync(`tesco-page-html-${Date.now()}.html`, pageHtml);
    log.info('Saved page HTML to file for debugging');

    // Extract reviews using direct page evaluation with a more aggressive approach
    console.log('DEBUGGING: Extracting reviews with aggressive approach');
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
          // Extract all text from the container for debugging
          const allText = container.textContent.trim();
          console.log(`Review container text: ${allText.substring(0, 100)}...`);
          
          // Extract rating
          let rating = '5'; // Default to 5 stars
          
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
            const ratingText = allText.match(/(\d+) stars/i) || allText.match(/(\d+) out of 5/i);
            if (ratingText && ratingText[1]) {
              rating = ratingText[1];
              console.log(`Extracted rating from text: ${rating}`);
            }
          }
          
          // Extract title
          let title = 'Product Review'; // Default title
          const titleElement = container.querySelector('h3[class*="Title"], h3.ddsweb-heading, h3, h4, div[class*="title"], div[class*="Title"]');
          if (titleElement) {
            title = safeTextContent(titleElement);
            console.log(`Extracted title: "${title}"`);
          }
          
          // Extract date
          let date = 'Unknown date';
          const dateElement = container.querySelector('span[class*="ReviewDate"], span[class*="Date"], div[class*="date"], div[class*="Date"], p[class*="date"], p[class*="Date"]');
          if (dateElement) {
            date = safeTextContent(dateElement);
            console.log(`Extracted date: "${date}"`);
          } else {
            // Try to extract date from text
            const datePatterns = [
              /(\d+(?:st|nd|rd|th) [A-Z][a-z]+ \d{4})/i, // e.g., "23rd March 2025"
              /(\d{1,2}\/\d{1,2}\/\d{2,4})/i, // e.g., "23/03/2025"
              /([A-Z][a-z]+ \d{1,2},? \d{4})/i // e.g., "March 23, 2025"
            ];
            
            for (const pattern of datePatterns) {
              const match = allText.match(pattern);
              if (match && match[1]) {
                date = match[1];
                console.log(`Extracted date from text: "${date}"`);
                break;
              }
            }
          }
          
          // Extract review text
          let text = '';
          const contentElement = container.querySelector('span[class*="Content"], div[class*="content"], div[class*="Content"], p[class*="content"], p[class*="Content"], p');
          if (contentElement) {
            text = safeTextContent(contentElement);
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }
          
          // If we still don't have text, use the entire container text
          if (!text || text.length <= 5) {
            text = allText;
            
            // Remove the title and date from the text if they exist
            if (title !== 'Product Review') {
              text = text.replace(title, '');
            }
            if (date !== 'Unknown date') {
              text = text.replace(date, '');
            }
            
            // Remove common UI text
            const uiTexts = ['Report', 'Helpful', 'Write a review', 'stars', 'out of 5', 'Verified purchase'];
            for (const uiText of uiTexts) {
              text = text.replace(new RegExp(uiText, 'gi'), '');
            }
            
            text = text.trim();
            console.log(`Extracted text from container: "${text.substring(0, 30)}..."`);
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
      
      // If we still don't have any reviews, try a more aggressive approach
      if (results.length === 0) {
        console.log('No reviews found with standard approach, trying aggressive approach');
        
        // Look for any elements that might contain reviews
        const potentialReviewElements = document.querySelectorAll('div, section, article');
        
        for (const element of potentialReviewElements) {
          try {
            const text = element.textContent.trim();
            
            // Skip elements with very short text
            if (text.length < 20) continue;
            
            // Skip elements that are likely not reviews
            if (text.includes('Add to basket') || text.includes('Delivery') || text.includes('Collection')) continue;
            
            // Look for date patterns
            const datePatterns = [
              /(\d+(?:st|nd|rd|th) [A-Z][a-z]+ \d{4})/i, // e.g., "23rd March 2025"
              /(\d{1,2}\/\d{1,2}\/\d{2,4})/i, // e.g., "23/03/2025"
              /([A-Z][a-z]+ \d{1,2},? \d{4})/i // e.g., "March 23, 2025"
            ];
            
            let foundDate = null;
            for (const pattern of datePatterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                foundDate = match[1];
                break;
              }
            }
            
            // Skip elements without a date (likely not reviews)
            if (!foundDate) continue;
            
            // Look for star ratings
            let rating = '3'; // Default to 3 stars if we can't determine
            const ratingPatterns = [
              /(\d+) stars/i,
              /(\d+) out of 5/i,
              /rated (\d+)/i
            ];
            
            for (const pattern of ratingPatterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                rating = match[1];
                break;
              }
            }
            
            // Extract a title (first line or first 50 chars)
            let title = 'Product Review';
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            if (lines.length > 0) {
              title = lines[0].trim();
              if (title.length > 50) {
                title = title.substring(0, 47) + '...';
              }
            }
            
            // Use the rest as review text
            let reviewText = text;
            
            // Remove the title and date
            reviewText = reviewText.replace(title, '').replace(foundDate, '');
            
            // Remove common UI text
            const uiTexts = ['Report', 'Helpful', 'Write a review', 'stars', 'out of 5', 'Verified purchase'];
            for (const uiText of uiTexts) {
              reviewText = reviewText.replace(new RegExp(uiText, 'gi'), '');
            }
            
            reviewText = reviewText.trim();
            
            // Only add if we have meaningful text
            if (reviewText && reviewText.length > 10) {
              results.push({
                rating,
                title,
                date: foundDate,
                text: reviewText
              });
              console.log(`Added potential review with rating ${rating} and date ${foundDate}`);
            }
          } catch (e) {
            console.error('Error processing potential review element:', e);
          }
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
      
      // As a last resort, try to use the original approach that was working before
      log.info('Trying original approach as last resort');
      
      // Reload the page
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Extract reviews using the original approach
      const originalReviews = await page.evaluate(() => {
        const results = [];
        
        // Find all review containers
        const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0');
        
        // Process each review container
        for (const container of reviewContainers) {
          try {
            // Extract rating
            let rating = '5'; // Default to 5 stars
            const ratingContainer = container.querySelector('.styled__ReviewRating-mfe-pdp__sc-je4k7f-3');
            if (ratingContainer) {
              const ratingText = ratingContainer.getAttribute('aria-label');
              if (ratingText) {
                const ratingMatch = ratingText.match(/rating of (\d+) stars/);
                if (ratingMatch && ratingMatch[1]) {
                  rating = ratingMatch[1];
                }
              }
            }
            
            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = container.querySelector('.styled__Title-mfe-pdp__sc-je4k7f-2');
            if (titleElement) {
              title = titleElement.textContent.trim();
            }
            
            // Extract date
            let date = 'Unknown date';
            const dateElement = container.querySelector('.styled__ReviewDate-mfe-pdp__sc-je4k7f-9');
            if (dateElement) {
              date = dateElement.textContent.trim();
            }
            
            // Extract review text
            let text = '';
            const contentElement = container.querySelector('.styled__Content-mfe-pdp__sc-je4k7f-6');
            if (contentElement) {
              text = contentElement.textContent.trim();
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
      
      if (originalReviews && originalReviews.length > 0) {
        global.tescoReviews = originalReviews;
        log.info(`Added ${originalReviews.length} reviews using original approach`);
      }
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
