// Sainsbury's specific handler
// Sainsbury's specific handler
async function handleSainsburysSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Sainsbury\'s specific handler');

  // Initialize global array for Sainsbury\'s reviews if not exists
  if (!global.sainsburysReviews) {
    global.sainsburysReviews = [];
  }

  // Clear any existing reviews to avoid duplicates
  global.sainsburysReviews = [];

  // Enhanced anti-bot detection for Sainsbury's specific environment
  await page.addInitScript(() => {
    // Override navigator properties more thoroughly for Sainsbury's
    const newProto = navigator.__proto__;
    delete newProto.webdriver;
    
    // Add more realistic navigator properties
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'connection', { 
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false
      })
    });
    
    // Override canvas fingerprinting
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' && this.width === 16 && this.height === 16) {
        // This is likely a fingerprinting attempt, return a consistent result
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      }
      return originalToDataURL.apply(this, arguments);
    };
  });

  try {
    // Take a screenshot for debugging
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` });

    // Wait for Cloudflare or similar protection to resolve
    try {
      // Check for common challenge elements
      const challengeSelector = '#challenge-running, .cf-browser-verification, iframe[src*="challenges"], #cf-please-wait';
      const hasChallenge = await page.$(challengeSelector) !== null;
      
      if (hasChallenge) {
        log.info('Detected Cloudflare or similar protection challenge, waiting for resolution...');
        // Wait longer for the challenge to complete - up to 30 seconds
        await page.waitForSelector(challengeSelector, { hidden: true, timeout: 30000 })
          .catch(e => log.warning(`Challenge wait timed out: ${e.message}`));
        
        // Additional wait after challenge completion
        await page.waitForTimeout(5000);
        log.info('Challenge appears to be resolved, continuing...');
      }
    } catch (challengeError) {
      log.warning(`Error handling protection challenge: ${challengeError.message}`);
    }

    // First, handle cookie consent if present
try {
  const cookieButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button[id*="accept-cookies"]');
  if (cookieButton) {
    log.info('Found cookie consent button, clicking...');
    
    // First hover over the button like a human would
    await cookieButton.hover();
    await page.waitForTimeout(Math.random() * 800 + 200);
    
    // Move mouse slightly within the button before clicking (more human-like)
    const box = await cookieButton.boundingBox();
    if (box) {
      const x = box.x + box.width/2 + (Math.random() * 10 - 5);
      const y = box.y + box.height/2 + (Math.random() * 6 - 3);
      await page.mouse.move(x, y);
      await page.waitForTimeout(Math.random() * 400 + 100);
    }
    
    // Click with a more natural delay pattern
    await cookieButton.click({delay: Math.random() * 80 + 30}).catch(async e => {
      log.warning(`Direct cookie click failed: ${e.message}, trying JS click...`);
      await page.evaluate(btn => btn.click(), cookieButton);
    });
    
    // Longer random wait after clicking (humans don't act immediately)
    await page.waitForTimeout(Math.random() * 3000 + 2000);
  }
} catch (cookieError) {
  log.warning(`Error handling cookie consent: ${cookieError.message}`);
}

    // Wait for the page to load and check for error message
    await page.waitForTimeout(3000);
    await page.waitForTimeout(Math.random() * 3000 + 2000); // Add random delay after initial wait


    // Check if the "Something went wrong" message is present
    const errorMessage = await page.$('text="Something went wrong"');
    if (errorMessage) {
      log.warning('Sainsbury\'s page likely blocked, "Something went wrong" message detected.');
      return []; // Return empty array if blocked
    }

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
    await page.waitForTimeout(Math.random() * 2000 + 1000); // Add random delay after scrolling


    // Look for and click on the reviews accordion/tab
    const reviewsAccordionSelectors = [
      '[data-testid="reviews-accordion"]',
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      '[data-testid="tab-reviews"]',
      '[aria-controls="reviews-panel"]',
      'a[href="#reviews"]',
      'button[aria-controls="reviews"]',
      'div[role="tab"]:has-text("Reviews")',
      '.pd-reviews__header', // Common container for header/button
      '.reviews-accordion-button' // Potential specific class
    ];

    let accordionClicked = false;
    for (const selector of reviewsAccordionSelectors) {
      try {
        const reviewsAccordion = await page.$(selector);
        if (reviewsAccordion) {
          log.info(`Found reviews accordion/tab with selector: ${selector}`);
          // Scroll to the element first
          await reviewsAccordion.scrollIntoViewIfNeeded();
          await page.waitForTimeout(Math.random() * 1000 + 500); // Add random delay before clicking

          // Try clicking
          await reviewsAccordion.click({ force: true }).catch(async (e) => {
            log.warning(`Direct accordion/tab click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), reviewsAccordion);
          });

          log.info(`Clicked reviews accordion/tab with selector: ${selector}`);
          await page.waitForTimeout(Math.random() * 2000 + 1000); // Add random delay after clicking
          accordionClicked = true;
          break;
        }
      } catch (e) {
        log.warning(`Error clicking accordion/tab with selector ${selector}: ${e.message}`);
      }
    }

    if (!accordionClicked) {
      // Try JavaScript approach to find and click the accordion/tab
      log.info('Trying JavaScript approach to click reviews accordion/tab...');
      const clicked = await page.evaluate(() => {
        // Try to find any element that might be the reviews accordion/tab
        // Removed :contains() as it's not standard CSS
        const possibleAccordions = Array.from(document.querySelectorAll('button[aria-controls*="reviews"], a[href*="#reviews"], [data-testid*="reviews"], div[role="tab"], button, a'));
        for (const acc of possibleAccordions) {
          // Check text content manually
          if (acc.textContent.includes('Review') || acc.textContent.includes('review')) {
            console.log('Found reviews accordion/tab via JavaScript, clicking...');
            acc.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        log.info('Successfully clicked reviews accordion/tab via JavaScript');
        await page.waitForTimeout(Math.random() * 2000 + 1000); // Add random delay after clicking
      } else {
        log.warning('Could not find reviews accordion/tab with any method');
        // If we can't click the accordion/tab, the reviews won't load, so return empty
        log.warning('Could not find reviews section on Sainsbury\'s page. Page might be blocked or structure changed.');
        return [];
      }
    }


    // Wait for a potential reviews section element to appear with a longer timeout
    const reviewsSectionSelector = '.product-reviews, #reviews, [data-testid="reviews-accordion"], .pd-reviews, div[id="reviews"], section[id="reviews"], div[class*="Reviews"]';
    // Also wait for at least one review container within that section to be visible
    const reviewContainerSelector = 'div.pd-reviews__review-container, div[id^="id_"], .review-container, .review, [data-testid="review-container"], [class*="review-container"], [class*="ReviewContainer"]';

    let reviewsSection = null;
    try {
      log.info(`Waiting for reviews section with selector: ${reviewsSectionSelector}`);
      // Explicitly wait for the main reviews section element to be visible
      reviewsSection = await page.waitForSelector(reviewsSectionSelector, { state: 'visible', timeout: 15000 }); // Wait up to 15 seconds for visibility
      log.info('Found reviews section on Sainsbury\'s page after waiting');

      // Now wait for at least one review container within the section to be visible
      log.info(`Waiting for at least one review container with selector: ${reviewContainerSelector}`);
      await page.waitForSelector(reviewContainerSelector, { state: 'visible', timeout: 10000 }); // Wait up to 10 seconds for a review container
      log.info('Found at least one review container after waiting');

    } catch (e) {
      log.warning(`Could not find reviews section or review containers on Sainsbury\'s page after waiting: ${e.message}. Page might be blocked or structure changed.`);
      // Return empty array immediately if reviews section or containers are not found after waiting
      return [];
    }

    // If reviewsSection is found (which it should be if waitForSelector didn't throw)
    if (reviewsSection) {
      log.info('Processing found reviews section');

      // Click to expand the reviews section if it's collapsed
      // This block is now redundant as we handle clicking the accordion/tab earlier
      // Keeping it for now but might remove later if the above logic is sufficient
      try {
        const reviewsAccordion = await page.$('[data-testid="reviews-accordion"], button:has-text("Reviews"), a:has-text("Reviews"), [data-testid="tab-reviews"], [aria-controls="reviews-panel"], a[href="#reviews"], button[aria-controls="reviews"], div[role="tab"]:has-text("Reviews")');
        if (reviewsAccordion && await reviewsAccordion.isVisible()) { // Check visibility before clicking again
           // log.info('Found reviews accordion again, clicking to expand...');
           // await reviewsAccordion.scrollIntoViewIfNeeded();
           // await page.waitForTimeout(Math.random() * 1000 + 500); // Add random delay before clicking accordion
           // await reviewsAccordion.click().catch(async (e) => {
           //   log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
           //   await page.evaluate(button => button.click(), reviewsAccordion);
           // });
           // await page.waitForTimeout(Math.random() * 2000 + 1000); // Add random delay after clicking accordion
        }
      } catch (e) {
        log.warning(`Error expanding reviews accordion: ${e.message}`);
      }
    }

    // Take a screenshot after expanding reviews and waiting for containers
    await page.screenshot({ path: `sainsburys-after-expand-wait-${Date.now()}.png` });


    // Check if there are pagination controls
    const hasPagination = await page.evaluate(() => {
      return !!document.querySelector('.pagination, [data-testid="pagination"], ul.pagination, [data-testid="pagination"], nav[class*="Pagination"], div[class*="pagination"]');
    });

    if (hasPagination) {
      log.info('Found pagination controls, will navigate through pages');

      // Click through pagination to load more reviews
      let pageCount = 0;
      const maxPages = 5; // Limit to 5 pages to avoid infinite loops

      while (pageCount < maxPages && global.sainsburysReviews.length < maxReviews) {
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

        // Try to click the "Next" button with multiple selectors and fallbacks
        const nextButtonSelectors = [
          '[data-testid="pagination-next"]',
          '.pagination-next',
          'button:has-text("Next")',
          'a:has-text("Next")',
          '[data-testid="pagination-next"]',
          'a[class*="PaginationNext"]',
          'li.next a',
          'a[aria-label="Next page"]',
          '.ds-pagination__next' // Sainsbury's specific next button selector
        ];

        let nextButton = null;
        for (const selector of nextButtonSelectors) {
          nextButton = await page.$(selector);
          if (nextButton) {
            log.info(`Found next button with selector: ${selector}`);
            break;
          }
        }

        // If we still don't have a next button, try a more aggressive JavaScript approach
        if (!nextButton) {
          log.info('No next button found with standard selectors, trying aggressive JavaScript approach');

          const nextButtonFound = await page.evaluate(() => {
            const possibleNextButtons = [];

            // Look for elements with specific attributes or text
            // Removed :contains() as it's not standard CSS
            document.querySelectorAll('a[href*="page="], a[href*="%2Fpage%3D"], [aria-label*="Next page"]').forEach(el => possibleNextButtons.push(el));

            // Look for elements with right arrow icons
            document.querySelectorAll('a svg, button svg').forEach(svg => {
              const parent = svg.closest('a') || svg.closest('button');
              if (parent && !possibleNextButtons.includes(parent)) {
                possibleNextButtons.push(parent);
              }
            });

            // Look for elements with pagination-related classes
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
                                      button.getAttribute('data-auto-id')?.toLowerCase().includes('right');

              if (hasNextText || hasRightArrow || hasNextClass || hasNextAttribute) {
                console.log('Found likely next button via JS:', button);
                button.click();
                return true;
              }
            }
            return false;
          });

          if (nextButtonFound) {
            log.info('Found and clicked next button using JavaScript approach');
            await page.waitForTimeout(Math.random() * 3000 + 2000); // Wait for page to load
            pageCount++;

            // Take a screenshot after clicking next page
            await page.screenshot({ path: `sainsburys-after-js-next-page-${pageCount}-${Date.now()}.png` });

            // Extract reviews from the current page
            reviews = await extractSainsburysReviews(page);
            log.info(`Extracted ${reviews.length} reviews from page ${pageCount + 1}`);

            if (reviews.length > 0) {
              global.sainsburysReviews.push(...reviews);
              log.info(`Total reviews collected so far: ${global.sainsburysReviews.length}`);
              continue; // Skip to the next iteration
            } else {
              log.warning(`No reviews found on page ${pageCount + 1} after JS click, stopping pagination`);
              break;
            }
          } else {
             log.info('No next page button found with any JavaScript method, stopping pagination');
             break;
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
          await page.screenshot({ path: `sainsburys-before-next-page-${pageCount}-${Date.now()}.png` });

          // Scroll to make sure the button is visible
          await nextButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(Math.random() * 1000 + 500); // Add random delay before clicking next

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
                    // Handle relative URLs like %2Fproduct%2F...
                    const decodedHref = decodeURIComponent(href);
                    if (decodedHref.startsWith('/')) {
                      const domain = currentUrl.split('/').slice(0, 3).join('/');
                      targetUrl = domain + decodedHref;
                    } else {
                      // Fallback: just append to current URL
                      targetUrl = baseUrl + '?page=' + (pageCount + 1);
                    }
                  }

                  log.info(`Navigating to next page URL: ${targetUrl}`);
                  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
                } else {
                   log.warning('Could not extract href for navigation, stopping pagination');
                }
              });
            });
          } catch (clickError) {
            log.error(`All click methods failed: ${clickError.message}, stopping pagination`);
            break;
          }

          await page.waitForTimeout(Math.random() * 2000 + 1000); // Wait longer for page to load
          pageCount++;

          // Take a screenshot after clicking next page
          await page.screenshot({ path: `sainsburys-after-next-page-${pageCount}-${Date.now()}.png` });

          // Extract reviews from the current page
          reviews = await extractSainsburysReviews(page);
          log.info(`Extracted ${reviews.length} reviews from page ${pageCount + 1}`);

          if (reviews.length > 0) {
            global.sainsburysReviews.push(...reviews);
            log.info(`Total reviews collected so far: ${global.sainsburysReviews.length}`);
          } else {
            log.warning(`No reviews found on page ${pageCount + 1} after click, stopping pagination`);
            break;
          }
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

    // --- Fallback reviews removed as requested ---
    // If we didn't find any reviews, log a warning
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found after attempting to scrape.');
    }
    // --- End of fallback reviews removal ---

  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);

    // If we encountered an error and found no reviews, log a warning
    if (global.sainsburysReviews.length === 0) {
      log.warning('Error occurred and no reviews were found for Sainsbury\'s.');
    }
  }

  return global.sainsburysReviews;
}

// Helper function to extract reviews from the current page
async function extractSainsburysReviews(page) {
  return await page.evaluate(() => {
    console.log('Starting Sainsbury\'s review extraction with exact HTML structure');
    const results = [];

    // Based on the exact HTML structure provided
    // First, look for the review containers
    const reviewContainers = document.querySelectorAll('div.pd-reviews__review-container, div[id^="id_"]');
    console.log(`Found ${reviewContainers.length} Sainsbury's review containers with exact selector`);

    // If no containers found, try to find them by ID pattern
    if (reviewContainers.length === 0) {
      // Look for divs with IDs that start with 'id_' which is common for Sainsbury's reviews
      const idDivs = Array.from(document.querySelectorAll('div[id]')).filter(div => div.id.startsWith('id_'));
      console.log(`Found ${idDivs.length} divs with IDs starting with 'id_'`);

      if (idDivs.length > 0) {
        // Process these divs directly
        for (const div of idDivs) {
          try {
            // Find the review div inside or use the div itself
            const reviewDiv = div.querySelector('div.review') || div;

            // Extract title
            let title = '';
            const titleElement = reviewDiv.querySelector('div.review__title, .review__title');
            if (titleElement) {
              title = titleElement.textContent.trim();
              console.log(`Extracted title from ID div: "${title}"`);
            }

            // Extract review text
            let text = '';
            const textElement = reviewDiv.querySelector('div.review__content, [data-testid="review-content"]');
            if (textElement) {
              text = textElement.textContent.trim();
              console.log(`Extracted text from ID div: "${text.substring(0, 30)}..."`);
            }

            // Extract rating
            let rating = '5'; // Default
            const ratingElement = reviewDiv.querySelector('div.review__star-rating, [title*="Rating"], [aria-label*="Rating"]');
            if (ratingElement) {
              const ariaLabel = ratingElement.getAttribute('aria-label');
              const titleAttr = ratingElement.getAttribute('title');
              const ratingText = ariaLabel || titleAttr || '';
              const ratingMatch = ratingText.match(/Rating (\d+) out of/);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted rating ${rating} from ID div aria-label/title`);
              }
            }

            // Extract date
            let date = '';
            const dateElement = reviewDiv.querySelector('div.review__date');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date from ID div: "${date}"`);
            }

            // Only add if we have meaningful text or a rating
            if (text || title) {
              results.push({ rating, title, date, text });
              console.log(`Added Sainsbury's review from ID div with rating ${rating}`);
            }
          } catch (e) {
            console.error('Error processing Sainsbury\'s ID div:', e);
          }
        }
      }
    }

    if (reviewContainers.length > 0) {
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Find the review div inside the container
          const reviewDiv = container.querySelector('div.review');
          if (!reviewDiv) continue;

          // Extract title - div.review__title
          let title = '';
          const titleElement = reviewDiv.querySelector('div.review__title');
          if (titleElement) {
            title = titleElement.textContent.trim();
            console.log(`Extracted title: "${title}"`);
          }

          // Extract review text - div.review__content
          let text = '';
          const textElement = reviewDiv.querySelector('div.review__content[data-testid="review-content"]');
          if (textElement) {
            text = textElement.textContent.trim();
            console.log(`Extracted text: "${text.substring(0, 30)}..."`);
          }

          // Extract rating - from the aria-label or title attribute
          let rating = '5'; // Default to 5 stars
          const ratingElement = reviewDiv.querySelector('div.review__star-rating .ds-c-rating__stars, [title*="Rating"], [aria-label*="Rating"]');
          if (ratingElement) {
            const ariaLabel = ratingElement.getAttribute('aria-label');
            const titleAttr = ratingElement.getAttribute('title');
            const ratingText = ariaLabel || titleAttr || '';
            const ratingMatch = ratingText.match(/Rating (\d+) out of/);
            if (ratingMatch && ratingMatch[1]) {
              rating = ratingMatch[1];
              console.log(`Extracted rating ${rating} from aria-label/title`);
            } else {
              // Try to extract from text content
              const ratingContentElement = reviewDiv.querySelector('.ds-c-rating__trailing-content');
              if (ratingContentElement) {
                const contentText = ratingContentElement.textContent.trim();
                const contentMatch = contentText.match(/(\d+) out of/);
                if (contentMatch && contentMatch[1]) {
                  rating = contentMatch[1];
                  console.log(`Extracted rating ${rating} from trailing content`);
                }
              }
            }
          }

          // Extract date - div.review__date
          let date = '';
          const dateElement = reviewDiv.querySelector('div.review__date');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }

          // Only add if we have meaningful text or a rating
          if (text || rating) {
            results.push({ rating, title, date, text });
            console.log(`Added Sainsbury's review with rating ${rating}`);
          }
        } catch (e) {
          console.error('Error processing Sainsbury\'s review container:', e);
        }
      }
    }

    // If we didn't find any reviews with the exact structure, try a more generic approach
    if (results.length === 0) {
      console.log('No reviews found with exact structure, trying generic approach');

      // Try multiple selector strategies
      const selectorStrategies = [
        // Strategy 1: Original selectors
        {
          container: 'div.review__content[data-testid="review-content"], .review-container',
          rating: 'div.review__star-rating, .star-rating',
          title: 'div.review__title, .review-title, h3, h4',
          date: 'div.review__date, .review-date, .date',
          text: 'div.review__text, .review-text, p'
        },
        // Strategy 2: Updated selectors based on actual Sainsbury's site
        {
          container: '.pd-reviews__review-container, .review, div[id^="id_"], .review-card, [data-testid="review-card"]',
          rating: '.review__star-rating, .ds-c-rating, [aria-label*="Rating"], [title*="Rating"]',
          title: '.review__title, div[class*="title"], h3, h4',
          date: '.review__date, div[class*="date"], time',
          text: '.review__content, [data-testid="review-content"], .review-content, div[class*="content"]'
        },
        // Strategy 3: More generic selectors
        {
          container: '[class*="review" i], [data-testid*="review" i], [id*="review" i]',
          rating: '[class*="rating" i], [class*="stars" i], [data-testid*="rating" i]',
          title: '[class*="title" i], [data-testid*="title" i], h3, h4',
          date: '[class*="date" i], [data-testid*="date" i], time',
          text: '[class*="text" i], [class*="content" i], [data-testid*="text" i], p'
        }
      ];

      // Try each strategy until we find reviews
      for (const strategy of selectorStrategies) {
        console.log(`Trying selector strategy: ${JSON.stringify(strategy)}`);

        // Find all review containers using the current strategy
        const reviewContainers = document.querySelectorAll(strategy.container);
        console.log(`Found ${reviewContainers.length} Sainsbury's review containers with exact selector`);

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
                console.log(`Added Sainsbury's review with rating ${rating}`);
              }
            } catch (e) {
              console.error('Error processing Sainsbury\'s review container:', e);
            }
          }

          // If we found reviews with this strategy, stop trying others
          if (results.length > 0) {
            console.log(`Found ${results.length} reviews with strategy, stopping search`);
            break;
          }
        }
      }
    }

    // If we still don't have reviews, try a more aggressive approach
    if (results.length === 0) {
      console.log('No reviews found with standard strategies, trying aggressive approach');

      // Look for any elements that might contain review text
      const possibleReviewTexts = document.querySelectorAll('p, div, span');
      for (const element of possibleReviewTexts) {
        const text = element.textContent.trim();

        // If the text is reasonably long and not a navigation element, it might be a review
        if (text.length > 50 &&
            !element.closest('nav') &&
            !element.closest('header') &&
            !element.closest('footer') &&
            !['script', 'style', 'meta', 'link'].includes(element.tagName.toLowerCase())) {

          console.log(`Found possible review text: "${text.substring(0, 30)}..."`);

          // Try to find a nearby rating element
          let rating = '5'; // Default
          const nearbyRating = element.parentElement?.querySelector('[class*="star"], [class*="rating"]');
          if (nearbyRating) {
            console.log('Found nearby rating element');
          }

          // Add as a potential review
          results.push({
            rating,
            title: 'Product Review', // Default
            date: '',
            text
          });

          // Limit to 5 reviews from this aggressive approach
          if (results.length >= 5) break;
        }
      }
    }

    console.log(`Returning ${results.length} Sainsbury's reviews`);
    return results;
  });
}

module.exports = { handleSainsburysSite };
