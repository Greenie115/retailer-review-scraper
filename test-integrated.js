const { scrapeReviews } = require('./review-scraper-integrated');

// Test URLs for different retailers
const testUrls = {
  sainsburys: 'https://www.sainsburys.co.uk/gol-ui/product/sainsburys-taste-the-difference-vintage-cheddar-cheese-550g',
  asda: 'https://groceries.asda.com/product/cheddar-cheese/asda-extra-special-vintage-cheddar/910000447592',
  tesco: 'https://www.tesco.com/groceries/en-GB/products/254656589',
  morrisons: 'https://groceries.morrisons.com/products/morrisons-the-best-vintage-cheddar-110391011'
};

// Choose which retailer to test
const retailerToTest = process.argv[2] || 'sainsburys';
const testUrl = testUrls[retailerToTest] || testUrls.sainsburys;

async function testScraper() {
  console.log(`Testing integrated scraper with ${retailerToTest.toUpperCase()} product URL: ${testUrl}`);
  
  try {
    // Set headless mode to false to see the browser
    process.env.HEADLESS = 'false';
    
    const reviews = await scrapeReviews(testUrl);
    console.log(`Successfully scraped ${reviews.length} reviews`);
    
    if (reviews.length > 0) {
      console.log('First review:', JSON.stringify(reviews[0], null, 2));
    } else {
      console.log('No reviews found for this product.');
    }
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

testScraper();
