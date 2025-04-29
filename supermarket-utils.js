/**
 * Utility functions for supermarket review extraction
 * Shared functionality for Sainsbury's, ASDA, Morrisons, and Tesco
 */

// Helper function to find and click the reviews tab/section
async function findAndClickReviewsTab(page, selectors) {
  const log = console; // Use the same logging interface as the main script
  
  // Try multiple approaches to find and click the reviews tab
  let reviewsTabClicked = false;
  
  // Approach 1: Try clicking the reviews tab using provided selector
  try {
    const reviewsTab = await page.waitForSelector(selectors.reviewsTabSelector, { timeout: 5000 }).catch(() => null);
    
    if (reviewsTab) {
      log.info('Found reviews tab, clicking...');
      await reviewsTab.scrollIntoViewIfNeeded();
      await page.waitForTimeout(Math.random() * 500 + 300);
      await reviewsTab.click();
      await page.waitForTimeout(Math.random() * 2000 + 1000);
      reviewsTabClicked = true;
    } else {
      log.info('No reviews tab found with standard selectors');
    }
  } catch (e) {
    log.warning(`Error clicking reviews tab: ${e.message}`);
  }
  
  // Approach 2: Try clicking any element that might be a reviews tab
  if (!reviewsTabClicked) {
    try {
      // Look for any element containing the text "Reviews" or "Customer Reviews"
      const possibleTabs = [
        'text="Reviews"',
        'text="Customer Reviews"',
        'text="Product Reviews"',
        'text="Ratings & Reviews"',
        '[aria-label*="reviews" i]',
        '[data-test*="review" i]',
        'a[href*="review" i]',
        'button:has-text("review" i)'
      ];
      
      for (const selector of possibleTabs) {
        const element = await page.$(selector).catch(() => null);
        if (element) {
          log.info(`Found possible reviews element with selector: ${selector}`);
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(Math.random() * 500 + 300);
          await element.click();
          await page.waitForTimeout(Math.random() * 2000 + 1000);
          reviewsTabClicked = true;
          break;
        }
      }
    } catch (e) {
      log.warning(`Error with alternative review tab approach: ${e.message}`);
    }
  }
  
  // Approach 3: Try scrolling to the reviews section
  try {
    // Scroll to the reviews section if it exists
    const reviewsSection = await page.$(selectors.reviewsSection).catch(() => null);
    if (reviewsSection) {
      log.info('Found reviews section, scrolling to it');
      await reviewsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(Math.random() * 1000 + 500);
    }
  } catch (e) {
    log.warning(`Error scrolling to reviews section: ${e.message}`);
  }
  
  return reviewsTabClicked;
}

// Helper function to handle pagination for supermarket sites
async function handleSupermarketPagination(page, siteConfig, currentPage, extractReviewsFn) {
  const log = console; // Use the same logging interface as the main script
  let nextPageLink = null;
  const nextPageNumber = currentPage + 1;
  
  // Strategy 1: Look for specific next page button
  try {
    nextPageLink = await page.$(siteConfig.nextPageSelector).catch(() => null);
    if (nextPageLink) {
      log.info('Found next page button using nextPageSelector');
    }
  } catch (e) {
    log.warning(`Error finding next page button: ${e.message}`);
  }
  
  // Strategy 2: Look for page number
  if (!nextPageLink) {
    try {
      // Try multiple selector variations for page numbers
      const pageNumberSelectors = [
        `${siteConfig.pageNumberSelector}:has-text("${nextPageNumber}")`,
        `a:has-text("${nextPageNumber}")`,
        `[aria-label="Page ${nextPageNumber}"]`,
        `[data-page="${nextPageNumber}"]`,
        `li:has-text("${nextPageNumber}") a`
      ];
      
      for (const selector of pageNumberSelectors) {
        nextPageLink = await page.$(selector).catch(() => null);
        if (nextPageLink) {
          log.info(`Found page ${nextPageNumber} link using selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      log.warning(`Error finding page number link: ${e.message}`);
    }
  }
  
  // Strategy 3: Try to find any unselected page link
  if (!nextPageLink) {
    try {
      log.info('Trying to find any unselected page link...');
      const pageLinks = await page.$$(siteConfig.pageNumberSelector);
      log.info(`Found ${pageLinks.length} potential page links`);
      
      for (const link of pageLinks) {
        try {
          // Get the text of the link to see if it's a higher page number
          const linkText = await link.textContent();
          const linkNumber = parseInt(linkText.trim());
          
          // Check if this is a higher page number than our current page
          if (!isNaN(linkNumber) && linkNumber > currentPage) {
            // Check if it's not selected
            const isSelected = await link.evaluate(el => {
              return el.classList.contains('active') ||
                     el.classList.contains('selected') ||
                     el.getAttribute('aria-current') === 'true' ||
                     el.getAttribute('aria-selected') === 'true';
            }).catch(() => false);
            
            if (!isSelected) {
              nextPageLink = link;
              log.info(`Found unselected page link to page ${linkNumber}`);
              break;
            }
          }
        } catch (e) {
          log.warning(`Error checking page link: ${e.message}`);
          continue;
        }
      }
    } catch (e) {
      log.warning(`Error in strategy 3: ${e.message}`);
    }
  }
  
  // Strategy 4: Look for any element that might be a next page link
  if (!nextPageLink) {
    try {
      log.info('Trying to find any element that might be a next page link...');
      // Look for elements that might be next page links
      const possibleNextLinks = [
        'text="Next"',
        'text="Next Page"',
        'text=">"',
        '[aria-label="Next"]',
        'button:has-text("Next")',
        'a:has-text("Next")',
        'a.next',
        'li.next a',
        '[class*="next"]'
      ];
      
      for (const selector of possibleNextLinks) {
        nextPageLink = await page.$(selector).catch(() => null);
        if (nextPageLink) {
          log.info(`Found next page link using selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      log.warning(`Error in strategy 4: ${e.message}`);
    }
  }
  
  if (!nextPageLink) {
    log.info(`No more page links found after page ${currentPage}`);
    return { success: false, nextPageNumber: currentPage };
  }
  
  // Click the next page link
  log.info(`Navigating to page ${nextPageNumber}...`);
  await nextPageLink.scrollIntoViewIfNeeded();
  await page.waitForTimeout(Math.random() * 500 + 300);
  
  try {
    // Try JavaScript click first (more reliable for some sites)
    try {
      await page.evaluate(el => el.click(), nextPageLink);
      log.info('Used JavaScript click for pagination');
    } catch (jsClickError) {
      // Fall back to regular click if JavaScript click fails
      log.info('JavaScript click failed, trying regular click');
      await nextPageLink.click();
    }
    
    // Wait for navigation to complete
    await page.waitForTimeout(Math.random() * 2000 + 1000);
    
    // Extract reviews from the new page
    const pageReviews = await extractReviewsFn();
    
    return {
      success: true,
      nextPageNumber: nextPageNumber,
      reviews: pageReviews
    };
  } catch (e) {
    log.warning(`Error navigating to page ${nextPageNumber}: ${e.message}`);
    return { success: false, nextPageNumber: currentPage };
  }
}

// Helper function to extract reviews from the page using direct page evaluation
async function extractSupermarketReviews(page, siteConfig) {
  const log = console; // Use the same logging interface as the main script
  
  // Use direct page evaluation to extract reviews
  return await page.evaluate((selectors) => {
    const results = [];
    
    // Helper function to find elements with various selectors
    const findElements = (selectorString) => {
      const selectors = selectorString.split(',').map(s => s.trim());
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            return Array.from(elements);
          }
        } catch (e) {
          console.error(`Error with selector ${selector}:`, e);
        }
      }
      return [];
    };
    
    // Look for review containers
    console.log('Looking for review containers');
    
    // First try the specific container selector
    let reviewContainers = findElements(selectors.reviewContainerSelector);
    console.log(`Found ${reviewContainers.length} review containers`);
    
    // If no containers found, look for the reviews section
    if (reviewContainers.length === 0) {
      const reviewSections = findElements(selectors.reviewsSection);
      console.log(`Found ${reviewSections.length} review sections`);
      
      if (reviewSections.length > 0) {
        // Look for review containers within the sections
        for (const section of reviewSections) {
          const containers = Array.from(section.querySelectorAll('.review, .pd-reviews__review-container, div[id^="id_"]'));
          if (containers.length > 0) {
            reviewContainers = containers;
            console.log(`Found ${containers.length} review containers within sections`);
            break;
          }
        }
      }
    }
    
    // If still no containers, look for any divs that might contain reviews
    if (reviewContainers.length === 0) {
      const potentialReviewDivs = document.querySelectorAll(
        'div[class*="review" i], div[class*="rating" i], div[class*="comment" i], ' +
        'li[class*="review" i], article[class*="review" i], ' +
        '.reviews-list > *, .review-list > *, [id*="review-list"] > *'
      );
      reviewContainers = Array.from(potentialReviewDivs);
    }
    
    // Process each review container
    for (const container of reviewContainers) {
      try {
        // For supermarkets, we know the exact structure, so target specific elements
        
        // 1. Extract the review text
        let reviewText = '';
        const contentElement = container.querySelector(selectors.reviewTextSelector);
        if (contentElement) {
          reviewText = contentElement.textContent.trim();
          console.log(`Found review text: ${reviewText.substring(0, 50)}...`);
        }
        
        // If no specific content element found, try to find any element with 'content' in the class
        if (!reviewText) {
          const contentElements = Array.from(container.querySelectorAll('[class*="content" i]'));
          for (const el of contentElements) {
            // Skip elements that are likely not review content
            if (el.className.includes('trailing-content') ||
                el.className.includes('rating__content')) {
              continue;
            }
            
            reviewText = el.textContent.trim();
            if (reviewText) {
              console.log(`Found alternative review text: ${reviewText.substring(0, 50)}...`);
              break;
            }
          }
        }
        
        // 2. Extract the title
        let title = 'Review';
        const titleElement = container.querySelector(selectors.titleSelector);
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
        
        // 3. Extract the rating
        let rating = '5'; // Default rating
        const ratingElement = container.querySelector(selectors.ratingSelector);
        if (ratingElement) {
          // Look for the aria-label which contains the rating
          const ratingLabel = ratingElement.querySelector('[aria-label*="Rating"], [title*="Rating"]');
          if (ratingLabel) {
            const ariaLabel = ratingLabel.getAttribute('aria-label') || ratingLabel.getAttribute('title') || '';
            const ratingMatch = ariaLabel.match(/(\d+(\.\d+)?)\s*(out of|of)\s*\d+/);
            if (ratingMatch) {
              rating = ratingMatch[1];
            }
          }
          
          // If no aria-label, try to count filled stars
          if (rating === '5') {
            const filledStars = ratingElement.querySelectorAll('.star-filled, .icon-star-full, [class*="star-full"], [class*="star-filled"]').length;
            if (filledStars > 0) {
              rating = filledStars.toString();
            }
          }
        }
        
        // 4. Extract the date
        let date = 'Unknown date';
        const dateElement = container.querySelector(selectors.dateSelector);
        if (dateElement) {
          date = dateElement.textContent.trim();
          
          // Try datetime attribute if text is vague or missing
          const dateTimeAttr = dateElement.getAttribute('datetime') || dateElement.getAttribute('data-date');
          if (dateTimeAttr && (!date || date.toLowerCase().includes('ago'))) {
            // Basic check if it looks like an ISO date
            if (/^\d{4}-\d{2}-\d{2}/.test(dateTimeAttr)) {
              date = dateTimeAttr.split('T')[0]; // Get YYYY-MM-DD part
            } else {
              date = dateTimeAttr; // Use whatever is in datetime
            }
          }
        }
        
        // 5. Extract the author (if available)
        let author = '';
        const authorElement = container.querySelector(selectors.authorSelector);
        if (authorElement) {
          author = authorElement.textContent.trim().replace('Written by ', '');
        }
        
        // If no specific text element found, try to extract and clean the text
        if (!reviewText) {
          // First, try to find any paragraphs that might contain the review text
          const paragraphs = Array.from(container.querySelectorAll('p'));
          if (paragraphs.length > 0) {
            // Find the longest paragraph - likely to be the review text
            const longestParagraph = paragraphs.reduce((longest, current) => {
              return current.textContent.length > longest.textContent.length ? current : longest;
            }, paragraphs[0]);
            
            reviewText = longestParagraph.textContent.trim();
          } else {
            // If no paragraphs, use the container's text but clean it up
            reviewText = container.textContent.trim();
            
            // Try to remove known elements that aren't part of the review text
            
            // 1. Remove title
            if (title && title !== 'Review') {
              reviewText = reviewText.replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
            }
            
            // 2. Remove date
            if (date && date !== 'Unknown date') {
              reviewText = reviewText.replace(new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
            }
            
            // 3. Remove author
            if (author) {
              reviewText = reviewText.replace(new RegExp('Written by ' + author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
              reviewText = reviewText.replace(new RegExp(author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
            }
            
            // 4. Remove rating text patterns
            reviewText = reviewText.replace(/\d(\.\d)? out of 5 stars/gi, '');
            reviewText = reviewText.replace(/\d(\.\d)? stars/gi, '');
            reviewText = reviewText.replace(/rated (\d|\d\.\d) out of 5/gi, '');
            reviewText = reviewText.replace(/Rating \d out of \d/gi, '');
            
            // 5. Remove common UI text that might be included
            const commonUIText = [
              'Verified Purchase',
              'Helpful',
              'Report',
              'Was this helpful?',
              'Yes',
              'No',
              'Flag',
              'Share',
              'Like',
              'Comment',
              'Reply',
              'See more',
              'Read more',
              'Show more',
              'Reviewed in',
              'Reviewed on',
              'Posted on',
              'Submitted on',
              'Yes, I recommend this product',
              'No, I don\'t recommend this product',
              'Report as inappropriate'
            ];
            
            for (const text of commonUIText) {
              reviewText = reviewText.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
            }
          }
          
          // Clean up whitespace and normalize
          reviewText = reviewText.replace(/\s+/g, ' ').trim();
        }
        
        // Only add if we have meaningful review text
        if (reviewText && reviewText.length > 10) {
          // Check for duplicates before adding
          const isDuplicate = results.some(r => {
            // Check if this review text is very similar to an existing one
            const similarity = (r.text.length > 0) ?
              reviewText.length / Math.max(r.text.length, reviewText.length) : 0;
            return similarity > 0.8; // 80% similar text is considered a duplicate
          });
          
          if (!isDuplicate) {
            results.push({
              rating,
              title,
              date,
              text: reviewText,
              author: author // Include author in the review data
            });
          }
        }
      } catch (e) {
        console.error('Error processing review container:', e);
      }
    }
    
    return results;
  }, siteConfig);
}

// Export the utility functions
module.exports = {
  findAndClickReviewsTab,
  handleSupermarketPagination,
  extractSupermarketReviews
};
