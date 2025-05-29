/**
 * Patch for Morrisons date extraction in review-scraper-crawlee.js
 * 
 * This file contains the code changes needed to fix the Morrisons date extraction.
 * You can copy and paste these functions into your review-scraper-crawlee.js file.
 */

// 1. First, add this import at the top of your file:
// const { extractMorrisonsDate } = require('./morrisons-date-extractor');

// 2. Find the extractReviews function and add this custom extractor for Morrisons:

/*
// When calling extractReviews for Morrisons, use this code:

const reviews = await extractReviews(page, siteConfig, maxReviews, {
  // Add custom extractors for Morrisons
  customExtractors: {
    date: async (reviewElement) => {
      // Use our specialized date extractor for Morrisons
      return await extractMorrisonsDate(page, reviewElement, log);
    }
  }
});
*/

// 3. In the Morrisons handler, add this code before returning the reviews:

/*
// Before returning the reviews, ensure dates are properly set
reviewsCopy.forEach(review => {
  review.siteType = 'morrisons';
  
  // Log the date for debugging
  log.info(`Review date before processing: ${review.date}`);
  
  // If the date is empty or invalid, set it to empty string
  if (!review.date || 
      review.date === 'DATE_NOT_FOUND' || 
      review.date === 'NO_DATE_FOUND' || 
      review.date.startsWith('ERROR:') || 
      review.date.startsWith('Failed to parse:')) {
    log.warning(`Invalid date found: ${review.date}. Setting to empty string.`);
    review.date = '';
  }
  
  // Log the final date
  log.info(`Final date for review: ${review.date}`);
});
*/

// 4. In server.js, modify the CSV generation to handle empty dates:

/*
// Ensure the date is properly formatted or use an empty string
let reviewDate = review.date;
if (!reviewDate || 
    reviewDate === '' || 
    reviewDate.startsWith('Failed to parse') || 
    reviewDate.startsWith('ERROR') || 
    reviewDate === 'NO_DATE_FOUND' || 
    reviewDate === 'DATE_NOT_FOUND') {
  reviewDate = ''; // Empty string instead of today's date
  console.log(`Using empty string for invalid date: ${review.date}`);
} else {
  console.log(`Using valid date: ${reviewDate}`);
}

// Use reviewDate in the CSV row instead of review.date
*/
