const { chromium } = require('playwright');
const fs = require('fs');

// Function to test the Tesco reviews extraction
async function testTescoReviews() {
  console.log('Starting test of Tesco reviews extraction...');
  
  // Launch a browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the Tesco product page
  const url = 'https://www.tesco.com/groceries/en-GB/products/296704688';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Take a screenshot of the initial page
  await page.screenshot({ path: 'tesco-test-initial.png' });
  
  // Handle cookie consent if present
  try {
    console.log('Looking for cookie consent button...');
    const cookieButton = await page.$('button:has-text("Accept all cookies"), #onetrust-accept-btn-handler');
    if (cookieButton) {
      console.log('Found cookie consent button, clicking...');
      await cookieButton.click().catch(e => console.warn(`Cookie click failed: ${e.message}`));
      await page.waitForTimeout(2000);
    }
  } catch (cookieError) {
    console.warn(`Error handling cookie consent: ${cookieError.message}`);
  }
  
  // Scroll down to load lazy-loaded content
  console.log('Scrolling page...');
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
  await page.waitForTimeout(1000);
  
  // Take a screenshot after scrolling
  await page.screenshot({ path: 'tesco-test-after-scroll.png' });
  
  // Try to click the "Show more reviews" button a few times
  for (let i = 0; i < 5; i++) {
    try {
      console.log('Looking for show more reviews button...');
      const showMoreButton = await page.$('button:has-text("Show more reviews"), button:has-text("Load more"), button:has-text("Show more")');
      if (showMoreButton) {
        console.log('Found show more reviews button, clicking...');
        await showMoreButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await showMoreButton.click({ force: true }).catch(async (e) => {
          console.warn(`Direct show more click failed: ${e.message}, trying JavaScript click...`);
          await page.evaluate(button => button.click(), showMoreButton);
        });
        console.log(`Clicked show more button, attempt ${i+1}`);
        await page.waitForTimeout(2000);
        
        // Take a screenshot after clicking show more
        await page.screenshot({ path: `tesco-test-after-show-more-${i+1}.png` });
      } else {
        console.log('No show more button found, all reviews may be loaded');
        break;
      }
    } catch (e) {
      console.warn(`Error clicking show more button: ${e.message}`);
      break;
    }
  }
  
  // Extract the HTML of the reviews section
  console.log('Extracting reviews section HTML...');
  const reviewsHtml = await page.evaluate(() => {
    // Find all review containers
    const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0');
    
    if (reviewContainers.length === 0) {
      return 'No review containers found with class .styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0';
    }
    
    // Return the HTML of the first review container
    return {
      count: reviewContainers.length,
      firstReviewHtml: reviewContainers[0].outerHTML
    };
  });
  
  // Save the HTML to a file
  fs.writeFileSync('tesco-reviews-html.json', JSON.stringify(reviewsHtml, null, 2));
  console.log('Saved reviews HTML to tesco-reviews-html.json');
  
  // Extract reviews using direct page evaluation
  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    const results = [];
    
    // Find all review containers
    const reviewContainers = document.querySelectorAll('.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0');
    console.log(`Found ${reviewContainers.length} review containers`);
    
    // Process each review container
    for (const container of reviewContainers) {
      try {
        // Extract rating
        let rating = '5'; // Default to 5 stars
        const ratingContainer = container.querySelector('.styled__ReviewRating-mfe-pdp__sc-je4k7f-3');
        if (ratingContainer) {
          const ratingText = ratingContainer.getAttribute('aria-label');
          if (ratingText) {
            const ratingMatch = ratingText.match(/rating of (\d+) stars/);
            if (ratingMatch && ratingMatch[1]) {
              rating = ratingMatch[1];
              console.log(`Extracted rating: ${rating} stars`);
            }
          }
          
          // Alternative method: count the active star SVGs
          if (rating === '5') {
            const activeStars = ratingContainer.querySelectorAll('.ddsweb-rating__icon-active');
            if (activeStars && activeStars.length > 0) {
              rating = activeStars.length.toString();
              console.log(`Extracted rating: ${rating} stars (by counting SVGs)`);
            }
          }
        }
        
        // Extract title
        let title = 'Product Review'; // Default title
        const titleElement = container.querySelector('.styled__Title-mfe-pdp__sc-je4k7f-2');
        if (titleElement) {
          title = titleElement.textContent.trim();
          console.log(`Extracted title: "${title}"`);
        }
        
        // Extract date
        let date = 'Unknown date';
        const authorElement = container.querySelector('.styled__ReviewAuthor-mfe-pdp__sc-je4k7f-4');
        if (authorElement) {
          const dateElement = authorElement.querySelector('.styled__ReviewDate-mfe-pdp__sc-je4k7f-9');
          if (dateElement) {
            date = dateElement.textContent.trim();
            console.log(`Extracted date: "${date}"`);
          }
        }
        
        // Extract review text
        let text = '';
        const contentElement = container.querySelector('.styled__Content-mfe-pdp__sc-je4k7f-6');
        if (contentElement) {
          text = contentElement.textContent.trim();
          console.log(`Extracted text: "${text.substring(0, 30)}..."`);
        }
        
        // Only add if we have meaningful text
        if (text && text.length > 5) {
          results.push({ rating, title, date, text });
          console.log(`Added review with rating ${rating}`);
        }
      } catch (e) {
        console.error('Error processing review container:', e);
      }
    }
    
    return results;
  });
  
  // Save the reviews to a file
  fs.writeFileSync('tesco-reviews.json', JSON.stringify(reviews, null, 2));
  console.log(`Saved ${reviews.length} reviews to tesco-reviews.json`);
  
  // Take a final screenshot
  await page.screenshot({ path: 'tesco-test-final.png' });
  
  // Close the browser
  await browser.close();
  console.log('Test completed');
}

// Run the test
testTescoReviews()
  .then(() => console.log('Test finished successfully'))
  .catch(error => console.error('Test failed:', error));
