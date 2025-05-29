const express = require('express');
const path = require('path');
const { scrapeReviews } = require('./review-scraper-crawlee-fixed'); // Import the fixed scraper function
const { generateCsvContent, addSiteTypeToReviews, addProductInfoToReviews } = require('./csv-exporter'); // Import CSV export utilities

const app = express();
const port = 3001; // Changed port to 3001

// Middleware to parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies (as sent by API clients)
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to handle the form submission and scrape reviews
app.post('/scrape', async (req, res) => {
  try {
    console.log('Received scrape request with body:', req.body);

    // Get the product URLs from the form
    let productUrls = req.body.productUrls;

    // If only one URL was provided, convert it to an array
    if (!Array.isArray(productUrls)) {
      productUrls = [productUrls];
    }

    // Filter out empty URLs
    productUrls = productUrls.filter(url => url && url.trim() !== '');

    if (productUrls.length === 0) {
      return res.status(400).send('No valid product URLs provided.');
    }

    console.log(`Received scrape request for ${productUrls.length} URLs`);
    console.log(`Starting to process ${productUrls.length} URLs...`);

    // Get date range if provided
    const dateFrom = req.body.dateFrom || null;
    const dateTo = req.body.dateTo || null;

    if (dateFrom || dateTo) {
      console.log(`Date range: ${dateFrom || 'any'} to ${dateTo || 'any'}`);
    }

    // Scrape reviews for each product URL
    const allReviews = [];
    let totalProductsScraped = 0;
    let successfulProducts = 0;

    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      try {
        console.log(`Starting scraper for URL ${i+1}/${productUrls.length}: ${url}`);
        totalProductsScraped++;

        // Scrape reviews for this URL
        const reviews = await scrapeReviews(url, { dateFrom, dateTo });

        console.log(`Found ${reviews.length} reviews for ${url}`);
        console.log(`Adding ${reviews.length} reviews from ${url} to allReviews (current size: ${allReviews.length})`);

        if (reviews && reviews.length > 0) {
          successfulProducts++;

          // Process reviews to add site type and product info
          const processedReviews = addProductInfoToReviews(
            addSiteTypeToReviews(reviews, url),
            url
          );

          // Add the reviews to the combined array
          allReviews.push(...processedReviews);
        }

        console.log(`After adding, allReviews now contains ${allReviews.length} reviews`);
      } catch (error) {
        console.error(`Error scraping URL ${url}:`, error);
      }
    }

    console.log(`Scraper finished, found ${allReviews.length} reviews across ${totalProductsScraped} products (${successfulProducts} with reviews).`);

    if (!allReviews || allReviews.length === 0) {
      // Handle case where no reviews were found
      return res.status(404).send('No reviews found for any of the given URLs, or scraping was interrupted.');
    }

    // Generate a more descriptive filename based on the date
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Create a simple filename
    let filename = `reviews_multiple_products_${date}.csv`;

    // Apply date filtering if specified
    console.log(`Preparing to generate CSV with ${allReviews.length} reviews from ${totalProductsScraped} products`);
    let filteredReviews = allReviews;

    if (dateFrom || dateTo) {
      // Sort reviews by product ID and then by date
      filteredReviews = allReviews.sort((a, b) => {
        // First sort by product ID
        if (a.productId !== b.productId) {
          return a.productId.localeCompare(b.productId);
        }
        // Then by date (newest first)
        if (a.parsedDate && b.parsedDate) {
          return new Date(b.parsedDate) - new Date(a.parsedDate);
        }
        return 0;
      });
    } else {
      // If no date filtering, just sort by product ID
      filteredReviews = allReviews.sort((a, b) => {
        return a.productId.localeCompare(b.productId);
      });
    }

    // Generate CSV content using our utility function
    const csvContent = generateCsvContent(filteredReviews, {
      dateFrom,
      dateTo,
      totalProductsScraped,
      successfulProducts
    });

    // Set headers for CSV file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Format the Content-Disposition header according to RFC 6266
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Debug: Print the first 5 reviews from each product
    const productIds = [...new Set(allReviews.map(review => review.productId))];
    for (const productId of productIds) {
      const productReviews = allReviews.filter(review => review.productId === productId).slice(0, 5);
      console.log(`First 5 reviews for product ${productId}:`);
      productReviews.forEach((review, index) => {
        console.log(`  Review ${index + 1}: ${JSON.stringify({
          title: review.title,
          rating: review.rating,
          date: review.date,
          siteType: review.siteType,
          productId: review.productId,
          productName: review.productName
        })}`);
      });
    }

    // Debug: Count reviews by site type
    const reviewsBySiteType = allReviews.reduce((acc, review) => {
      acc[review.siteType] = (acc[review.siteType] || 0) + 1;
      return acc;
    }, {});
    console.log(`Reviews by site type: ${JSON.stringify(reviewsBySiteType)}`);

    // Send the CSV content
    res.send(csvContent);
    console.log(`CSV file "${filename}" sent to client with ${filteredReviews.length} reviews from ${totalProductsScraped} products (${successfulProducts} with reviews).`);
    console.log(`Reviews by product: ${JSON.stringify(allReviews.reduce((acc, review) => {
      acc[review.productId] = (acc[review.productId] || 0) + 1;
      return acc;
    }, {}))}`);
    console.log(`Total reviews in CSV: ${filteredReviews.length}`);
    console.log(`Total products in CSV: ${totalProductsScraped}`);
    console.log(`Successful products (with reviews): ${successfulProducts}`);

  } catch (error) {
    console.error('Error during scraping or file generation:', error);
    res.status(500).send(`Scraping failed: ${error.message}`);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Review scraper server listening at http://localhost:${port}`); // Updated log message
  // You might need to use your actual IP address instead of localhost
  // for colleagues on the same network to access it.
});
