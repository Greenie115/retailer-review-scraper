const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testWebInterface() {
  console.log('Starting web interface test...');
  
  // Launch a browser
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-http2'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to the local server
    console.log('Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: 'test-initial-page.png' });
    console.log('Took screenshot of initial page');
    
    // Fill in the form
    console.log('Filling in the form...');
    await page.type('#productUrls', 'https://www.tesco.com/groceries/en-GB/products/296704688');
    
    // Take a screenshot after filling the form
    await page.screenshot({ path: 'test-form-filled.png' });
    console.log('Took screenshot of filled form');
    
    // Enable request interception to log network requests
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      console.log(`Request: ${request.method()} ${request.url()}`);
      // Log request body if it's a POST request
      if (request.method() === 'POST') {
        console.log('Request body:', request.postData());
      }
      request.continue();
    });
    
    page.on('response', async response => {
      console.log(`Response: ${response.status()} ${response.url()}`);
      // Log response body if it's from our scrape endpoint
      if (response.url().includes('/scrape')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('text/html')) {
            const text = await response.text();
            console.log('Response body:', text);
          } else if (contentType.includes('text/csv')) {
            console.log('Received CSV response');
            const buffer = await response.buffer();
            fs.writeFileSync('test-response.csv', buffer);
            console.log('Saved CSV response to test-response.csv');
          }
        } catch (error) {
          console.error('Error reading response:', error);
        }
      }
    });
    
    // Click the submit button
    console.log('Clicking submit button...');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/scrape'), { timeout: 120000 }),
      page.click('button[type="submit"]')
    ]);
    
    // Take a screenshot after submission
    await page.screenshot({ path: 'test-after-submit.png' });
    console.log('Took screenshot after form submission');
    
    // Wait for a moment to see the result
    await page.waitForTimeout(5000);
    
    // Take a final screenshot
    await page.screenshot({ path: 'test-final.png' });
    console.log('Took final screenshot');
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error during test:', error);
    // Take a screenshot on error
    try {
      const page = (await browser.pages())[0];
      await page.screenshot({ path: 'test-error.png' });
      console.log('Took error screenshot');
    } catch (screenshotError) {
      console.error('Error taking screenshot:', screenshotError);
    }
  } finally {
    // Close the browser
    await browser.close();
    console.log('Browser closed');
  }
}

testWebInterface().catch(console.error);
