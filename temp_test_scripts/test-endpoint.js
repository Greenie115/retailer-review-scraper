const axios = require('axios');
const FormData = require('form-data');

async function testScrapeEndpoint() {
  console.log('Testing /scrape endpoint...');
  
  try {
    const response = await axios.post('http://localhost:3001/scrape', 
      'productUrls=https://www.tesco.com/groceries/en-GB/products/296704688',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'blob'
      }
    );
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response size:', response.data.size, 'bytes');
    console.log('Success! The endpoint is working correctly.');
  } catch (error) {
    console.error('Error testing endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else {
      console.error(error.message);
    }
  }
}

testScrapeEndpoint();
