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
  
  // Try to find the reviews section
  console.log('Looking for reviews section...');
  const reviewsInfo = await page.evaluate(() => {
    // Try different selectors to find reviews
    const selectors = [
      // New selectors based on the HTML provided
      '.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0',
      'div[class*="ReviewTileContainer"]',
      'div[class*="review"]',
      'div[class*="Review"]',
      // Generic selectors
      '.review',
      '.product-review',
      '.customer-review',
      // Heading selectors
      'h2:contains("Reviews"), h2:contains("Customer Reviews"), h3:contains("Reviews")'
    ];
    
    const results = {};
    
    // Check each selector
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          results[selector] = {
            count: elements.length,
            firstElementHtml: elements[0].outerHTML
          };
        }
      } catch (e) {
        console.error(`Error with selector ${selector}:`, e);
      }
    }
    
    // Look for any elements that might contain reviews
    const possibleReviewElements = [];
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const classNames = element.className || '';
      const id = element.id || '';
      
      if (
        classNames.toString().toLowerCase().includes('review') ||
        id.toLowerCase().includes('review') ||
        (element.textContent || '').toLowerCase().includes('review')
      ) {
        possibleReviewElements.push({
          tagName: element.tagName,
          className: classNames.toString(),
          id,
          textContent: element.textContent ? element.textContent.substring(0, 100) : '',
          childCount: element.children.length
        });
      }
    }
    
    return {
      selectorResults: results,
      possibleReviewElements: possibleReviewElements.slice(0, 20) // Limit to first 20 to avoid huge output
    };
  });
  
  // Save the reviews info to a file
  fs.writeFileSync('tesco-reviews-info.json', JSON.stringify(reviewsInfo, null, 2));
  console.log('Saved reviews info to tesco-reviews-info.json');
  
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
