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
  await page.screenshot({ path: 'morrisons-simple-initial.png' });
  
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
  const reviewTab = await page.$('a:has-text("Reviews")');
  if (reviewTab) {
    console.log('Found review tab, clicking...');
    await reviewTab.click().catch(e => console.warn(`Tab click failed: ${e.message}`));
    await page.waitForTimeout(2000);
  } else {
    console.warn('Could not find reviews tab');
  }
  
  // Take a screenshot after clicking the tab
  await page.screenshot({ path: 'morrisons-simple-after-tab-click.png' });
  
  // Wait for reviews to load
  await page.waitForTimeout(2000);
  
  // Scroll down to load lazy-loaded content
  console.log('Scrolling page...');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);
  
  // Take a screenshot before extracting reviews
  await page.screenshot({ path: 'morrisons-simple-before-extraction.png' });
  
  // Extract the HTML of the reviews section
  console.log('Extracting reviews section HTML...');
  const reviewsHtml = await page.evaluate(() => {
    const reviewsList = document.querySelector('ul[data-test="review-list"]');
    return reviewsList ? reviewsList.outerHTML : 'No reviews list found';
  });
  
  // Save the HTML to a file
  fs.writeFileSync('morrisons-reviews-html.html', reviewsHtml);
  console.log('Saved reviews HTML to morrisons-reviews-html.html');
  
  // Extract reviews using direct page evaluation
  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    const results = [];
    
    // Find all review items
    const reviewItems = document.querySelectorAll('li[data-test^="review-item-"]');
    console.log(`Found ${reviewItems.length} review items`);
    
    // Log the HTML of the first review item if available
    if (reviewItems.length > 0) {
      console.log('First review item HTML:', reviewItems[0].outerHTML);
    }
    
    return {
      count: reviewItems.length,
      firstReviewHtml: reviewItems.length > 0 ? reviewItems[0].outerHTML : 'No reviews found'
    };
  });
  
  // Take a screenshot after extracting reviews
  await page.screenshot({ path: 'morrisons-simple-after-extraction.png' });
  
  // Log the results
  console.log('Review extraction results:', reviews);
  
  // Save the results to a file
  fs.writeFileSync('morrisons-simple-results.json', JSON.stringify(reviews, null, 2));
  console.log('Saved results to morrisons-simple-results.json');
  
  // Close the browser
  await browser.close();
  console.log('Test completed');
}

// Run the test
testMorrisonsHandler()
  .then(() => console.log('Test finished successfully'))
  .catch(error => console.error('Test failed:', error));
