// Morrisons specific handler - optimized but preserving all working functionality
async function handleMorrisonsSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using Morrisons specific handler');
  console.log('DEBUGGING: Using optimized Morrisons handler with fixed star ratings');

  // Initialize global array for Morrisons reviews
  global.morrisonsReviews = [];

  try {
    // Implementation for Morrisons site
    log.info('Morrisons handler implementation');

    // Take a screenshot of the initial page
    console.log('DEBUGGING: Taking initial screenshot');
    await page.screenshot({ path: `morrisons-initial-${Date.now()}.png` });

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

    // Find and click on the reviews tab
    console.log('DEBUGGING: Looking for reviews tab');
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      '[data-test="reviews-tab"]',
      'button[aria-controls="reviews"]'
    ];

    let tabClicked = false;
    for (const selector of reviewTabSelectors) {
      try {
        console.log(`DEBUGGING: Trying selector: ${selector}`);
        const reviewTab = await page.$(selector);
        if (reviewTab) {
          console.log(`DEBUGGING: Found review tab with selector: ${selector}`);
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

    // Take a screenshot after clicking the tab
    console.log('DEBUGGING: Taking screenshot after tab click');
    await page.screenshot({ path: `morrisons-after-tab-click-${Date.now()}.png` });

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Scroll down to load lazy-loaded content
    console.log('DEBUGGING: Scrolling page');
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Extract reviews using direct page evaluation
    log.info('Using direct page evaluation to extract Morrisons reviews');

    // Try to click through pagination to get more reviews
    let pageNum = 1;
    let hasMorePages = true;
    let allReviews = [];

    while (hasMorePages && pageNum <= 10 && allReviews.length < maxReviews) {
      // Take a screenshot before extracting reviews on this page
      console.log(`DEBUGGING: Taking screenshot for page ${pageNum}`);
      await page.screenshot({ path: `morrisons-page-${pageNum}-${Date.now()}.png` });

      // Extract reviews on the current page
      console.log('DEBUGGING: Extracting reviews from current page');
      const pageReviews = await page.evaluate(() => {
        console.log('Starting Morrisons review extraction');
        const results = [];

        // Find all review containers
        const reviewItems = document.querySelectorAll('li[data-test^="review-item-"]');
        console.log(`Found ${reviewItems.length} Morrisons review items`);

        // Process each review container
        for (const item of reviewItems) {
          try {
            // Extract rating by counting the filled stars
            let rating = '5'; // Default to 5 stars
            
            // Method 1: Try to extract from the text "X out of 5"
            const ratingText = item.querySelector('span._text_cn5lb_1._text--m_cn5lb_23, span._text_16wi0_1._text--m_16wi0_23');
            if (ratingText) {
              const ratingMatch = ratingText.textContent.match(/(\\d+)\\s+out\\s+of\\s+5/i);
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
                console.log(`Extracted Morrisons rating: ${rating} stars from text`);
              }
            }
            
            // Method 2: Count the filled stars (SVG elements with data-icon="icon__reviews")
            if (rating === '5') { // Only try this if Method 1 didn't work
              const filledStars = item.querySelectorAll('svg[data-icon="icon__reviews"]');
              if (filledStars && filledStars.length > 0) {
                rating = filledStars.length.toString();
                console.log(`Extracted Morrisons rating: ${rating} stars by counting filled stars`);
              }
            }

            // Extract title
            let title = 'Product Review'; // Default title
            const titleElement = item.querySelector('h4._text_cn5lb_1._text--bold_cn5lb_7._text--m_cn5lb_23, h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23');
            if (titleElement) {
              title = titleElement.textContent.trim();
              // Remove "Rated X out of 5" from the title if present
              title = title.replace(/Rated \\d+ out of \\d+/g, '').trim();
              console.log(`Extracted title: "${title}"`);
            }

            // Extract date
            let date = 'Unknown date';
            const dateElement = item.querySelector('span._text_cn5lb_1._text--s_cn5lb_13, span._text_16wi0_1._text--s_16wi0_13');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date: "${date}"`);
            }

            // Extract review text
            let text = '';
            const textElement = item.querySelector('span._text_cn5lb_1._text--m_cn5lb_23.sc-16m6t4r-0, span._text_16wi0_1._text--m_16wi0_23.sc-16m6t4r-0');
            if (textElement) {
              text = textElement.textContent.trim();
              console.log(`Extracted text: "${text.substring(0, 30)}..."`);
            }

            // Only add if we have meaningful text
            if (text && text.length > 5) {
              results.push({ rating, title, date, text });
              console.log(`Added Morrisons review with rating ${rating}`);
            }
          } catch (e) {
            console.error('Error processing Morrisons review item:', e);
          }
        }

        console.log(`Returning ${results.length} Morrisons reviews from current page`);
        return results;
      });

      // Add the reviews from this page
      if (pageReviews && pageReviews.length > 0) {
        allReviews = allReviews.concat(pageReviews);
        log.info(`Added ${pageReviews.length} reviews from page ${pageNum}, total: ${allReviews.length}`);
      }

      // Try to click the next page button
      hasMorePages = false;
      try {
        console.log('DEBUGGING: Looking for next page button');
        const nextButton = await page.$('[data-test="next-page"], button:has-text("Next"), button:has-text("Show more")');
        if (nextButton) {
          console.log('DEBUGGING: Found next page button');
          const isDisabled = await nextButton.evaluate(btn => btn.disabled || btn.classList.contains('disabled'));
          if (!isDisabled) {
            await nextButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            await nextButton.click({ force: true }).catch(async (e) => {
              log.warning(`Direct next button click failed: ${e.message}, trying JavaScript click...`);
              hasMorePages = await page.evaluate(button => {
                if (!button.disabled && !button.classList.contains('disabled')) {
                  button.click();
                  return true;
                }
                return false;
              }, nextButton);
            });
            if (!isDisabled) {
              hasMorePages = true;
              pageNum++;
              log.info(`Clicked next page button, now on page ${pageNum}`);
              await page.waitForTimeout(2000); // Wait for new reviews to load
            }
          } else {
            log.info('Next page button is disabled, no more pages');
          }
        } else {
          log.info('No next page button found, reached the end of reviews');
        }
      } catch (e) {
        log.warning(`Error clicking next page button: ${e.message}`);
      }

      // Break if we've collected enough reviews
      if (allReviews.length >= maxReviews) {
        log.info(`Reached maximum number of reviews (${maxReviews}), stopping pagination`);
        break;
      }
    }

    // Add the reviews to the global array
    if (allReviews && allReviews.length > 0) {
      global.morrisonsReviews = allReviews;
      log.info(`Added ${allReviews.length} reviews to global Morrisons reviews array`);
    }

    // No fallbacks - only use actual reviews
    if (global.morrisonsReviews.length === 0) {
      log.warning('No Morrisons reviews found. NOT adding fallback reviews.');
    }
  } catch (error) {
    log.error(`Error in Morrisons handler: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in Morrisons handler:', error);

    // No fallbacks - only use actual reviews
    if (global.morrisonsReviews.length === 0) {
      log.warning('Error occurred and no reviews were found. NOT adding fallback reviews.');
    }
  }

  return global.morrisonsReviews;
}
