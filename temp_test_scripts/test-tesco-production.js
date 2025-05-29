const { scrapeReviews } = require('./review-scraper-integrated');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.HEADLESS = 'true';

async function testTescoScraping() {
  console.log('Testing optimized Tesco scraping in headless mode...');
  
  const testUrls = [
    'https://www.tesco.com/groceries/en-GB/products/284275907',
    'https://www.tesco.com/groceries/en-GB/products/251250935'
  ];
  
  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);
    try {
      console.time(`Scraping ${url}`);
      const reviews = await scrapeReviews(url, {});
      console.timeEnd(`Scraping ${url}`);
      
      console.log(`Found ${reviews.length} reviews`);
      
      if (reviews.length > 0) {
        console.log('\nSample reviews:');
        reviews.slice(0, 3).forEach((review, index) => {
          console.log(`\nReview #${index + 1}:`);
          console.log(`Rating: ${review.rating}`);
          console.log(`Title: ${review.title || 'No title'}`);
          console.log(`Date: ${review.date || 'No date'}`);
          console.log(`Text: ${review.text ? review.text.substring(0, 100) + (review.text.length > 100 ? '...' : '') : 'No text'}`);
        });
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

testTescoScraping().catch(console.error);