const { scrapeReviews } = require('./review-scraper-integrated');

// Test URL for Morrisons
const testUrl = 'https://groceries.morrisons.com/products/morrisons-british-semi-skimmed-milk-217783011';

async function testMorrisonsHandler() {
  console.log(`Testing Morrisons handler with URL: ${testUrl}`);
  
  try {
    // Call the scrapeReviews function
    const reviews = await scrapeReviews(testUrl);
    
    console.log(`Successfully extracted ${reviews.length} reviews from Morrisons site`);
    
    // Print the first few reviews
    if (reviews.length > 0) {
      console.log('First 3 reviews:');
      reviews.slice(0, 3).forEach((review, index) => {
        console.log(`Review ${index + 1}:`);
        console.log(`  Rating: ${review.rating}`);
        console.log(`  Title: ${review.title}`);
        console.log(`  Date: ${review.date}`);
        console.log(`  Text: ${review.text.substring(0, 100)}...`);
        console.log('---');
      });
    }
    
    // Check if any reviews have invalid ratings (greater than 5)
    const invalidRatings = reviews.filter(review => parseInt(review.rating, 10) > 5);
    if (invalidRatings.length > 0) {
      console.log(`WARNING: Found ${invalidRatings.length} reviews with invalid ratings (greater than 5):`);
      invalidRatings.forEach((review, index) => {
        console.log(`Invalid Review ${index + 1}:`);
        console.log(`  Rating: ${review.rating}`);
        console.log(`  Title: ${review.title}`);
      });
    } else {
      console.log('SUCCESS: No reviews with invalid ratings found!');
    }
    
  } catch (error) {
    console.error(`Error testing Morrisons handler: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the test
testMorrisonsHandler();
