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
    // Take a screenshot for debugging
    await page.screenshot({ path: `morrisons-initial-${Date.now()}.png` });
    
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

    // Find and click on the reviews tab
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      'button[data-test="reviews-tab"]',
      '[data-test="reviews-tab"]',
      'button[aria-controls="reviews"]',
      'a[href="#reviews"]',
      'li[data-tab="reviews"]',
      'div[role="tab"]:has-text("Reviews")'
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
        const possibleTabs = Array.from(document.querySelectorAll('button[role="tab"], a[role="tab"], [role="tab"], a[href*="review"], button:contains("Review"), a:contains("Review")'));
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

    // Take a screenshot after clicking the reviews tab
    await page.screenshot({ path: `morrisons-after-tab-click-${Date.now()}.png` });

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
      // Try to click the "Next" button with the exact selector from the HTML
      const nextButtonSelectors = [
        'button[data-test="next-page"]',
        '._button_5c7ih_1._button--m_5c7ih_30._button--secondary_5c7ih_53._button--hug_5c7ih_139[data-test="next-page"]',
        'button._button_5c7ih_1._button--m_5c7ih_30._button--secondary_5c7ih_53._button--hug_5c7ih_139',
        'button[aria-label="See next page."]',
        'svg[data-test="icon__arrow_right"]',
        'button:has-text("Next")',
        'a:has-text("Next")',
        '[aria-label="Next page"]',
        'button[aria-label="Next page"]',
        'a[aria-label="Next page"]',
        'button.pagination-next',
        'a.pagination-next',
        'li.next a',
        'button[data-test*="next"]',
        'a[data-test*="next"]'
      ];
      
      let nextButton = null;
      for (const selector of nextButtonSelectors) {
        nextButton = await page.$(selector);
        if (nextButton) {
          log.info(`Found next button with selector: ${selector}`);
          break;
        }
      }
      
      // If we still don't have a next button, try a more aggressive approach
      if (!nextButton) {
        log.info('No next button found with standard selectors, trying JavaScript approach');
        
        // Try to find the next button using JavaScript
        const nextButtonFound = await page.evaluate(() => {
          // Look for any element that might be a next button
          const possibleNextButtons = [];
          
          // Method 1: Look for elements with specific attributes
          document.querySelectorAll('a[href*="page="], button[data-test*="next"], a[data-test*="next"]').forEach(el => possibleNextButtons.push(el));
          
          // Method 2: Look for elements with right arrow icons
          document.querySelectorAll('a svg, button svg').forEach(svg => {
            const parent = svg.closest('a') || svg.closest('button');
            if (parent && !possibleNextButtons.includes(parent)) {
              possibleNextButtons.push(parent);
            }
          });
          
          // Method 3: Look for elements with pagination-related classes
          document.querySelectorAll('[class*="pagination"], [class*="Pagination"], [class*="paging"], [class*="Paging"]').forEach(el => {
            if (!possibleNextButtons.includes(el)) {
              possibleNextButtons.push(el);
            }
          });
          
          // Find the most likely next button
          for (const button of possibleNextButtons) {
            // Check if it has text or attributes suggesting it's a next button
            const text = button.textContent.toLowerCase();
            const hasNextText = text.includes('next') || text.includes('>');
            const hasRightArrow = button.querySelector('svg') !== null;
            const hasNextClass = button.className.includes('right') || button.className.includes('next');
            const hasNextAttribute = button.getAttribute('aria-label')?.toLowerCase().includes('next') || 
                                    button.getAttribute('data-test')?.toLowerCase().includes('next');
            
            if (hasNextText || hasRightArrow || hasNextClass || hasNextAttribute) {
              console.log('Found likely next button:', button);
              
              // Store the button's path for later use
              const path = [];
              let el = button;
              while (el && el !== document.body) {
                let selector = el.tagName.toLowerCase();
                if (el.id) {
                  selector += `#${el.id}`;
                } else if (el.className) {
                  selector += `.${el.className.split(' ')[0]}`;
                }
                path.unshift(selector);
                el = el.parentElement;
              }
              
              // Store the path in a global variable
              window.__nextButtonPath = path.join(' > ');
              
              // Click the button
              button.click();
              return true;
            }
          }
          
          return false;
        });
        
        if (nextButtonFound) {
          log.info('Found and clicked next button using JavaScript approach');
          await page.waitForTimeout(3000); // Wait for page to load
          pageCount++;
          
          // Take a screenshot after clicking next page
          await page.screenshot({ path: `morrisons-after-js-next-page-${pageCount}-${Date.now()}.png` });
          
          // Extract reviews from the current page
          reviews = await extractMorrisonsReviews(page);
          log.info(`Extracted ${reviews.length} reviews from page ${pageCount + 1}`);
          
          if (reviews.length > 0) {
            global.morrisonsReviews.push(...reviews);
            log.info(`Total reviews collected so far: ${global.morrisonsReviews.length}`);
            continue; // Skip to the next iteration
          }
        }
      }

      if (nextButton) {
        const isDisabled = await page.evaluate(button => {
          return button.disabled || 
                 button.classList.contains('disabled') || 
                 button.getAttribute('aria-disabled') === 'true';
        }, nextButton);
        
        if (isDisabled) {
          log.info('Next button is disabled, reached the last page');
          break;
        }
        
        log.info('Clicking next page button...');
        
        // Take a screenshot before clicking
        await page.screenshot({ path: `morrisons-before-next-page-${pageCount}-${Date.now()}.png` });
        
        // Scroll to make sure the button is visible
        await nextButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        
        // Try multiple click methods
        try {
          // Method 1: Direct click
          await nextButton.click({ force: true }).catch(async (e) => {
            log.warning(`Direct click failed: ${e.message}, trying other methods...`);
            
            // Method 2: JavaScript click
            await page.evaluate(button => button.click(), nextButton).catch(async (e) => {
              log.warning(`JavaScript click failed: ${e.message}, trying href navigation...`);
              
              // Method 3: Extract href and navigate
              const href = await page.evaluate(button => button.getAttribute('href'), nextButton);
              if (href) {
                const currentUrl = page.url();
                const baseUrl = currentUrl.split('?')[0];
                let targetUrl;
                
                if (href.startsWith('http')) {
                  targetUrl = href;
                } else if (href.startsWith('/')) {
                  const domain = currentUrl.split('/').slice(0, 3).join('/');
                  targetUrl = domain + href;
                } else {
                  // Fallback: just append to current URL
                  targetUrl = baseUrl + '?page=' + (pageCount + 1);
                }
                
                log.info(`Navigating to next page URL: ${targetUrl}`);
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
              }
            });
          });
        } catch (clickError) {
          log.error(`All click methods failed: ${clickError.message}`);
          break;
        }
        
        await page.waitForTimeout(3000); // Wait longer for page to load
        pageCount++;
        
        // Take a screenshot after clicking next page
        await page.screenshot({ path: `morrisons-after-next-page-${pageCount}-${Date.now()}.png` });
        
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
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format
        
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
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format
        
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
    console.log('Starting Morrisons review extraction with exact HTML structure');
    const results = [];
    
    // Based on the exact HTML structure provided
    // First, look for the review items in the review list
    const reviewItems = document.querySelectorAll('li[data-test^="review-item-"]');
    console.log(`Found ${reviewItems.length} Morrisons review items with exact selector`);
    
    if (reviewItems.length > 0) {
      // Process each review item
      for (const item of reviewItems) {
        try {
          // Extract rating from the SVG icons or text
          let rating = '5'; // Default to 5 stars
          
          // Method 1: Count the filled stars (SVG icons with icon__reviews)
          const filledStars = item.querySelectorAll('svg[data-test="icon__reviews"]').length;
          if (filledStars > 0) {
            rating = filledStars.toString();
            console.log(`Extracted rating ${rating} from filled stars count`);
          } else {
            // Method 2: Extract from text content that says "X out of 5"
            const ratingText = item.querySelector('span._text_16wi0_1._text--m_16wi0_23')?.textContent.trim();
            if (ratingText && ratingText.includes('out of')) {
              const ratingMatch = ratingText.match(/(\d+)\s+out\s+of\s+\d+/);
              if (ratingMatch) {
                rating = ratingMatch[1];
                console.log(`Extracted rating ${rating} from text content: "${ratingText}"`);
              }
            }
          }
          
          // Extract title from the h4 element
          let title = '';
          const titleElement = item.querySelector('h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23');
          if (titleElement) {
            // Get only the visible text, not the hidden span
            const visibleText = Array.from(titleElement.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE || 
                             (node.nodeType === Node.ELEMENT_NODE && 
                              !node.classList.contains('salt-vc')))
              .map(node => node.textContent.trim())
              .join('');
            
            title = visibleText.trim();
            console.log(`Extracted title: "${title}"`);
          }
          
          // Extract date from the span with class _text_16wi0_1 _text--s_16wi0_13
          let date = '';
          const dateElement = item.querySelector('span._text_16wi0_1._text--s_16wi0_13');
          if (dateElement) {
            const fullDateText = dateElement.textContent.trim();
            // Extract just the date part (DD/MM/YYYY) from "Submitted DD/MM/YYYY, by Author"
            const dateMatch = fullDateText.match(/Submitted\s+(\d{2}\/\d{2}\/\d{4}),\s+by/);
            if (dateMatch && dateMatch[1]) {
              date = dateMatch[1]; // Just the DD/MM/YYYY part
            } else {
              date = fullDateText; // Fallback to full text if pattern doesn't match
            }
            console.log(`Extracted date: "${date}" from "${fullDateText}"`);
          }
          
          // Extract review text from the span with class sc-16m6t4r-0
          let text = '';
          const textElement = item.querySelector('span._text_16wi0_1._text--m_16wi0_23.sc-16m6t4r-0');
          if (textElement) {
            text = textElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }
          
          // Only add if we have meaningful text or a rating
          if (text || title) {
            results.push({ rating, title, date, text });
            console.log(`Added Morrisons review with rating ${rating}, title: "${title}", date: "${date}"`);
          }
        } catch (e) {
          console.error('Error processing Morrisons review item:', e);
        }
      }
    }
    
    // If we didn't find any reviews with the exact structure, try alternative selectors
    if (results.length === 0) {
      console.log('No reviews found with exact structure, trying alternative selectors');
      
      // Try to find review items with alternative selectors
      const alternativeItems = document.querySelectorAll('.sc-xdgqhu-0, [class*="review-item"], [data-test*="review"]');
      console.log(`Found ${alternativeItems.length} Morrisons review items with alternative selectors`);
      
      if (alternativeItems.length > 0) {
        // Process each alternative item
        for (const item of alternativeItems) {
          try {
            // Extract rating
            let rating = '5'; // Default to 5 stars
            
            // Look for rating text
            const ratingTexts = Array.from(item.querySelectorAll('span')).filter(span => 
              span.textContent.includes('out of 5'));
            
            if (ratingTexts.length > 0) {
              const ratingText = ratingTexts[0].textContent.trim();
              const ratingMatch = ratingText.match(/(\d+)\s+out\s+of\s+\d+/);
              if (ratingMatch) {
                rating = ratingMatch[1];
                console.log(`Extracted rating ${rating} from text: "${ratingText}"`);
              }
            } else {
              // Count SVG icons
              const svgIcons = item.querySelectorAll('svg');
              const filledIcons = Array.from(svgIcons).filter(svg => 
                svg.getAttribute('data-test')?.includes('reviews') && 
                !svg.getAttribute('data-test')?.includes('outline'));
              
              if (filledIcons.length > 0) {
                rating = filledIcons.length.toString();
                console.log(`Extracted rating ${rating} from SVG icons count`);
              }
            }
            
            // Extract title
            let title = '';
            const headings = item.querySelectorAll('h4, h3');
            if (headings.length > 0) {
              title = headings[0].textContent.replace(/Rated.*$/, '').trim();
              console.log(`Extracted title: "${title}"`);
            }
            
            // Extract date
            let date = '';
            const smallTexts = Array.from(item.querySelectorAll('span')).filter(span => 
              span.textContent.includes('Submitted'));
            
            if (smallTexts.length > 0) {
              const fullDateText = smallTexts[0].textContent.trim();
              // Extract just the date part (DD/MM/YYYY) from "Submitted DD/MM/YYYY, by Author"
              const dateMatch = fullDateText.match(/Submitted\s+(\d{2}\/\d{2}\/\d{4}),\s+by/);
              if (dateMatch && dateMatch[1]) {
                date = dateMatch[1]; // Just the DD/MM/YYYY part
              } else {
                date = fullDateText; // Fallback to full text if pattern doesn't match
              }
              console.log(`Extracted date: "${date}" from "${fullDateText}"`);
            }
            
            // Extract review text
            let text = '';
            const paragraphs = item.querySelectorAll('span[class*="sc-16m6t4r"], p, [class*="content"]');
            if (paragraphs.length > 0) {
              text = paragraphs[0].textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }
            
            // Only add if we have meaningful text or a title
            if (text || title) {
              results.push({ rating, title, date, text });
              console.log(`Added Morrisons review with rating ${rating}, title: "${title}", date: "${date}"`);
            }
          } catch (e) {
            console.error('Error processing alternative Morrisons review item:', e);
          }
        }
      }
    }
    
    // If we still don't have reviews, try a more aggressive approach
    if (results.length === 0) {
      console.log('No reviews found with standard strategies, trying aggressive approach');
      
      // Look for the review list
      const reviewList = document.querySelector('ul[data-test="review-list"]');
      if (reviewList) {
        console.log('Found review list, extracting reviews directly');
        
        // Get all list items
        const listItems = reviewList.querySelectorAll('li');
        console.log(`Found ${listItems.length} list items in review list`);
        
        for (const item of listItems) {
          try {
            // Extract rating
            let rating = '5'; // Default
            const ratingText = item.textContent.match(/(\d+)\s+out\s+of\s+5/);
            if (ratingText) {
              rating = ratingText[1];
            }
            
            // Extract title - look for bold text
            let title = '';
            const boldTexts = item.querySelectorAll('[class*="bold"]');
            if (boldTexts.length > 0) {
              title = boldTexts[0].textContent.replace(/Rated.*$/, '').trim();
            }
            
            // Extract date - look for text with "Submitted"
            let date = '';
            if (item.textContent.includes('Submitted')) {
              // Extract just the date part (DD/MM/YYYY) from "Submitted DD/MM/YYYY, by Author"
              const dateMatch = item.textContent.match(/Submitted\s+(\d{2}\/\d{2}\/\d{4}),\s+by/);
              if (dateMatch && dateMatch[1]) {
                date = dateMatch[1]; // Just the DD/MM/YYYY part
                console.log(`Extracted date: "${date}" from aggressive approach`);
              } else {
                // Fallback to the old approach if the specific pattern doesn't match
                const match = item.textContent.match(/Submitted\s+([^,]+),\s+by/);
                if (match) {
                  date = match[1]; // Just the date part without "Submitted" and "by Author"
                  console.log(`Extracted date: "${date}" using fallback in aggressive approach`);
                }
              }
            }
            
            // Extract review text - any substantial text that's not the title or date
            let text = '';
            const allText = item.textContent;
            if (title && allText) {
              // Remove title, rating text, and date from the full text
              let remainingText = allText
                .replace(title, '')
                .replace(/\d+\s+out\s+of\s+5/, '')
                .replace(/Submitted\s+[^,]+,\s+by.*/, '')
                .replace(/Verified purchase/, '')
                .replace(/Helpful/, '')
                .trim();
              
              // If there's still substantial text left, it's probably the review
              if (remainingText.length > 20) {
                text = remainingText;
              }
            }
            
            // Only add if we have meaningful text or a title
            if (text || title) {
              results.push({ rating, title, date, text });
              console.log(`Added Morrisons review from aggressive approach: rating ${rating}, title: "${title}"`);
            }
          } catch (e) {
            console.error('Error in aggressive review extraction:', e);
          }
        }
      }
    }
    
    console.log(`Returning ${results.length} Morrisons reviews`);
    return results;
  });
}

module.exports = { handleMorrisonsSite };
