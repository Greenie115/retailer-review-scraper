// ASDA specific handler with no fallbacks
async function handleAsdaSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using ASDA specific handler');

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

    // Find and click on the reviews tab
    const reviewTabSelectors = [
      'button:has-text("Reviews")',
      'a:has-text("Reviews")',
      'button[data-auto-id="reviews-tab"]',
      '[data-auto-id="reviews-tab"]',
      'button[aria-controls="reviews"]'
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
        const possibleTabs = Array.from(document.querySelectorAll('button[role="tab"], a[role="tab"]'));
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

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Scroll down to load lazy-loaded content
    await autoScroll(page);
    await page.waitForTimeout(1000);

    // Extract reviews using direct page evaluation
    log.info('Using direct page evaluation to extract ASDA reviews');

    // Take a screenshot to help debug
    await page.screenshot({ path: `asda-reviews-page-${Date.now()}.png` });

    // Custom ASDA review extraction based on the exact HTML structure
    const reviews = await page.evaluate(() => {
      console.log('Starting ASDA review extraction with custom selectors');
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
            const widthMatch = styleAttr.match(/width:\s*(\d+)%/);
            if (widthMatch && widthMatch[1]) {
              const percentage = parseInt(widthMatch[1]);
              // Convert percentage to 5-star scale (100% = 5 stars, 20% = 1 star)
              rating = Math.round(percentage / 20).toString();
              console.log(`Extracted ASDA rating ${rating} from width percentage: ${percentage}%`);
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

      console.log(`Returning ${results.length} ASDA reviews`);
      return results;
    });

    log.info(`Extracted ${reviews.length} reviews from ASDA site`);

    // Log the extracted reviews for debugging
    for (const review of reviews) {
      log.info(`ASDA Review: Rating=${review.rating}, Title="${review.title}", Date=${review.date}, Text="${review.text.substring(0, 30)}..."`);
    }

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.asdaReviews.push(...reviews);
      log.info(`Added ${reviews.length} reviews to global array, total: ${global.asdaReviews.length}`);
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

module.exports = { handleAsdaSite };
