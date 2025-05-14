// Simplified Sainsbury's specific handler without fallback reviews
async function handleSainsburysSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using improved Sainsbury\'s specific handler');

  try {
    // Extract product ID from URL for better logging
    const url = page.url();
    const productId = url.split('/').pop();
    log.info(`Extracting product ID from URL: ${url}`);
    log.info(`Extracted product ID from URL: ${productId}`);
  } catch (e) {
    log.warning(`Error extracting product ID: ${e.message}`);
  }
  
  // Clear any existing reviews to avoid duplicates
  if (!global.sainsburysReviews) {
    global.sainsburysReviews = [];
  }
  global.sainsburysReviews = [];

  try {
    // Take a screenshot for debugging
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` }).catch(e => {
      log.warning(`Failed to take screenshot: ${e.message}`);
    });

    // Try to find and click on the reviews section
    try {
      // First, handle cookie consent if present
      try {
        const cookieButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button[id*="accept-cookies"]');
        if (cookieButton) {
          log.info('Found cookie consent button, clicking...');
          await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
          await page.waitForTimeout(2000);
        }
      } catch (cookieError) {
        log.warning(`Error handling cookie consent: ${cookieError.message}`);
      }

      // Add some human-like behavior
      await page.evaluate(() => {
        // Random scrolling
        const scrollTarget = window.innerHeight * (0.3 + Math.random() * 0.4);
        window.scrollTo(0, scrollTarget);
      });
      
      await page.waitForTimeout(2000);

      // Try to find the reviews section by clicking on reviews tab/button
      const reviewTabSelectors = [
        'button:has-text("Reviews")',
        'a:has-text("Reviews")',
        'button:has-text("Ratings & Reviews")',
        'a:has-text("Ratings & Reviews")',
        'button[data-test="reviews-tab"]',
        '[data-test="reviews-tab"]',
        'button[aria-controls="reviews"]',
        'a[href="#reviews"]',
        'li[data-tab="reviews"]',
        'div[role="tab"]:has-text("Reviews")',
        '[data-toggle="tab"]:has-text("Reviews")',
        '.gol-tabs__item:has-text("Reviews")',
        '.gol-tabs__item',
        '#reviews-tab',
        'a[href="#product-reviews"]'
      ];

      let tabClicked = false;
      for (const selector of reviewTabSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            log.info(`Found reviews tab with selector: ${selector}`);
            
            // Check if element is visible
            const isVisible = await element.isVisible().catch(() => false);
            if (!isVisible) {
              log.info(`Element found but not visible, skipping: ${selector}`);
              continue;
            }
            
            // Scroll into view with a smooth behavior
            await element.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            
            // Try multiple ways to click
            try {
              await element.click().catch(async () => {
                log.info(`Direct click failed, trying JavaScript click`);
                await page.evaluate(el => el.click(), element);
              });
              
              log.info(`Successfully clicked on reviews tab with selector: ${selector}`);
              await page.waitForTimeout(2000);
              tabClicked = true;
              break;
            } catch (clickError) {
              log.warning(`Error clicking on element: ${clickError.message}`);
            }
          }
        } catch (selectorError) {
          log.warning(`Error with selector ${selector}: ${selectorError.message}`);
        }
      }

      if (!tabClicked) {
        // Try JavaScript approach
        log.info(`Trying JavaScript approach to find and click reviews tab`);
        const clicked = await page.evaluate(() => {
          const possibleSelectors = [
            'button, a, [role="tab"]',
            '.gol-tabs__item',
            '[data-target="#reviews"]',
            '[href="#reviews"]',
            '[data-toggle="tab"]'
          ];
          
          for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const el of elements) {
              const text = el.textContent.toLowerCase();
              if (text.includes('review') || text.includes('ratings')) {
                console.log(`Found possible reviews tab via JavaScript`);
                el.click();
                return true;
              }
            }
          }
          
          return false;
        });
        
        if (clicked) {
          log.info(`Successfully clicked reviews tab via JavaScript`);
          await page.waitForTimeout(2000);
        } else {
          log.warning(`Could not find or click reviews tab with any method`);
          
          // Scroll down to find the reviews section
          await page.evaluate(() => {
            window.scrollTo({
              top: document.body.scrollHeight * 0.7,
              behavior: 'smooth'
            });
          });
          
          await page.waitForTimeout(2000);
        }
      }
    } catch (reviewSectionError) {
      log.warning(`Error finding reviews section: ${reviewSectionError.message}`);
    }

    // Take a screenshot after attempting to find reviews section
    await page.screenshot({ path: `sainsburys-after-find-reviews-${Date.now()}.png` }).catch(e => {
      log.warning(`Failed to take screenshot: ${e.message}`);
    });

    // Try to extract reviews directly from page JSON data
    try {
      log.info('Attempting to extract reviews directly from page JSON data');
      
      const reviewsData = await page.evaluate(() => {
        // Look for JSON data in the page that might contain reviews
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        
        for (const script of scripts) {
          try {
            const jsonData = JSON.parse(script.textContent);
            
            // Check if this is product data with reviews
            if (jsonData && jsonData.review) {
              return jsonData.review;
            }
            
            // Or check for reviews in aggregateRating
            if (jsonData && jsonData.aggregateRating && jsonData.aggregateRating.reviewCount) {
              return jsonData.review || [];
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
        
        // Also check for any inline review data in HTML
        const reviewElements = document.querySelectorAll('[itemtype*="Review"], [itemprop="review"]');
        if (reviewElements.length > 0) {
          return Array.from(reviewElements).map(el => {
            // Try to extract structured review data
            const ratingEl = el.querySelector('[itemprop="ratingValue"]');
            const authorEl = el.querySelector('[itemprop="author"]');
            const dateEl = el.querySelector('[itemprop="datePublished"]');
            const bodyEl = el.querySelector('[itemprop="reviewBody"]');
            
            return {
              rating: ratingEl ? ratingEl.textContent.trim() : '5',
              author: authorEl ? authorEl.textContent.trim() : '',
              date: dateEl ? dateEl.textContent.trim() : '',
              text: bodyEl ? bodyEl.textContent.trim() : ''
            };
          });
        }
        
        return null;
      });
      
      if (reviewsData && Array.isArray(reviewsData) && reviewsData.length > 0) {
        log.info(`Found ${reviewsData.length} reviews in page JSON data`);
        
        // Process these reviews and add them to our collection
        reviewsData.forEach(review => {
          global.sainsburysReviews.push({
            rating: review.reviewRating?.ratingValue || review.rating || '5',
            title: review.name || review.title || 'Review',
            date: review.datePublished || review.date || '',
            text: review.reviewBody || review.text || ''
          });
        });
      } else {
        log.info('No reviews found in page JSON data');
      }
    } catch (jsonError) {
      log.warning(`Error extracting reviews from JSON: ${jsonError.message}`);
    }

    // Extract reviews from the page with enhanced validation
    const pageReviews = await extractSainsburysReviewsEnhanced(page);
    
    if (pageReviews.length > 0) {
      // Apply strict validation filter to remove navigation elements
      const validReviews = pageReviews.filter(review => {
        // Check if this is a navigation element mistakenly captured as a review
        const navKeywords = [
          'login', 'register', 'groceries', 'favorites', 'nectar', 'offers', 
          'recipes', 'delivery', 'search', 'accessibility', 'cookie policy', 
          'terms', 'occasions', 'summer', 'arrow', 'opens in new tab', 
          'help centre', 'contact us', 'keyworker'
        ];
        
        const isNavigation = navKeywords.some(keyword => 
          review.text.toLowerCase().includes(keyword)
        );
        
        // Also check for other patterns that indicate this isn't a review
        const hasNoSpaces = review.text.split(' ').length < 4;
        const tooShort = review.text.length < 20;
        const isJustNavBar = /Search.+Groceries.+Favorites.+Offers/i.test(review.text);
        
        return !isNavigation && !hasNoSpaces && !tooShort && !isJustNavBar;
      });
      
      if (validReviews.length > 0) {
        log.info(`Successfully extracted ${validReviews.length} valid reviews via direct page extraction`);
        log.info(`Filtered out ${pageReviews.length - validReviews.length} navigation elements`);
        global.sainsburysReviews = validReviews;
      } else {
        log.info(`All extracted content (${pageReviews.length} items) appeared to be navigation elements`);
      }
    }

    log.info(`Total extracted ${global.sainsburysReviews.length} reviews for Sainsbury's`);

    // If we didn't find any reviews, log a warning (but don't add fallbacks)
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found after all extraction attempts.');
    }
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);
    
    // Log error but don't add fallback reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('Error occurred and no reviews were found for Sainsbury\'s.');
    }
  }

  return global.sainsburysReviews;
}

// Extract reviews with enhanced validation
async function extractSainsburysReviewsEnhanced(page) {
  return await page.evaluate(() => {
    console.log('Starting enhanced Sainsbury\'s review extraction with improved validation');
    const results = [];
    
    // Function to check if text looks like a genuine review
    function isGenuineReview(text) {
      if (!text) return false;
      
      // Minimum requirements for a valid review
      if (text.length < 20) return false;
      if (text.split(' ').length < 5) return false;
      
      // Check against navigation/UI patterns more extensively
      const navigationPatterns = [
        /login|register|groceries|nectar|offers|recipes|delivery|search|favorites/i,
        /accessibility|cookie policy|terms|privacy|help centre|contact us/i,
        /opens in new tab|arrow down|keyworker|discount/i,
        /basket|trolley|shopping|account|password|sign in|sign out/i,
        /menu|navigation|header|footer|home page|sitemap/i
      ];
      
      if (navigationPatterns.some(pattern => pattern.test(text))) {
        return false;
      }
      
      // Check if text resembles a navigation bar or page structure listing
      if (/Search.+Groceries.+Favorites.+Nectar.+Offers/i.test(text)) {
        return false;
      }
      
      // Check for review-like content
      const reviewPatterns = [
        // Opinion-related terms
        /good|great|nice|love|like|excellent|recommend|quality|taste|buy/i,
        // Negative opinions
        /poor|bad|disappointed|waste|wouldn't recommend|not worth/i,
        // Product experience
        /tried|purchased|bought|ordered|delivery|received|arrived/i,
        // Personal pronouns suggesting real review
        /\bI\b|\bmy\b|\bwe\b|\bour\b|\bme\b/i
      ];
      
      // Must match at least one review pattern to be considered a review
      return reviewPatterns.some(pattern => pattern.test(text));
    }
    
    // Approach 1: Enhanced specific container search
    const reviewSelectors = [
      // Sainsbury's specific selectors
      '.reviews-list-item', 
      '[data-testid*="review"]', 
      '.product-reviews__list-item', 
      '.review',
      // More generic review selectors
      '[class*="review-item"]',
      '[class*="review_item"]',
      '[class*="reviewItem"]',
      '[id*="review-item"]',
      '[id*="review_item"]',
      '.feedback-item',
      '.comment-item'
    ];
    
    // Try all selectors to find review containers
    for (const selector of reviewSelectors) {
      const containers = document.querySelectorAll(selector);
      console.log(`Checking selector "${selector}": found ${containers.length} elements`);
      
      if (containers.length > 0) {
        for (const container of containers) {
          try {
            // Extract rating
            let rating = '5'; // Default
            
            // Try multiple rating selectors
            const ratingSelectors = [
              '.product-reviews__rating', 
              '[data-testid*="rating"]',
              '[class*="rating"]',
              '[class*="stars"]',
              'span[itemprop="ratingValue"]'
            ];
            
            for (const ratingSelector of ratingSelectors) {
              const ratingEl = container.querySelector(ratingSelector);
              if (ratingEl) {
                // Try to extract from filled stars
                const stars = ratingEl.querySelectorAll('svg, .filled, .star-filled, [class*="star-full"]').length;
                if (stars > 0 && stars <= 5) {
                  rating = stars.toString();
                  break;
                }
                
                // Try to extract from text
                const ratingText = ratingEl.textContent.trim();
                const ratingMatch = ratingText.match(/(\d+(\.\d+)?)\s*(out of|\/)\s*\d+/);
                if (ratingMatch) {
                  rating = ratingMatch[1];
                  break;
                }
              }
            }
            
            // Extract title
            let title = '';
            const titleSelectors = [
              '.product-reviews__title', 
              'h3', 
              'h4',
              '[class*="title"]',
              '[class*="heading"]',
              'strong'
            ];
            
            for (const titleSelector of titleSelectors) {
              const titleEl = container.querySelector(titleSelector);
              if (titleEl) {
                title = titleEl.textContent.trim();
                break;
              }
            }
            
            // Extract date
            let date = '';
            const dateSelectors = [
              '.product-reviews__date', 
              'time', 
              '[data-testid*="date"]',
              '[class*="date"]',
              '[class*="timestamp"]',
              'small'
            ];
            
            for (const dateSelector of dateSelectors) {
              const dateEl = container.querySelector(dateSelector);
              if (dateEl) {
                date = dateEl.textContent.trim();
                break;
              }
            }
            
            // Extract text (more aggressive approach)
            let text = '';
            const textSelectors = [
              '.product-reviews__text', 
              'p', 
              '[data-testid*="text"]',
              '[class*="text"]',
              '[class*="content"]',
              '[class*="body"]',
              '[class*="description"]'
            ];
            
            // First try with selectors
            for (const textSelector of textSelectors) {
              const textEl = container.querySelector(textSelector);
              if (textEl) {
                const candidateText = textEl.textContent.trim();
                if (candidateText.length > 20) {
                  text = candidateText;
                  break;
                }
              }
            }
            
            // If no text found with selectors, try using container text directly
            if (!text) {
              text = container.textContent.trim();
              
              // Clean up the text by removing title, date, etc.
              if (title) text = text.replace(title, '');
              if (date) text = text.replace(date, '');
              
              // Clean up whitespace
              text = text.replace(/\s+/g, ' ').trim();
            }
            
            // Apply validation to ensure this is a genuine review
            if (isGenuineReview(text)) {
              results.push({ rating, title, date, text });
              console.log(`Added review with text: "${text.substring(0, 30)}..."`);
            } else {
              console.log(`Rejected non-review text: "${text.substring(0, 30)}..."`);
            }
          } catch (e) {
            console.error('Error processing container:', e);
          }
        }
        
        // If we found any valid reviews, stop looking
        if (results.length > 0) {
          console.log(`Found ${results.length} valid reviews, stopping further searches`);
          break;
        }
      }
    }
    
    // Approach 2: Content-based identification of reviews
    if (results.length === 0) {
      console.log('No reviews found with container selectors, trying content-based approach');
      
      // Find all paragraphs that could be reviews
      const paragraphs = document.querySelectorAll('p');
      
      for (const p of paragraphs) {
        try {
          const text = p.textContent.trim();
          
          // Skip elements in navigation/header/footer areas
          if (p.closest('nav, header, footer, .navigation, .menu, #header, #footer')) {
            continue;
          }
          
          // Check if this paragraph looks like a review
          if (isGenuineReview(text)) {
            // Also verify this is in a content area, not UI
            const isInReviewSection = !!p.closest('[id*="review"], [class*="review"], [data-testid*="review"], [class*="product-detail"], [class*="product-info"], [class*="description"], main, article, .main-content, #content');
            
            if (isInReviewSection) {
              results.push({ 
                rating: '5', // Default as we can't find specific rating
                title: '',   // Default empty title
                date: '',    // Default empty date
                text: text
              });
              console.log(`Added review from paragraph content approach: "${text.substring(0, 30)}..."`);
            }
          }
        } catch (e) {
          console.error('Error in content-based approach:', e);
        }
      }
    }
    
    console.log(`Returning ${results.length} validated Sainsbury's reviews from enhanced extraction`);
    return results;
  });
}

module.exports = { handleSainsburysSite };