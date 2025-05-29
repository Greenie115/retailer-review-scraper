const { chromium } = require('playwright');
const fs = require('fs');

// Function to test the Morrisons handler directly
async function testMorrisonsHandler() {
  console.log('Starting direct test of Morrisons handler...');
  
  // Launch a browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the Morrisons product page
  const url = 'https://groceries.morrisons.com/products/morrisons-ripe-ready-bananas-5-pack/110378231';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Take a screenshot of the initial page
  await page.screenshot({ path: 'morrisons-test-initial.png' });
  
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
  
  // Find and click on the reviews tab
  console.log('Looking for reviews tab...');
  const reviewTabSelectors = [
    'button:has-text("Reviews")',
    'a:has-text("Reviews")',
    '[data-test="reviews-tab"]',
    'button[aria-controls="reviews"]'
  ];
  
  let tabClicked = false;
  for (const selector of reviewTabSelectors) {
    try {
      console.log(`Trying selector: ${selector}`);
      const reviewTab = await page.$(selector);
      if (reviewTab) {
        console.log(`Found review tab with selector: ${selector}`);
        // Scroll to the element first
        await reviewTab.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        
        // Try clicking
        await reviewTab.click({ force: true }).catch(async (e) => {
          console.warn(`Direct tab click failed: ${e.message}, trying JavaScript click...`);
          await page.evaluate(button => button.click(), reviewTab);
        });
        
        console.log(`Clicked review tab with selector: ${selector}`);
        await page.waitForTimeout(2000);
        tabClicked = true;
        break;
      }
    } catch (e) {
      console.warn(`Error clicking tab with selector ${selector}: ${e.message}`);
    }
  }
  
  // Take a screenshot after clicking the tab
  await page.screenshot({ path: 'morrisons-test-after-tab-click.png' });
  
  // Wait for reviews to load
  await page.waitForTimeout(2000);
  
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
  
  // Take a screenshot before extracting reviews
  await page.screenshot({ path: 'morrisons-test-before-extraction.png' });
  
  // Extract reviews using direct page evaluation
  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    console.log('Starting Morrisons review extraction');
    const results = [];
    
    // Find all review containers
    const reviewItems = document.querySelectorAll('li[data-test^="review-item-"]');
    console.log(`Found ${reviewItems.length} Morrisons review items`);
    
    // Process each review container
    for (const item of reviewItems) {
      try {
        // Extract rating from the text that says "X out of 5"
        let rating = '5'; // Default to 5 stars
        const ratingText = item.querySelector('span._text_16wi0_1._text--m_16wi0_23');
        if (ratingText) {
          const ratingMatch = ratingText.textContent.match(/(\\d+)\\s+out\\s+of\\s+5/i);
          if (ratingMatch && ratingMatch[1]) {
            rating = ratingMatch[1];
            console.log(`Extracted Morrisons rating: ${rating} stars from text`);
          }
        }
        
        // Extract title
        let title = 'Product Review'; // Default title
        const titleElement = item.querySelector('h4._text_16wi0_1._text--bold_16wi0_7._text--m_16wi0_23');
        if (titleElement) {
          title = titleElement.textContent.trim();
          // Remove "Rated X out of 5" from the title if present
          title = title.replace(/Rated \\d+ out of \\d+/g, '').trim();
          console.log(`Extracted title: "${title}"`);
        }
        
        // Extract date
        let date = 'Unknown date';
        const dateElement = item.querySelector('span._text_16wi0_1._text--s_16wi0_13');
        if (dateElement) {
          date = dateElement.textContent.trim();
          console.log(`Extracted date: "${date}"`);
        }
        
        // Extract review text
        let text = '';
        const textElement = item.querySelector('span._text_16wi0_1._text--m_16wi0_23.sc-16m6t4r-0');
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
    
    console.log(`Returning ${results.length} Morrisons reviews`);
    return results;
  });
  
  // Take a screenshot after extracting reviews
  await page.screenshot({ path: 'morrisons-test-after-extraction.png' });
  
  // Log the results
  console.log(`Found ${reviews.length} reviews`);
  if (reviews.length > 0) {
    console.log('First review:', reviews[0]);
  }
  
  // Save the reviews to a file
  fs.writeFileSync('morrisons-reviews.json', JSON.stringify(reviews, null, 2));
  console.log('Saved reviews to morrisons-reviews.json');
  
  // Close the browser
  await browser.close();
  console.log('Test completed');
}

// Run the test
testMorrisonsHandler()
  .then(() => console.log('Test finished successfully'))
  .catch(error => console.error('Test failed:', error));
