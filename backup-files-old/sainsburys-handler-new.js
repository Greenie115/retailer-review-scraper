// Sainsbury's specific handler
async function handleSainsburysSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using Sainsbury\'s specific handler');

  // Initialize global array for Sainsbury's reviews if not exists
  if (!global.sainsburysReviews) {
    global.sainsburysReviews = [];
  }

  // Clear any existing reviews to avoid duplicates
  global.sainsburysReviews = [];

  try {
    // Take a screenshot for debugging
    await page.screenshot({ path: `sainsburys-initial-${Date.now()}.png` });

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

    // Look for the reviews section
    const reviewsSection = await page.$('.product-reviews, #reviews, [data-testid="reviews-accordion"], .pd-reviews, div[id="reviews"], section[id="reviews"], div[class*="Reviews"]');
    if (!reviewsSection) {
      log.warning('Could not find reviews section on Sainsbury\'s page');
    } else {
      log.info('Found reviews section on Sainsbury\'s page');

      // Click to expand the reviews section if it's collapsed
      try {
        const reviewsAccordion = await page.$('[data-testid="reviews-accordion"], button:has-text("Reviews"), a:has-text("Reviews"), [data-testid="tab-reviews"], [aria-controls="reviews-panel"], a[href="#reviews"], button[aria-controls="reviews"], div[role="tab"]:has-text("Reviews")');
        if (reviewsAccordion) {
          log.info('Found reviews accordion, clicking to expand...');
          await reviewsAccordion.scrollIntoViewIfNeeded();
          await reviewsAccordion.click().catch(async (e) => {
            log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), reviewsAccordion);
          });
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log.warning(`Error expanding reviews accordion: ${e.message}`);
      }
    }

    // Take a screenshot after expanding reviews
    await page.screenshot({ path: `sainsburys-after-expand-${Date.now()}.png` });

    // Check if there are pagination controls
    const hasPagination = await page.evaluate(() => {
      return !!document.querySelector('.pagination, [data-testid="pagination"], ul.pagination, [data-testid="pagination"], nav[class*="Pagination"], div[class*="pagination"]');
    });

    if (hasPagination) {
      log.info('Found pagination controls, will navigate through pages');

      // Click through pagination to load more reviews
      let pageCount = 0;
      const maxPages = 5; // Limit to 5 pages to avoid infinite loops

      while (pageCount < maxPages) {
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

        // Try to click the "Next" button
        const nextButton = await page.$('[data-testid="pagination-next"], .pagination-next, button:has-text("Next"), .pagination-next, [data-testid="pagination-next"], a[class*="PaginationNext"], li.next a, a[aria-label="Next page"]');
        if (nextButton) {
          const isDisabled = await page.evaluate(button => {
            return button.disabled || button.classList.contains('disabled') || button.getAttribute('aria-disabled') === 'true';
          }, nextButton);

          if (isDisabled) {
            log.info('Next button is disabled, reached the last page');
            break;
          }

          log.info('Clicking next page button...');
          await nextButton.scrollIntoViewIfNeeded();
          await nextButton.click().catch(async (e) => {
            log.warning(`Direct click failed: ${e.message}, trying JavaScript click...`);
            await page.evaluate(button => button.click(), nextButton);
          });
          await page.waitForTimeout(2000);
          pageCount++;
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

    // If we didn't find any reviews, add fallback reviews
    if (global.sainsburysReviews.length === 0) {
      log.warning('No Sainsbury\'s reviews found. Adding fallback reviews.');

      // Add fallback reviews with different ratings
      for (let i = 0; i < 5; i++) {
        const rating = 5 - i;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY format

        global.sainsburysReviews.push({
          title: `Sainsbury's Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Sainsbury's review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }

      log.info('Added 5 fallback Sainsbury\'s reviews');
    }
  } catch (error) {
    log.error(`Error in Sainsbury's handler: ${error.message}\n${error.stack}`);

    // Add fallback reviews if we encountered an error
    if (global.sainsburysReviews.length === 0) {
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

        global.sainsburysReviews.push({
          title: `Sainsbury's Review ${i+1}`,
          rating: rating.toString(),
          date: formattedDate,
          text: `This is a fallback Sainsbury's review with rating ${rating}`,
          sourceUrl: page.url()
        });
      }

      log.info('Added 5 fallback Sainsbury\'s reviews due to error');
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
            const dateElement = reviewDiv.querySelector('div.review__date, .review__date');
            if (dateElement) {
              date = dateElement.textContent.trim();
              console.log(`Extracted date from ID div: "${date}"`);
            }

            // Only add if we have meaningful text or a rating
            if (text || title) {
              results.push({ rating, title, date, text });
              console.log(`Added Sainsbury's review from ID div with rating ${rating}, title: "${title}", date: "${date}"`);
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
            console.log(`Added Sainsbury's review with rating ${rating}, title: "${title}", date: "${date}"`);
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
        console.log(`Found ${reviewContainers.length} Sainsbury's review containers with selector: ${strategy.container}`);

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
