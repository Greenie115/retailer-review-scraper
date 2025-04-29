const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { scrapeReviews } = require('./review-scraper');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/scrape', async (req, res) => {
  console.log('Received scrape request with body:', req.body);

  try {
    // Get product URLs from the form
    const productUrls = req.body.productUrls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    // Get date range from the form
    const dateFrom = req.body.dateFrom || '';
    const dateTo = req.body.dateTo || '';

    console.log(`Received scrape request for ${productUrls.length} URLs`);

    if (productUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }

    // Create a timestamp for the CSV file
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const csvFilePath = path.join(__dirname, 'output', `reviews_${timestamp}.csv`);

    // Ensure output directory exists
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Start processing URLs
    console.log(`Starting to process ${productUrls.length} URLs...`);

    // Array to store all reviews
    const allReviews = [];

    // Process each URL
    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      console.log(`Starting scraper for URL ${i+1}/${productUrls.length}: ${url}`);

      // Scrape reviews for this URL
      const reviews = await scrapeReviews(url, { dateFrom, dateTo });

      // Add product name to each review
      const productName = extractProductName(url);
      const reviewsWithProduct = reviews.map(review => ({
        ...review,
        productName
      }));

      // Add reviews to the combined array
      if (reviewsWithProduct && reviewsWithProduct.length > 0) {
        allReviews.push(...reviewsWithProduct);
        console.log(`Added ${reviewsWithProduct.length} reviews from ${url}`);
      } else {
        console.log(`No reviews found for ${url}`);
      }
    }

    // Save all reviews to a single CSV file
    if (allReviews.length > 0) {
      // Define CSV header
      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: 'productName', title: 'Product Name' },
          { id: 'title', title: 'Title' },
          { id: 'rating', title: 'Rating' },
          { id: 'date', title: 'Date' },
          { id: 'text', title: 'Review Text' },
          { id: 'sourceUrl', title: 'Source URL' }
        ]
      });

      // Format dates to DD/MM/YYYY
      const formattedReviews = allReviews.map(review => ({
        ...review,
        date: formatDate(review.date)
      }));

      // Write reviews to CSV
      await csvWriter.writeRecords(formattedReviews);
      console.log(`Saved ${formattedReviews.length} reviews to ${csvFilePath}`);

      // Send the CSV file as a download
      res.download(csvFilePath, path.basename(csvFilePath), (err) => {
        if (err) {
          console.error(`Error sending CSV file: ${err.message}`);
        }
      });
    } else {
      res.status(404).json({ error: 'No reviews found for any of the provided URLs' });
    }
  } catch (error) {
    console.error(`Error processing request: ${error.message}\n${error.stack}`);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Helper function to extract product name from URL
function extractProductName(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    // Convert URL slug to readable name
    if (lastPart && lastPart.length > 0) {
      let productName = lastPart
        .replace(/-/g, ' ')  // Replace hyphens with spaces
        .replace(/\d+g$/, '') // Remove weight suffix like 76g
        .replace(/\d+$/, '')  // Remove any trailing numbers
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();

      // Capitalize first letter of each word
      productName = productName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return productName;
    }

    // If we couldn't extract a clean name, use a generic one
    return `Product from ${url}`;
  } catch (error) {
    console.log(`Could not extract product name from URL: ${error.message}`);
    return `Product from ${url}`;
  }
}

// Helper function to format date to DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';

  try {
    // If already in DD/MM/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr;
    }

    // Try to create a date object
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    // If all else fails, return the original string
    return dateStr;
  } catch (e) {
    console.log(`Error formatting date "${dateStr}": ${e.message}`);
    return dateStr;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Review scraper server listening at http://localhost:${port}`);
  console.log('Server is ready to accept requests');
});
