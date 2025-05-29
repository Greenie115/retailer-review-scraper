const { handleMorrisonsSite } = require('./morrisons-handler-fixed');
const { PlaywrightCrawler, log } = require('crawlee');

// Test function to run the Morrisons handler
async function testMorrisonsHandler(url) {
  console.log(`Testing Morrisons handler with URL: ${url}`);
  
  // Create a crawler
  const crawler = new PlaywrightCrawler({
    launchContext: {
      launchOptions: {
        headless: false, // Set to true for production
      },
    },
    async requestHandler({ page, request }) {
      console.log(`Processing ${request.url}...`);
      
      // Configure site-specific settings
      const siteConfig = {
        log: log,
        retailer: 'morrisons',
        reviewsTabSelector: 'button:has-text("Reviews"), a:has-text("Reviews"), [data-test="reviews-tab"], button[aria-controls="reviews"]',
        reviewsSection: '.reviews-section, #reviews, [data-auto-id="reviews-section"]',
        reviewContainerSelector: 'div.review, div.review-card, div[data-auto-id="review-card"], div.review-container',
        ratingSelector: 'div.star-rating, div[data-auto-id="star-rating"], div.rating-stars',
        titleSelector: 'h3.review-title, h4.review-title, div[data-auto-id="review-title"], div.review-title',
        textSelector: 'p.review-text, div.review-text, div[data-auto-id="review-text"]',
        dateSelector: 'span.review-date, div.review-date, span[data-auto-id="review-date"]',
        paginationSelector: 'button:has-text("Next"), button:has-text("Show more"), button[data-auto-id="pagination-next"]'
      };
      
      // Call the Morrisons handler
      const reviews = await handleMorrisonsSite(page, siteConfig, 50);
      
      // Log the results
      console.log(`Found ${reviews.length} reviews`);
      if (reviews.length > 0) {
        console.log('First review:', reviews[0]);
      }
    },
  });

  // Run the crawler
  await crawler.run([url]);
  console.log('Test completed');
}

// Run the test with a Morrisons product URL
const morrisonsUrl = 'https://groceries.morrisons.com/products/morrisons-ripe-ready-bananas-5-pack/110378231';
testMorrisonsHandler(morrisonsUrl)
  .then(() => console.log('Test finished successfully'))
  .catch(error => console.error('Test failed:', error));
