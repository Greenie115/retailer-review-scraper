// Tesco specific handler
async function handleTescoSite(page, siteConfig, maxReviews = 50) {
  const log = siteConfig.log || console;
  log.info('Using optimized Tesco handler');

  // Initialize global array for Tesco reviews if not exists
  global.tescoReviews = [];
  
  try {
    // Handle cookie consent if present
    try {
      log.info('Checking for cookie consent dialog');
      const cookieButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button[data-auto="accept-cookies"]');
      if (cookieButton) {
        log.info('Found cookie consent button, clicking...');
        await cookieButton.click().catch(e => log.warning(`Cookie click failed: ${e.message}`));
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      log.warning(`Error handling cookie consent: ${cookieError.message}`);
    }

    // Wait for the page to load and scroll down to load lazy content
    log.info('Scrolling down to load lazy content');
    await page.waitForTimeout(2000);
    
    // Perform scroll with error handling
    try {
      await autoScroll(page);
    } catch (scrollError) {
      log.warning(`Error during scrolling: ${scrollError.message}`);
    }
    
    await page.waitForTimeout(1500);

    // Click "Show more reviews" button multiple times to load more reviews
    let clickCount = 0;
    const maxClicks = 10; // Increase to 10 clicks to get more reviews (up to around 50)
    
    while (clickCount < maxClicks) {
      try {
        log.info(`Attempting to click "Show more reviews" button (attempt ${clickCount + 1}/${maxClicks})`);
        
        // Expanded selector to find the "Show more reviews" button including link elements
        const showMoreButton = await page.$(
          'button:has-text("show 10 more reviews"), ' +
          'button:has-text("Show more reviews"), ' +
          'button[data-auto="load-more-reviews"], ' +
          'button[class*="load-more"], ' +
          'button:has-text("Load more"), ' +
          'button:has-text("Show more"), ' +
          'button:has-text("More reviews"), ' +
          'a:has-text("Show 10 more reviews"), ' +
          'a[class*="textButton"]:has(div[class*="_4B4CsCPxyUrSE2"]), ' +
          'a:has-text("more reviews")'
        );
        
        if (!showMoreButton) {
          log.info('No more "Show more reviews" button found');
          break;
        }
        
        log.info('Found "Show more reviews" button, clicking...');
        
        try {
          await showMoreButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500); // Wait a bit after scrolling
        } catch (e) {
          log.warning(`Failed to scroll to button: ${e.message}`);
        }
        
        // Try multiple approaches to click the button
        let clickSucceeded = false;
        
        // 1. Try direct click
        try {
          await showMoreButton.click();
          log.info('Direct click succeeded');
          clickSucceeded = true;
        } catch (directClickError) {
          log.warning(`Direct click failed: ${directClickError.message}`);
        }
        
        // 2. Try JavaScript click if direct click failed
        if (!clickSucceeded) {
          try {
            await page.evaluate(button => button.click(), showMoreButton);
            log.info('JavaScript click succeeded');
            clickSucceeded = true;
          } catch (jsClickError) {
            log.warning(`JavaScript click also failed: ${jsClickError.message}`);
          }
        }
        
        // 3. Try to navigate to the href if it's a link
        if (!clickSucceeded) {
          try {
            const href = await page.evaluate(link => {
              if (link.tagName === 'A' && link.href) {
                return link.href;
              }
              return null;
            }, showMoreButton);
            
            if (href) {
              log.info(`Attempting to navigate to href: ${href}`);
              await page.goto(href, { waitUntil: 'domcontentloaded' });
              clickSucceeded = true;
            }
          } catch (hrefError) {
            log.warning(`Href navigation failed: ${hrefError.message}`);
          }
        }
        
        // Wait longer after clicking to ensure content loads
        await page.waitForTimeout(3000);
        
        // Check if new reviews have been loaded
        try {
          const reviewCountAfterClick = await page.evaluate(() => {
            return document.querySelectorAll(
              'div[data-auto="review-card"], ' +
              'div[class*="ReviewTileContainer"], ' +
              '[data-auto="review-tile"], ' +
              '[class*="reviewTile"], ' +
              '[class*="ReviewTile"], ' +
              '.ddsweb-reviews-tile, ' +
              'div[data-testid^="review-"]'
            ).length;
          });
          
          log.info(`Review count after click: ${reviewCountAfterClick}`);
        } catch (countError) {
          log.warning(`Error counting reviews: ${countError.message}`);
        }
        
        if (clickSucceeded) {
          clickCount++;
        } else {
          log.warning('All click approaches failed, trying next button');
          break;
        }
      } catch (e) {
        log.warning(`Error clicking "Show more reviews" button: ${e.message}`);
        break;
      }
    }

    // Extract reviews using direct DOM access approach
    log.info('Extracting reviews directly from the DOM');
    const reviews = await page.evaluate(() => {
      console.log('Starting Tesco review extraction with direct DOM approach');
      const results = [];
      
      // Helper function to clean text
      const cleanText = (text) => {
        if (!text) return '';
        return text.trim()
          .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
          .replace(/\n+/g, ' '); // Replace newlines with a space
      };
      
      // Find all individual review containers, but exclude the summary section
      // Modern Tesco (2024) review container selectors
      const allReviewElements = document.querySelectorAll(
        'div[data-auto="review-card"], ' +
        'div[class*="ReviewTileContainer"], ' +
        '[data-auto="review-tile"], ' +
        '[class*="reviewTile"], ' +
        '[class*="ReviewTile"], ' +
        '.ddsweb-reviews-tile, ' +
        'div[data-testid^="review-"]'
      );
      
      // Filter out elements that are likely summary sections rather than individual reviews
      const reviewContainers = Array.from(allReviewElements).filter(element => {
        // Skip elements that contain text like "Help other customers" which appears in the summary
        if (element.textContent.includes("Help other customers") || 
            element.textContent.includes("Write a review") ||
            element.textContent.includes("fuller picture") ||
            element.textContent.includes("We show reviews from Tesco") ||
            element.textContent.includes("Average Rating") ||
            element.textContent.includes("ReviewsAverage") ||
            element.textContent.includes("Did not enjoy") || // Filter out summary-style review previews
            element.textContent.includes("Exceptional yet affordable wine") || // Filter out summary-style review previews
            element.textContent.includes("Help other customers like you") ||
            element.textContent.match(/\d+\s+Reviews\s+Average\s+Rating/i)) { // Filter out review count header
          console.log("Excluding summary section element");
          return false;
        }
        
        // Skip elements that appear to be combining multiple reviews (containing multiple dates)
        const monthCount = [
          'January', 'February', 'March', 'April', 'May', 'June', 
          'July', 'August', 'September', 'October', 'November', 'December'
        ].reduce((count, month) => {
          const regex = new RegExp(month, 'gi');
          const matches = element.textContent.match(regex);
          return count + (matches ? matches.length : 0);
        }, 0);
        
        // If element contains multiple month mentions (2+), it's likely aggregating multiple reviews
        if (monthCount >= 2) {
          console.log(`Excluding element containing multiple dates (${monthCount} month mentions)`);
          return false;
        }
        
        // Skip elements that are too small to be a real review
        if (element.textContent.trim().length < 50) {
          console.log("Excluding element with too little text");
          return false;
        }
        
        // Skip elements that contain the show more reviews button
        if (element.querySelector('a:has-text("Show 10 more reviews")') || 
            element.querySelector('a:has-text("more reviews")') ||
            element.querySelector('a[class*="textButton"]:has(div[class*="_4B4CsCPxyUrSE2"])')) {
          console.log("Excluding element with 'Show more reviews' button");
          return false;
        }
        
        // Skip elements that look like navigation or header sections
        if (element.textContent.includes("Sort by:") || 
            element.textContent.includes("Filter reviews") ||
            element.textContent.includes("Show only") ||
            element.textContent.includes("Showing reviews")) {
          console.log("Excluding navigation or header element");
          return false;
        }
        
        // Only include elements that match the pattern of an actual review
        // Most Tesco reviews have a date in format like "17th December 2024"
        const hasDatePattern = /\d+(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i.test(element.textContent);
        
        if (!hasDatePattern) {
          console.log("Excluding element without proper date pattern");
          return false;
        }
        
        // Also check for reviewer pattern - most have "A Tesco Customer"
        const hasReviewerPattern = element.textContent.includes("Tesco Customer");
        
        // Include elements that look like individual reviews
        return hasDatePattern && (hasReviewerPattern || element.textContent.length > 100);
      });
      
      console.log(`Found ${reviewContainers.length} review containers`);
      
      if (reviewContainers.length > 0) {
        // Process each review container individually
        reviewContainers.forEach((container, index) => {
          try {
            // Skip if container is empty or too small to be a review
            if (!container || container.textContent.trim().length < 30) {
              return;
            }
            
            // Extract rating
            let rating = '5'; // Default
            const ratingElement = container.querySelector(
              'div[data-auto="review-rating"], ' +
              'div[class*="ReviewRating"], ' +
              '[class*="rating"], ' +
              '[class*="stars"], ' +
              'span[class*="Stars"]'
            );
            
            if (ratingElement) {
              // Try to extract numeric rating from text content
              const ratingText = ratingElement.textContent.trim();
              const ratingMatch = ratingText.match(/(\d+)(?:\.\d+)?[^\d]*(?:out of|\/)\s*(\d+)/i) || 
                                ratingText.match(/(\d+)(?:\.\d+)?\s*stars?/i) || 
                                ratingText.match(/(\d+)(?:\.\d+)?/);
              
              if (ratingMatch && ratingMatch[1]) {
                // If we have a decimal rating like 3.7, convert to integer
                const parsedRating = parseFloat(ratingMatch[1]);
                if (!isNaN(parsedRating)) {
                  // Round to nearest integer or keep as is if it's already an integer
                  rating = Math.round(parsedRating).toString();
                  console.log(`Found rating ${rating} from text: "${ratingText}" (parsed from ${parsedRating})`);
                }
              } else {
                // Try to count filled stars
                const filledStars = ratingElement.querySelectorAll('.filled-star, [data-filled="true"], [class*="filled"]').length;
                if (filledStars > 0) {
                  rating = filledStars.toString();
                  console.log(`Found rating ${rating} from filled stars count`);
                } else {
                  // Try to count star SVGs with blue fill
                  try {
                    const svgStars = Array.from(ratingElement.querySelectorAll('svg'));
                    const filledSvgStars = svgStars.filter(svg => {
                      const pathElements = svg.querySelectorAll('path');
                      for (const path of pathElements) {
                        const fill = path.getAttribute('fill');
                        if (fill && (fill.includes('tesco-blue') || fill.includes('#00539f'))) {
                          return true;
                        }
                      }
                      return false;
                    });
                    
                    if (filledSvgStars.length > 0) {
                      rating = filledSvgStars.length.toString();
                      console.log(`Found rating ${rating} from SVG stars with blue fill`);
                    }
                  } catch (svgError) {
                    console.error(`Error counting SVG stars: ${svgError.message}`);
                  }
                }
              }
            }
            
            // Extract title - Use the most specific selectors first, then fallback to generic ones
            let title = '';
            const titleElement = container.querySelector(
              'div[data-auto="review-title"], ' +
              'h3[class*="Title-mfe-pdp"], ' +
              '[class*="reviewTitle"], ' +
              '[class*="ReviewTitle"], ' +
              'div[class*="title"], ' +
              'h3[class*="title"], ' +
              'h3, h4'
            );
            
            if (titleElement) {
              title = cleanText(titleElement.textContent);
              // Clean up the title - remove any rating mentions
              title = title.replace(/\s*\d+\s*(?:out of|\/)\s*\d+\s*stars?/gi, '')
                         .replace(/\s*\d+\s*stars?/gi, '')
                         .replace(/Rated\s+/i, '')
                         .trim();
              
              // If title includes reviewer name at beginning (like "A Very palatable!"), 
              // extract just the title part
              const reviewerPrefixMatch = title.match(/^A\s+(.+)$/);
              if (reviewerPrefixMatch && reviewerPrefixMatch[1]) {
                title = reviewerPrefixMatch[1].trim();
              }
              
              console.log(`Found title: "${title}"`);
            }
            
            // Extract date
            let date = '';
            const dateElement = container.querySelector(
              'div[data-auto="review-date"], ' +
              'span[class*="ReviewDate"], ' +
              '[class*="date"], ' +
              'time'
            );
            
            if (dateElement) {
              date = cleanText(dateElement.textContent);
              console.log(`Found date: "${date}"`);
            }
            
            // Extract reviewer name
            let reviewer = '';
            const reviewerElement = container.querySelector(
              'span[class*="Reviewer"], ' +
              '[class*="author"], ' +
              '[class*="Author"]'
            );
            
            if (reviewerElement) {
              const reviewerText = cleanText(reviewerElement.textContent);
              if (reviewerText && !reviewerText.includes('Report')) {
                reviewer = reviewerText;
              }
            }
            
            // If no explicit reviewer found, look for text patterns like "A Tesco Customer"
            if (!reviewer) {
              const fullText = container.textContent;
              const customerMatch = fullText.match(/A\s+Tesco\s+Customer/i);
              if (customerMatch) {
                reviewer = 'A Tesco Customer';
              }
            }
            
            // Extract review text - using more specific selectors for review content
            let text = '';
            const textElement = container.querySelector(
              'div[data-auto="review-text"], ' +
              'span[class*="Content-mfe-pdp"], ' +
              '[class*="review-text"], ' +
              '[class*="reviewContent"], ' +
              '[class*="review-content"], ' +
              '[class*="description"], ' +
              'div[class*="rBSFtRFU"], ' + // Match for example class in HTML
              'div[class*="ZBVjDt79j"], ' + // Another observed review text container
              'p'
            );
            
            if (textElement) {
              text = cleanText(textElement.textContent);
              
              // If text starts with "A " followed by the title, it's a pattern we've seen
              // where the reviewer name prefix is merged with text
              // Example: "A Very palatable!bought this last week..."
              if (title && text.startsWith('A ' + title)) {
                text = text.substring(('A ' + title).length).trim();
              }
              
              // If text contains the title, remove the title part to avoid duplication
              if (title && text.includes(title) && title.length > 5) {
                text = text.replace(title, '').trim();
              }
              
              console.log(`Found text: "${text.substring(0, 50)}..."`);
            }
            
            // If we couldn't find text with specific selectors, try to extract it from the container
            if (!text || text.length < 20) {
              // Get all text nodes directly inside this container
              const textNodes = [];
              for (let node of container.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                  textNodes.push(node.textContent.trim());
                }
              }
              
              if (textNodes.length > 0) {
                text = cleanText(textNodes.join(' '));
              }
              
              // Check if this is potentially a summary section that we missed earlier
              if (text && (
                  text.includes("Did not enjoy") || 
                  text.includes("Exceptional yet affordable wine") ||
                  text.includes("New and Interesting"))) {
                console.log("Ignoring review summary section text");
                text = "";
              }
            }
            
            // Still no text - try one more approach: get all text and remove known parts
            if (!text || text.length < 20) {
              let fullText = cleanText(container.textContent);
              
              // Remove known parts like title, date, reviewer
              if (title) fullText = fullText.replace(title, '');
              if (date) fullText = fullText.replace(date, '');
              if (reviewer) fullText = fullText.replace(reviewer, '');
              
              // Remove common non-review text
              fullText = fullText
                .replace(/Report/g, '')
                .replace(/A Tesco Customer/g, '')
                .replace(/Show \d+ more reviews/g, '')
                .replace(/Showing \d+ of \d+ reviews/g, '')
                .replace(/\d+\s*out of\s*\d+/gi, '')
                .replace(/\d+\s*stars?/gi, '')
                .trim();
              
              if (fullText.length > 20) {
                text = fullText;
              }
            }
            
            // IMPORTANT: Make sure the text doesn't contain rating information
            text = text.replace(/\d+\s*(?:out of|\/)\s*\d+\s*stars?/gi, '')
                     .replace(/\d+\s*stars?/gi, '')
                     .replace(/Rated\s+/i, '')
                     .trim();
            
            // Remove any date patterns from the text (to avoid date duplication)
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
            
            for (const month of months) {
              const dateRegex = new RegExp(`\\d+(?:st|nd|rd|th)?\\s+${month}\\s+\\d{4}`, 'gi');
              text = text.replace(dateRegex, '');
            }
            
            // Remove reviewer patterns
            text = text.replace(/A Tesco Customer/gi, '')
                     .replace(/Tesco Customer/gi, '')
                     .trim();
            
            // Special case: If text starts with "A" followed by what looks like a title
            const aPrefixMatch = text.match(/^A\s+([A-Z][a-zA-Z\s]+)[!\.](.+)$/);
            if (aPrefixMatch && aPrefixMatch[1] && aPrefixMatch[2]) {
              // Set title if we don't have one yet
              if (!title || title.length < 5) {
                title = aPrefixMatch[1].trim();
              }
              text = aPrefixMatch[2].trim();
            }
                     
            // Make sure review components don't contain each other
            if (title && text && text.includes(title) && title.length > 5) {
              text = text.replace(title, '').trim();
            }
            
            // Clean up any leading punctuation after title removal
            text = text.replace(/^[!,.]+\s*/, '');
            
            // If we have text or a title, add this as a review
            if ((text && text.length > 5) || (title && title.length > 5)) {
              // If we still don't have a title but have text, use first few words as title
              if ((!title || title.length < 5) && text && text.length > 10) {
                const words = text.split(' ');
                if (words.length > 5) {
                  title = words.slice(0, 5).join(' ') + '...';
                  // Remove the title part from the text to avoid duplication
                  text = text.substring(title.length - 3).trim();
                } else {
                  title = 'Tesco Review';
                }
              }
              
              // If we have no reviewer, use default
              if (!reviewer) {
                reviewer = 'Tesco Customer';
              }
              
              // Add the review to results with strict validation
              results.push({
                rating: rating || '5',
                title: title || 'Tesco Review',
                date: date || '',
                text: text || '',
                reviewer: reviewer || 'Tesco Customer'
              });
              
              console.log(`Added review #${index + 1} with rating ${rating}`);
            }
          } catch (e) {
            console.error(`Error processing review container #${index + 1}:`, e);
          }
        });
        
        console.log(`Processed ${reviewContainers.length} containers, extracted ${results.length} reviews`);
      } else {
        console.log('No review containers found with primary selectors, trying alternative approach');
        
        // Fallback: try to identify review blocks by pattern
        // This approach looks for text blocks with common review patterns
        const allParagraphs = document.querySelectorAll('p, div');
        
        for (const paragraph of allParagraphs) {
          const text = paragraph.textContent.trim();
          
          // Skip short texts, navigation elements, etc.
          if (text.length < 100 || 
              paragraph.closest('nav') || 
              paragraph.closest('header') || 
              paragraph.closest('footer') ||
              text.includes('Sign in') ||
              text.includes('Register') ||
              text.includes('Delivery') ||
              text.includes('Terms and conditions')) {
            continue;
          }
          
          // Look for patterns that suggest this is a review
          const isReview = 
            (text.match(/\d+\s*stars?/i) || 
             text.match(/\d+\s*out of\s*\d+/i) ||
             text.includes('Customer') && 
             (text.includes('January') || text.includes('February') || 
              text.includes('March') || text.includes('April') || 
              text.includes('May') || text.includes('June') || 
              text.includes('July') || text.includes('August') || 
              text.includes('September') || text.includes('October') || 
              text.includes('November') || text.includes('December')));
          
          if (isReview) {
            console.log(`Found potential review by pattern: "${text.substring(0, 50)}..."`);
            
            // Try to parse out components
            let rating = '5'; // Default
            let title = '';
            let date = '';
            let reviewer = 'Tesco Customer';
            
            // Extract rating if present
            const ratingMatch = text.match(/(\d+)\s*stars?/i) || text.match(/(\d+)\s*out of\s*\d+/i);
            if (ratingMatch && ratingMatch[1]) {
              rating = ratingMatch[1];
            }
            
            // Try to extract date - look for month names
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                            'July', 'August', 'September', 'October', 'November', 'December'];
            
            for (const month of months) {
              if (text.includes(month)) {
                const dateRegex = new RegExp(`(\\d+(?:st|nd|rd|th)?\\s+${month}\\s+\\d{4})`, 'i');
                const dateMatch = text.match(dateRegex);
                if (dateMatch && dateMatch[1]) {
                  date = dateMatch[1];
                  break;
                }
              }
            }
            
            // Extract reviewer if present
            if (text.includes('Tesco Customer')) {
              reviewer = 'Tesco Customer';
            }
            
            // Try to divide the text into title and content
            let reviewText = text;
            
            // Remove extracted parts
            if (date) reviewText = reviewText.replace(date, '');
            if (reviewer) reviewText = reviewText.replace(reviewer, '');
            if (ratingMatch) reviewText = reviewText.replace(ratingMatch[0], '');
            
            // Clean up the remaining text
            reviewText = cleanText(reviewText)
              .replace(/Report/g, '')
              .replace(/A Tesco Customer/g, '')
              .replace(/Show \d+ more reviews/g, '')
              .replace(/Showing \d+ of \d+ reviews/g, '')
              .trim();
            
            // Add to results
            results.push({
              rating,
              title: title || 'Tesco Review',
              date,
              text: reviewText,
              reviewer
            });
          }
        }
      }
      
      // Final validation of all reviews
      const validatedResults = results
        // First filter out any reviews that appear to be from the summary section
        .filter(review => {
          if (!review.text && !review.title) return false;
          
          // Check for specific phrases that indicate this is from a summary section
          const summaryIndicators = [
            "Did not enjoy", 
            "Exceptional yet affordable wine",
            "New and Interesting",
            "Bought this for a dinner party",
            "unanimous opinion",
            "Average Rating",
            "Reviews"
          ];
          
          for (const indicator of summaryIndicators) {
            if ((review.text && review.text.includes(indicator)) || 
                (review.title && review.title.includes(indicator))) {
              console.log(`Filtering out summary review with indicator: ${indicator}`);
              return false;
            }
          }
          
          return true;
        })
        .map(review => {
          // Ensure title and text don't contain each other
          if (review.title && review.text && review.text.includes(review.title)) {
            review.text = review.text.replace(review.title, '').trim();
          }
          
          // Make sure rating doesn't appear in title or text
          review.title = (review.title || '')
            .replace(/\d+\s*(?:out of|\/)\s*\d+\s*stars?/gi, '')
            .replace(/\d+\s*stars?/gi, '')
            .replace(/Rated\s+/i, '')
            .trim();
            
          review.text = (review.text || '')
            .replace(/\d+\s*(?:out of|\/)\s*\d+\s*stars?/gi, '')
            .replace(/\d+\s*stars?/gi, '')
            .replace(/Rated\s+/i, '')
            .trim();
          
          // Remove any common patterns from text that don't belong
          review.text = review.text
            .replace(/Report/gi, '')
            .replace(/ReviewsAverage/g, '')
            .replace(/Average Rating/g, '')
            .replace(/Help other customers/g, '')
            .replace(/Write a review/g, '')
            .replace(/from other websites/g, '')
            .replace(/fuller picture/g, '')
            .trim();
            
          // Clean up leading and trailing punctuation
          review.text = review.text
            .replace(/^[!,.]+\s*/, '')
            .replace(/\s*[!,.]+$/, '');
            
          review.title = review.title
            .replace(/^[!,.]+\s*/, '')
            .replace(/\s*[!,.]+$/, '');
            
          // Check for "A" prefix pattern in the beginning of text (common in Tesco reviews)
          const aPrefixMatch = review.text.match(/^A\s+([A-Z][a-zA-Z\s]+)[!\.]\s*(.+)$/);
          if (aPrefixMatch && aPrefixMatch[1] && aPrefixMatch[2]) {
            // Use as title if we don't have a good one
            if (!review.title || review.title === 'Tesco Review' || review.title.length < 5) {
              review.title = aPrefixMatch[1].trim();
            }
            review.text = aPrefixMatch[2].trim();
          }
          
          // Ensure we have default values and nothing is too long
          const maxTitleLength = 100;
          let title = review.title || 'Tesco Review';
          if (title.length > maxTitleLength) {
            title = title.substring(0, maxTitleLength) + '...';
          }
          
          return {
            rating: review.rating || '5',
            title: title,
            date: review.date || '',
            text: review.text || '',
            reviewer: review.reviewer || 'Tesco Customer'
          };
        });
      
      console.log(`Returning ${validatedResults.length} validated reviews`);
      return validatedResults;
    });

    log.info(`Extracted ${reviews.length} reviews from Tesco site`);

    // Add the reviews to the global array
    if (reviews && reviews.length > 0) {
      global.tescoReviews = reviews;
      log.info(`Successfully added ${reviews.length} reviews to global array`);
      
      // Log sample reviews for debugging
      reviews.slice(0, 3).forEach((review, index) => {
        log.info(`Review #${index + 1}:`);
        log.info(`  Rating: ${review.rating}`);
        log.info(`  Title: ${review.title || 'No title'}`);
        log.info(`  Date: ${review.date || 'No date'}`);
        log.info(`  Text: ${review.text ? (review.text.substring(0, 50) + '...') : 'No text'}`);
      });
    } else {
      log.warning('No reviews extracted from Tesco page');
    }
  } catch (error) {
    log.error(`Error in Tesco handler: ${error.message}\n${error.stack}`);
  }

  return global.tescoReviews;
}

// Helper function to scroll down the page
async function autoScroll(page) {
  return await page.evaluate(async () => {
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

module.exports = { handleTescoSite };