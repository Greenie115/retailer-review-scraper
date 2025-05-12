const { scrapeReviews } = require('./review-scraper-crawlee-fixed');

// Test URL
const testUrl = 'https://www.tesco.com/groceries/en-GB/products/296704688';

async function testScraper() {
  console.log(`Testing scraper with URL: ${testUrl}`);
  
  try {
    const reviews = await scrapeReviews(testUrl);
    console.log(`Successfully scraped ${reviews.length} reviews`);
    
    if (reviews.length > 0) {
      console.log('First review:', JSON.stringify(reviews[0], null, 2));
    }
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

testScraper();
