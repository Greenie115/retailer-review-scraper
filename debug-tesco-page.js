const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugTescoPage() {
  console.log('Starting Tesco page debugging...');
  
  // Launch a browser
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security'
    ]
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    
    const page = await context.newPage();
    
    // Navigate to the Tesco product page
    const url = 'https://www.tesco.com/groceries/en-GB/products/254656589';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: 'debug-tesco-initial.png', fullPage: true });
    console.log('Took screenshot of initial page');
    
    // Save the HTML content
    const initialHtml = await page.content();
    fs.writeFileSync('debug-tesco-initial.html', initialHtml);
    console.log('Saved initial HTML content');
    
    // Handle cookie consent if present
    try {
      const cookieButton = await page.$('button:has-text("Accept all cookies"), #onetrust-accept-btn-handler');
      if (cookieButton) {
        console.log('Found cookie consent button, clicking...');
        await cookieButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (cookieError) {
      console.log(`Error handling cookie consent: ${cookieError.message}`);
    }
    
    // Scroll down to load lazy-loaded content
    console.log('Scrolling page to load all content...');
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
    
    // Take a screenshot after scrolling
    await page.screenshot({ path: 'debug-tesco-after-scroll.png', fullPage: true });
    console.log('Took screenshot after scrolling');
    
    // Save the HTML content after scrolling
    const afterScrollHtml = await page.content();
    fs.writeFileSync('debug-tesco-after-scroll.html', afterScrollHtml);
    console.log('Saved HTML content after scrolling');
    
    // Look for review-related elements
    console.log('Looking for review-related elements...');
    
    // Check for review tab
    const reviewTab = await page.$('button:has-text("Reviews"), a:has-text("Reviews"), [data-auto-id="reviews-tab"]');
    if (reviewTab) {
      console.log('Found review tab, clicking...');
      await reviewTab.click();
      await page.waitForTimeout(3000);
      
      // Take a screenshot after clicking review tab
      await page.screenshot({ path: 'debug-tesco-after-review-tab.png', fullPage: true });
      console.log('Took screenshot after clicking review tab');
      
      // Save the HTML content after clicking review tab
      const afterTabHtml = await page.content();
      fs.writeFileSync('debug-tesco-after-review-tab.html', afterTabHtml);
      console.log('Saved HTML content after clicking review tab');
    } else {
      console.log('No review tab found');
    }
    
    // Check for review containers
    const reviewSelectors = [
      '.styled__ReviewTileContainer-mfe-pdp__sc-je4k7f-0', 
      'div[class*="ReviewTileContainer"]',
      '.ddsweb-reviews-tile',
      '.ddsweb-reviews-tile__container',
      'div[data-testid="review-tile"]',
      'div[data-testid*="review"]',
      'div[class*="review-tile"]',
      'div[class*="ReviewTile"]'
    ];
    
    for (const selector of reviewSelectors) {
      const reviewElements = await page.$$(selector);
      if (reviewElements.length > 0) {
        console.log(`Found ${reviewElements.length} review elements with selector: ${selector}`);
        
        // Take a screenshot of the first review element
        const firstReview = reviewElements[0];
        await firstReview.screenshot({ path: `debug-tesco-review-element-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png` });
        console.log(`Took screenshot of first review element with selector: ${selector}`);
        
        // Get the HTML content of the first review element
        const reviewHtml = await page.evaluate(el => el.outerHTML, firstReview);
        fs.writeFileSync(`debug-tesco-review-element-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.html`, reviewHtml);
        console.log(`Saved HTML content of first review element with selector: ${selector}`);
      } else {
        console.log(`No review elements found with selector: ${selector}`);
      }
    }
    
    // Look for "Show more reviews" button
    const buttonSelectors = [
      'button.styled__ShowMoreButton-mfe-pdp__sc-c5rmfv-2',
      'button.ddsweb-button--text-button',
      'button:has-text("Show 10 more reviews")',
      'button:has-text("Show more reviews")',
      'button[data-testid="show-more-reviews"]',
      'button[data-testid*="more-reviews"]',
      'button[class*="ShowMoreButton"]',
      'button[class*="show-more"]'
    ];
    
    for (const selector of buttonSelectors) {
      const button = await page.$(selector);
      if (button) {
        console.log(`Found "Show more reviews" button with selector: ${selector}`);
        
        // Take a screenshot of the button
        await button.screenshot({ path: `debug-tesco-show-more-button-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png` });
        console.log(`Took screenshot of "Show more reviews" button with selector: ${selector}`);
        
        // Get the HTML content of the button
        const buttonHtml = await page.evaluate(el => el.outerHTML, button);
        fs.writeFileSync(`debug-tesco-show-more-button-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.html`, buttonHtml);
        console.log(`Saved HTML content of "Show more reviews" button with selector: ${selector}`);
      } else {
        console.log(`No "Show more reviews" button found with selector: ${selector}`);
      }
    }
    
    // Check for any elements that might contain the word "review"
    console.log('Looking for any elements containing the word "review"...');
    const reviewElements = await page.$$('*:has-text("review")');
    console.log(`Found ${reviewElements.length} elements containing the word "review"`);
    
    // Take screenshots of the first 5 elements containing "review"
    for (let i = 0; i < Math.min(5, reviewElements.length); i++) {
      try {
        await reviewElements[i].screenshot({ path: `debug-tesco-review-text-element-${i}.png` });
        console.log(`Took screenshot of element ${i} containing the word "review"`);
        
        // Get the HTML content of the element
        const elementHtml = await page.evaluate(el => el.outerHTML, reviewElements[i]);
        fs.writeFileSync(`debug-tesco-review-text-element-${i}.html`, elementHtml);
        console.log(`Saved HTML content of element ${i} containing the word "review"`);
      } catch (error) {
        console.log(`Error taking screenshot of element ${i}: ${error.message}`);
      }
    }
    
    console.log('Debug process completed');
  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    // Close the browser
    await browser.close();
    console.log('Browser closed');
  }
}

debugTescoPage().catch(console.error);
