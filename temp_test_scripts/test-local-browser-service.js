const axios = require('axios');

// URL to test
const testUrl = 'https://groceries.morrisons.com/products/market-street-deli-thickly-sliced-wiltshire-cured-ham/111543577';
const retailer = 'morrisons';

console.log(`Testing local browser service with ${retailer} URL: ${testUrl}`);
console.log('This will open a visible Chrome browser window to scrape the reviews');
console.log('Make sure the local browser service is running (npm run local-browser)');
console.log('--------------------------------------------------------------');

// Function to test the local browser service
async function testLocalBrowserService() {
  try {
    console.log('Sending request to local browser service...');
    
    const response = await axios.post('http://localhost:3002/scrape-with-visible-browser', {
      url: testUrl,
      retailer: retailer,
      options: {}
    }, {
      timeout: 120000 // 2 minute timeout
    });
    
    if (response.status === 200 && response.data && response.data.reviews) {
      console.log(`Success! Retrieved ${response.data.reviews.length} reviews from ${retailer}`);
      console.log('\nFirst 3 reviews:');
      
      // Display the first 3 reviews
      response.data.reviews.slice(0, 3).forEach((review, index) => {
        console.log(`\nReview #${index + 1}:`);
        console.log(`Title: ${review.title}`);
        console.log(`Rating: ${review.rating}`);
        console.log(`Date: ${review.date}`);
        console.log(`Text: ${review.text.substring(0, 100)}${review.text.length > 100 ? '...' : ''}`);
      });
      
      console.log('\nLocal browser service is working correctly!');
    } else {
      console.error('Error: Invalid response from local browser service');
      console.error('Response:', response.data);
    }
  } catch (error) {
    console.error('Error testing local browser service:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Is the local browser service running?');
      console.error('Make sure to start it with: npm run local-browser');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testLocalBrowserService();
