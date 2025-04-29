// ASDA specific handler with fixed review extraction
async function handleAsdaSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using ASDA specific handler (NO FALLBACKS)');
  console.log('DEBUGGING: Using fixed ASDA handler with correct selectors');

  // Initialize global array for ASDA reviews if not exists
  if (!global.asdaReviews) {
    global.asdaReviews = [];
  }

  // Clear any existing reviews to avoid duplicates
  global.asdaReviews = [];
  log.info('Cleared existing ASDA reviews array');

  // Debug info
  log.info(`ASDA handler starting for URL: ${page.url()}`);
  log.info(`Max reviews to collect: ${maxReviews}`);

  try {
    // First, handle cookie consent if present
    try {
      const cookieButton = await page.$('button[data-auto-id="onetrust-accept-btn-handler"], #onetrust-accept-btn-handler, button:has-text("Accept all cookies")');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Direct cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Take a screenshot of the initial page
    await page.screenshot({ path: `asda-initial-${Date.now()}.png` });

    // Find and click on the reviews tab
    log.info('Looking for reviews tab');
    const reviewTabSelectors = [
      'button[data-auto-id="tab-1"]',
      'button:has-text("Reviews")',
      'button[aria-label*="Reviews"]',
      'button.asda-tab:has-text("Reviews")',
      '.asda-tab-list button:nth-child(2)'
    ];

    let tabClicked = false;
    for (const selector of reviewTabSelectors) {
      try {
        log.info(`Trying selector: ${selector}`);
        const reviewTab = await page.$(selector);
        if (reviewTab) {
          log.info(`Found review tab with selector: ${selector}`);
          
          // Scroll to the element first
          await reviewTab.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);

          // Try clicking
          await reviewTab.click({ force: true }).catch(async (e) => {
            log.warning(`Direct tab click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), reviewTab);
          });

          log.info(`Clicked review tab with selector: ${selector}`);
          await page.waitForTimeout(3000); // Wait longer for reviews to load
          tabClicked = true;
          break;
        }
      } catch (e) {
        log.warning(`Error clicking tab with selector ${selector}: ${e.message}`);
      }
    }

    // Take a screenshot after clicking the tab
    await page.screenshot({ path: `asda-after-tab-click-${Date.now()}.png` });

    if (!tabClicked) {
      // Try JavaScript approach to find and click the tab
      log.info('Trying JavaScript approach to click reviews tab...');
      const clicked = await page.evaluate(() => {
        // Try to find any tab or button that might be the reviews tab
        const possibleTabs = Array.from(document.querySelectorAll('button[role="tab"], button.asda-tab'));
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
        await page.waitForTimeout(3000);
      } else {
        log.warning('Could not find reviews tab with any method');
      }
    }

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Scroll down to load lazy-loaded content
    await autoScroll(page);
    await page.waitForTimeout(2000);

    // Take a screenshot to help debug
    await page.screenshot({ path: `asda-reviews-page-${Date.now()}.png` });

    // Process multiple pages of reviews if available
    let currentPage = 1;
    let hasMorePages = true;
    let allReviews = [];
    
    while (hasMorePages && allReviews.length < maxReviews && currentPage <= 10) {
      log.info(`Processing ASDA reviews page ${currentPage}`);
      
      // Extract reviews using direct page evaluation with the correct selectors
      log.info('Using direct page evaluation to extract ASDA reviews');
      
      const pageReviews = await page.evaluate(() => {
        console.log('Starting ASDA review extraction with updated selectors');
        const results = [];

        // Find all review containers using the exact class from the provided HTML
        const reviewContainers = document.querySelectorAll('div.pdp-description-reviews__content-cntr');
        console.log(`Found ${reviewContainers.length} ASDA review containers`);

        // Process each review container
        for (const container of reviewContainers) {
          try {
            // Extract rating from the width style attribute
            let rating = '5'; // Default to 5 stars
            const ratingStarsDiv = container.querySelector('div.rating-stars__stars--top[style*="width"]');
            if (ratingStarsDiv) {
              const styleAttr = ratingStarsDiv.getAttribute('style');
              if (styleAttr) {
                const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
                if (widthMatch && widthMatch[1]) {
                  const percentage = parseInt(widthMatch[1]);
                  // Convert percentage to 5-star scale (100% = 5 stars, 20% = 1 star)
                  rating = Math.round(percentage / 20).toString();
                  console.log(`Extracted ASDA rating ${rating} from width percentage: ${percentage}%`);
                }
              }
            }

            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = container.querySelector('span.pdp-description-reviews__rating-title');
            if (titleElement) {
              title = titleElement.textContent.trim();
              console.log(`Extracted title: "${title}"`);
            }

            // Extract date
            let date = 'Unknown date';
            const dateElement = container.querySelector('div.pdp-description-reviews__submitted-date');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date: "${date}"`);
            }

            // Extract review text
            let text = '';
            const textElement = container.querySelector('p.pdp-description-reviews__content-text');
            if (textElement) {
              text = textElement.textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }

            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ rating, title, date, text });
              console.log(`Added ASDA review with rating ${rating}`);
            }
          } catch (e) {
            console.error('Error processing ASDA review container:', e);
          }
        }

        console.log(`Returning ${results.length} ASDA reviews from current page`);
        return results;
      });

      // Add the reviews to our collection
      if (pageReviews && pageReviews.length > 0) {
        allReviews = allReviews.concat(pageReviews);
        log.info(`Added ${pageReviews.length} reviews from page ${currentPage}, total: ${allReviews.length}`);
      } else {
        log.warning(`No reviews found on page ${currentPage}`);
      }

      // Check if there's a next page button and click it
      const nextPageButtonSelectors = [
        'a[data-auto-id="btnright"]',
        'a.co-pagination__arrow--right',
        'a[aria-label*="next page"]'
      ];

      let nextButtonFound = false;
      for (const selector of nextPageButtonSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            const isDisabled = await page.evaluate(button => {
              return button.classList.contains('co-pagination__arrow--disabled') || 
                     button.getAttribute('aria-disabled') === 'true' ||
                     button.hasAttribute('disabled');
            }, nextButton);

            if (isDisabled) {
              log.info('Next page button is disabled, no more pages');
              hasMorePages = false;
              break;
            }

            log.info(`Found next page button with selector: ${selector}, clicking...`);
            await nextButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            
            // Take a screenshot before clicking
            await page.screenshot({ path: `asda-before-next-page-${currentPage}-${Date.now()}.png` });
            
            // Click the next page button
            await nextButton.click({ force: true }).catch(async (e) => {
              log.warning(`Direct next button click failed: ${e.message}, trying JavaScript click...`);
              await page.evaluate(button => button.click(), nextButton);
            });
            
            log.info(`Clicked next page button, going to page ${currentPage + 1}`);
            await page.waitForTimeout(3000); // Wait for the next page to load
            
            // Take a screenshot after clicking
            await page.screenshot({ path: `asda-after-next-page-${currentPage}-${Date.now()}.png` });
            
            currentPage++;
            nextButtonFound = true;
            break;
          }
        } catch (e) {
          log.warning(`Error with next page button selector ${selector}: ${e.message}`);
        }
      }

      // If we couldn't find a next page button, try JavaScript approach
      if (!nextButtonFound && hasMorePages) {
        log.info('Trying JavaScript approach to find and click next page button...');
        const clicked = await page.evaluate(() => {
          // Look for any element that might be the next page button
          const nextButtons = Array.from(document.querySelectorAll('a[data-auto-id="btnright"], a.co-pagination__arrow--right, a[aria-label*="next page"]'));
          for (const button of nextButtons) {
            if (button.classList.contains('co-pagination__arrow--disabled') || 
                button.getAttribute('aria-disabled') === 'true' ||
                button.hasAttribute('disabled')) {
              console.log('Next button is disabled');
              return false;
            }
            console.log('Found next page button via JavaScript, clicking...');
            button.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          log.info('Successfully clicked next page button via JavaScript');
          await page.waitForTimeout(3000);
          currentPage++;
        } else {
          log.info('No next page button found or button is disabled, no more pages');
          hasMorePages = false;
        }
      }

      // If we didn't find a next button at all, stop pagination
      if (!nextButtonFound && !clicked) {
        hasMorePages = false;
      }

      // If we've reached the maximum number of reviews, stop pagination
      if (allReviews.length >= maxReviews) {
        log.info(`Reached maximum number of reviews (${maxReviews}), stopping pagination`);
        hasMorePages = false;
      }
    }

    log.info(`Extracted ${allReviews.length} reviews from ASDA site across ${currentPage} pages`);

    // Log the extracted reviews for debugging
    for (const review of allReviews.slice(0, 5)) {
      log.info(`ASDA Review: Rating=${review.rating}, Title="${review.title}", Date=${review.date}, Text="${review.text.substring(0, 30)}..."`);
    }

    // Add the reviews to the global array
    if (allReviews && allReviews.length > 0) {
      global.asdaReviews = allReviews;
      log.info(`Added ${allReviews.length} reviews to global array`);
    }

    // No fallbacks - only use actual reviews
    if (global.asdaReviews.length === 0) {
      log.warning('No ASDA reviews found. NOT adding fallback reviews.');
    }

  } catch (error) {
    log.error(`Error in ASDA handler: ${error.message}\n${error.stack}`);

    // No fallbacks - only use actual reviews
    if (global.asdaReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.asdaReviews;
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

module.exports = { handleAsdaSite, autoScroll };
