/**
 * Test script for Morrisons date extractor
 * 
 * This script will open a Morrisons product page, find reviews,
 * and test our date extraction function on them.
 */

const { chromium } = require('playwright');
const { extractMorrisonsDate } = require('./morrisons-date-extractor');

// Simple logger for testing
const log = {
  info: (msg) => console.log(`INFO: ${msg}`),
  error: (msg) => console.error(`ERROR: ${msg}`),
  warning: (msg) => console.warn(`WARNING: ${msg}`)
};

async function testDateExtractor() {
  console.log('Starting Morrisons date extractor test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to a Morrisons product page
    await page.goto('https://groceries.morrisons.com/products/market-street-deli-thickly-sliced-wiltshire-cured-ham/111543577');
    console.log('Page loaded');
    
    // Accept cookies if needed
    try {
      await page.waitForSelector('button[aria-label="Accept All Cookies"]', { timeout: 5000 });
      await page.click('button[aria-label="Accept All Cookies"]');
      console.log('Accepted cookies');
    } catch (e) {
      console.log('No cookie banner found or already accepted');
    }
    
    // Click on reviews tab
    try {
      await page.waitForSelector('a:has-text("Reviews")', { timeout: 5000 });
      await page.click('a:has-text("Reviews")');
      console.log('Clicked reviews tab');
    } catch (e) {
      console.log('Could not find reviews tab:', e.message);
    }
    
    // Wait for reviews to load
    await page.waitForTimeout(2000);
    
    // Find review elements
    const reviewElements = await page.$$('.sc-mmemlz-0.dYNMlH');
    console.log(`Found ${reviewElements.length} review elements`);
    
    if (reviewElements.length === 0) {
      console.log('No reviews found. Taking screenshot for debugging...');
      await page.screenshot({ path: 'debug-no-reviews.png' });
      console.log('Current page HTML:', await page.content());
    }
    
    // Test date extraction on each review
    for (let i = 0; i < Math.min(reviewElements.length, 5); i++) {
      console.log(`\n--- Testing review ${i+1} ---`);
      const reviewElement = reviewElements[i];
      
      // Extract date using our function
      const extractedDate = await extractMorrisonsDate(page, reviewElement, log);
      console.log(`Extracted date: ${extractedDate || 'NONE'}`);
      
      // For comparison, get the raw text
      const reviewText = await reviewElement.evaluate(el => el.textContent);
      console.log(`Review text (first 100 chars): ${reviewText.substring(0, 100)}...`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
    console.log('Test completed');
  }
}

// Run the test
testDateExtractor().catch(console.error);
