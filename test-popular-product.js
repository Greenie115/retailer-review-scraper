const { scrapeReviews } = require('./review-scraper-crawlee-fixed');

// Test URL for a popular product that likely has reviews
const testUrl = 'https://www.tesco.com/groceries/en-GB/products/254656589'; // Tesco Finest Chocolate Cake

async function testScraper() {
  console.log(`Testing scraper with popular product URL: ${testUrl}`);
  
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
