// Sainsbury's specific handler - Anti-Automation Resistant Version
async function handleSainsburysSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Sainsbury\'s specific handler with direct API access');

  // Initialize global array for Sainsbury's reviews if not exists
  if (!global.sainsburysReviews) {
    global.sainsburysReviews = [];
  }

  // Clear any existing reviews to avoid duplicates
  global.sainsburysReviews = [];
  
  try {
    // Instead of navigating through the site, let's extract the product ID from the URL
    const url = page.url();
    log.info(`Extracting product ID from URL: ${url}`);
    
    // Extract product ID from the URL directly
    let productId = null;
    const urlPathMatch = url.match(/\/([^\/]+)(?:\.html)?$/);
    if (urlPathMatch && urlPathMatch[1]) {
      productId = urlPathMatch[1];
      log.info(`Extracted product ID from URL: ${productId}`);
    }
    
    // If we can't get the ID from the URL, try one quick page load to extract it
    if (!productId) {
      log.info('Could not extract product ID from URL, trying with minimal page load');
      
      // Use a completely clean browser context with a different user agent
      const context = await page.context().browser().newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        javaScriptEnabled: true
      });
      
      // Create a new page with minimal fingerprint
      const minimalPage = await context.newPage();
      
      // Set minimal headers
      await minimalPage.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      
      // Try a very quick load just to get the page source
      try {
        const response = await minimalPage.goto(url, { 
          timeout: 15000,
          waitUntil: 'domcontentloaded'
        });
        
        if (response && response.status() === 200) {
          // Try to extract product ID from the HTML
          productId = await minimalPage.evaluate(() => {
            // Look for product ID in various locations
            const metaProduct = document.querySelector('meta[property="product:id"], meta[name="product:id"], meta[name="product-id"]');
            if (metaProduct) return metaProduct.getAttribute('content');
            
            // Try to find it in JSON-LD data
            const jsonLd = document.querySelector('script[type="application/ld+json"]');
            if (jsonLd) {
              try {
                const data = JSON.parse(jsonLd.textContent);
                if (data && data.productID) return data.productID;
                if (data && data.sku) return data.sku;
              } catch(e) {}
            }
            
            // Try data attributes
            const productElement = document.querySelector('[data-product-id], [data-pid], [data-product-sku]');
            if (productElement) {
              return productElement.getAttribute('data-product-id') || 
                     productElement.getAttribute('data-pid') || 
                     productElement.getAttribute('data-product-sku');
            }
            
            // Look for it in the URL path
            const pathSegments = window.location.pathname.split('/');
            const lastSegment = pathSegments[pathSegments.length - 1].replace('.html', '');
            if (lastSegment && /^[a-z0-9\-]+$/i.test(lastSegment)) {
              return lastSegment;
            }
            
            return null;
          });
          
          if (productId) {
            log.info(`Successfully extracted product ID: ${productId}`);
          }
        }
      } catch (e) {
        log.warning(`Error during minimal page load: ${e.message}`);
      } finally {
        await minimalPage.close();
        await context.close();
      }
    }
    
    // If we still don't have a product ID, try to parse it from the URL parts
    if (!productId) {
      const urlParts = url.split('/');
      productId = urlParts[urlParts.length - 1].replace('.html', '');
      log.info(`Using URL last segment as product ID: ${productId}`);
    }
    
    // Now try to access the reviews API directly using the product ID
    if (productId) {
      // Create a fresh browser context for API access
      const apiContext = await page.context().browser().newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      });
      
      const apiPage = await apiContext.newPage();
      
      // Set appropriate headers for API request
      await apiPage.setExtraHTTPHeaders({
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Origin': 'https://www.sainsburys.co.uk',
        'Referer': 'https://www.sainsburys.co.uk/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'DNT': '1',
        'X-Requested-With': 'XMLHttpRequest'
      });
      
      try {
        // Attempt multiple API endpoints and formats to find reviews
        const apiEndpoints = [
          // Standard format
          `https://reviews.sainsburys-groceries.co.uk/data/reviews.json?ApiVersion=5.4&Filter=ProductId%3A${productId}&Offset=0&Limit=${maxReviews}`,
          // Try with different parameter format
          `https://reviews.sainsburys-groceries.co.uk/data/reviews.json?ApiVersion=5.4&Filter=ProductId=${productId}&Offset=0&Limit=${maxReviews}`,
          // Try with product code format
          `https://reviews.sainsburys-groceries.co.uk/data/reviews.json?ApiVersion=5.4&Filter=ProductCode%3A${productId}&Offset=0&Limit=${maxReviews}`
        ];
        
        for (const endpoint of apiEndpoints) {
          log.info(`Trying API endpoint: ${endpoint}`);
          
          const apiResponse = await apiPage.goto(endpoint, {
            waitUntil: 'networkidle',
            timeout: 20000
          }).catch(e => {
            log.warning(`API request failed: ${e.message}`);
            return null;
          });
          
          if (apiResponse && apiResponse.status() === 200) {
            // Try to parse the response as JSON
            const responseText = await apiPage.content();
            try {
              const responseJson = JSON.parse(responseText);
              
              if (responseJson && responseJson.Results && responseJson.Results.length > 0) {
                log.info(`Successfully retrieved ${responseJson.Results.length} reviews from API`);
                
                // Process the reviews
                responseJson.Results.forEach(review => {
                  global.sainsburysReviews.push({
                    rating: review.Rating.toString(),
                    title: review.Title || 'Review',
                    date: review.SubmissionTime ? new Date(review.SubmissionTime).toLocaleDateString() : '',
                    text: review.ReviewText || '',
                    author: review.UserNickname || '',
                    productId: productId,
                    productName: review.ProductTitle || '',
                    sourceUrl: url
                  });
                });
                
                // We found reviews, no need to try other endpoints
                break;
              }
            } catch (e) {
              log.warning(`Error parsing API response: ${e.message}`);
            }
          }
        }
      } finally {
        await apiPage.close();
        await apiContext.close();
      }
    }
    
    // If direct API access didn't work, fall back to DOM extraction as a last resort
    if (global.sainsburysReviews.length === 0) {
      log.info('API extraction failed, attempting DOM extraction as last resort');
      
      // Check if we still have a usable page
      let needsNewPage = true;
      try {
        const isUsable = await page.evaluate(() => true).catch(() => false);
        needsNewPage = !isUsable;
      } catch (e) {
        needsNewPage = true;
      }
      
      if (needsNewPage) {
        const domContext = await page.context().browser().newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          bypassCSP: true
        });
        
        const domPage = await domContext.newPage();
        await domPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => {
          log.warning(`Failed to load page for DOM extraction: ${e.message}`);
        });
        
        // Try to extract reviews from DOM
        try {
          const reviews = await extractSainsburysReviews(domPage);
          if (reviews.length > 0) {
            log.info(`Extracted ${reviews.length} reviews from DOM`);
            global.sainsburysReviews.push(...reviews);
          }
        } catch (e) {
          log.error(`DOM extraction failed: ${e.message}`);
        } finally {
          await domPage.close();
          await domContext.close();
        }
      } else {
        // Use existing page for DOM extraction
        try {
          const reviews = await extractSainsburysReviews(page);
          if (reviews.length > 0) {
            log.info(`Extracted ${reviews.length} reviews from DOM`);
            global.sainsburysReviews.push(...reviews);
          }
        } catch (e) {
          log.error(`DOM extraction failed with existing page: ${e.message}`);
        }
      }
    }
    
    log.info(`Total extracted ${global.sainsburysReviews.length} reviews for Sainsbury's`);
    
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);
  }
  
  return global.sainsburysReviews;
}

// Helper function to extract reviews from the DOM
async function extractSainsburysReviews(page) {
  return await page.evaluate(() => {
    console.log('Starting Sainsbury\'s review extraction from DOM');
    const results = [];
    
    // Look for review elements (using multiple selector strategies)
    const reviewSelectors = [
      '.review, [class*="review-item"], [class*="review__container"]',
      '[data-testid*="review"], [id*="review-item"]',
      '.pd-reviews__review-container, div[id^="id_"]'
    ];
    
    let reviewElements = [];
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} review elements with selector: ${selector}`);
        reviewElements = Array.from(elements);
        break;
      }
    }
    
    // If still no reviews found, try a more aggressive approach
    if (reviewElements.length === 0) {
      console.log('No review elements found with standard selectors, trying aggressive approach');
      
      // Look for any elements that might contain review content
      const possibleReviews = Array.from(document.querySelectorAll('div, article'))
        .filter(el => {
          const text = el.innerText || '';
          return (text.includes('stars') || text.includes('out of 5')) && 
                 text.length > 100 && 
                 !el.querySelector('iframe, script, style');
        });
      
      console.log(`Found ${possibleReviews.length} possible review elements with aggressive approach`);
      reviewElements = possibleReviews;
    }
    
    // Process found elements
    for (const element of reviewElements) {
      try {
        // Extract rating - multiple methods
        let rating = '5'; // Default
        
        // Method 1: Look for elements with star ratings
        const ratingSelectors = [
          '[class*="rating"], [class*="stars"]',
          '[aria-label*="out of 5"], [aria-label*="stars"]',
          '[title*="out of 5"], [title*="stars"]'
        ];
        
        for (const selector of ratingSelectors) {
          const ratingEl = element.querySelector(selector);
          if (ratingEl) {
            // Try to extract from attributes first
            const ariaLabel = ratingEl.getAttribute('aria-label');
            const title = ratingEl.getAttribute('title');
            const ratingText = ariaLabel || title || ratingEl.textContent;
            
            if (ratingText) {
              const ratingMatch = ratingText.match(/(\d+(\.\d+)?)\s*(star|out of)/i);
              if (ratingMatch) {
                rating = ratingMatch[1];
                break;
              }
            }
          }
        }
        
        // Method 2: Count filled stars
        if (rating === '5') {
          const filledStars = element.querySelectorAll('.filled-star, [data-filled="true"], [class*="filled"], svg[class*="active"]').length;
          if (filledStars > 0 && filledStars <= 5) {
            rating = filledStars.toString();
          }
        }
        
        // Method 3: Scan text for rating patterns
        if (rating === '5') {
          const elementText = element.innerText;
          const ratingTextMatch = elementText.match(/(\d+(\.\d+)?)\s*(star|out of\s*5)/i);
          if (ratingTextMatch) {
            rating = ratingTextMatch[1];
          }
        }
        
        // Extract title - multiple methods
        let title = '';
        const titleSelectors = [
          'h3, h4, h5, [class*="title"], [class*="heading"]',
          '[class*="review-title"], [class*="review__title"]'
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = element.querySelector(selector);
          if (titleEl) {
            title = titleEl.textContent.trim();
            if (title) break;
          }
        }
        
        // If no title found, try to extract from first significant text
        if (!title) {
          const paragraphs = element.querySelectorAll('p, div');
          for (const p of paragraphs) {
            const text = p.textContent.trim();
            if (text && text.length > 5 && text.length < 100) {
              title = text;
              break;
            }
          }
        }
        
        // Extract text - find the longest paragraph or text block
        let text = '';
        const textSelectors = [
          'p, [class*="content"], [class*="text"], [class*="body"]',
          '[class*="review-text"], [class*="review__text"], [class*="review-content"], [class*="review__content"]'
        ];
        
        for (const selector of textSelectors) {
          const textElements = element.querySelectorAll(selector);
          if (textElements.length > 0) {
            // Find the longest text element
            let longestText = '';
            for (const el of textElements) {
              const elText = el.textContent.trim();
              if (elText.length > longestText.length) {
                longestText = elText;
              }
            }
            
            if (longestText) {
              text = longestText;
              break;
            }
          }
        }
        
        // If no specific text element found but element has substantial text
        if (!text && element.textContent.length > 100) {
          // Remove title from the element text if found
          let fullText = element.textContent;
          if (title) {
            fullText = fullText.replace(title, '');
          }
          
          // Remove common UI elements text
          const commonUITexts = [
            'Verified Purchase', 'Helpful', 'Report',
            'Was this helpful?', 'Yes', 'No', 'Flag', 
            'Share', 'Like', 'Comment', 'Reply'
          ];
          
          for (const uiText of commonUITexts) {
            fullText = fullText.replace(new RegExp(uiText, 'gi'), '');
          }
          
          // Clean up and use as review text
          text = fullText.replace(/\s+/g, ' ').trim();
        }
        
        // Extract date
        let date = '';
        const dateSelectors = [
          '[class*="date"], time, [datetime]',
          '[class*="review-date"], [class*="review__date"]'
        ];
        
        for (const selector of dateSelectors) {
          const dateEl = element.querySelector(selector);
          if (dateEl) {
            // Try datetime attribute first
            const datetime = dateEl.getAttribute('datetime');
            if (datetime) {
              date = new Date(datetime).toLocaleDateString();
            } else {
              date = dateEl.textContent.trim();
            }
            
            if (date) break;
          }
        }
        
        // Extract author
        let author = '';
        const authorSelectors = [
          '[class*="author"], [class*="nickname"], [class*="user"]',
          '[class*="review-author"], [class*="review__author"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorEl = element.querySelector(selector);
          if (authorEl) {
            author = authorEl.textContent.trim();
            // Remove common prefixes
            author = author.replace(/^(by|written by|posted by|from)/i, '').trim();
            if (author) break;
          }
        }
        
        // Only add if we have meaningful text or title
        if (text || (title && title.length > 10)) {
          results.push({ rating, title, date, text, author });
        }
      } catch (e) {
        console.error('Error extracting review from element:', e);
      }
    }
    
    return results;
  });
}

module.exports = { handleSainsburysSite };