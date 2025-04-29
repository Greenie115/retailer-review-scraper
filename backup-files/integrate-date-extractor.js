/**
 * Integration script for Morrisons date extractor
 * 
 * This script shows how to integrate the Morrisons date extractor
 * into the main review-scraper-crawlee.js file.
 * 
 * Instructions:
 * 1. Add the import at the top of review-scraper-crawlee.js
 * 2. Use the custom extractor when calling extractReviews for Morrisons
 */

// 1. Add this import at the top of review-scraper-crawlee.js:
// const { extractMorrisonsDate } = require('./morrisons-date-extractor');

// 2. In the Morrisons handler, when calling extractReviews, use this code:
/*
// Extract reviews from the current page
let reviews = await extractReviews(page, siteConfig, maxReviews, {
  // Add custom extractors for Morrisons
  customExtractors: {
    date: async (reviewElement) => {
      // Use our specialized date extractor for Morrisons
      return await extractMorrisonsDate(page, reviewElement, log);
    }
  }
});
*/

// 3. For the pagination code, use the same custom extractor:
/*
// Extract reviews from the new page
const pageReviews = await extractReviews(page, siteConfig, maxReviews - global.morrisonsReviews.length, {
  // Add custom extractors for Morrisons
  customExtractors: {
    date: async (reviewElement) => {
      // Use our specialized date extractor for Morrisons
      return await extractMorrisonsDate(page, reviewElement, log);
    }
  }
});
*/

// 4. Before returning the reviews, ensure dates are properly set:
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
