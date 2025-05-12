const { scrapeReviews } = require('./review-scraper-crawlee-fixed');

// Test URL for an ASDA product that likely has reviews
const testUrl = 'https://groceries.asda.com/product/cheddar-cheese/asda-extra-special-vintage-cheddar/910000447592';

async function testScraper() {
  console.log(`Testing scraper with ASDA product URL: ${testUrl}`);
  
  try {
    // Set headless mode to false to see the browser
    process.env.HEADLESS = 'false';
    
    const reviews = await scrapeReviews(testUrl);
    console.log(`Successfully scraped ${reviews.length} reviews`);
    
    if (reviews.length > 0) {
      console.log('First review:', JSON.stringify(reviews[0], null, 2));
    } else {
      console.log('No reviews found for this product either.');
    }
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

testScraper();
