/**
 * CSV Exporter utility functions
 * This module provides functions for generating CSV content from review data
 */

/**
 * Properly escape a field for CSV format
 * @param {*} field - The field to escape
 * @returns {string} - The escaped field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  // If the field contains commas, quotes, or newlines, wrap it in quotes and escape any quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }
  return stringField;
}

/**
 * Format a date to DD/MM/YYYY format
 * @param {string} dateStr - The date string to format
 * @returns {string} - The formatted date
 */
function formatDateForCsv(dateStr) {
  if (!dateStr || dateStr === 'Unknown date') {
    return '';
  }

  try {
    // If already in DD/MM/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr;
    }

    // If in YYYY-MM-DD format, convert to DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }

    // Try to parse various date formats
    let date;
    
    // Try to parse MM/DD/YYYY or DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const firstNum = parseInt(parts[0]);
        const secondNum = parseInt(parts[1]);
        
        // If first number is > 12, it's likely DD/MM/YYYY
        if (firstNum > 12) {
          // Already in DD/MM/YYYY format
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
        // If second number is > 12, it's likely MM/DD/YYYY
        else if (secondNum > 12) {
          // Convert to DD/MM/YYYY
          return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
        }
        // If both are <= 12, assume it's already in DD/MM/YYYY format
        else {
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
      }
    }
    
    // Try to create a date object
    date = new Date(dateStr);
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

/**
 * Generate CSV content from review data
 * @param {Array} reviews - The reviews to include in the CSV
 * @param {Object} options - Options for CSV generation
 * @returns {string} - The CSV content
 */
function generateCsvContent(reviews, options = {}) {
  const {
    dateFrom = null,
    dateTo = null,
    totalProductsScraped = 0,
    successfulProducts = 0
  } = options;
  
  // Create CSV content
  // First, add metadata as comments at the top of the CSV
  let csvContent = `# Products Scraped: ${totalProductsScraped}\r\n`;
  csvContent += `# Extraction Date: ${new Date().toLocaleDateString()}\r\n`;
  csvContent += `# Total Reviews: ${reviews.length}\r\n`;
  
  // Add date filter information if provided
  if (dateFrom || dateTo) {
    // Format the date range in a readable format
    const fromDateStr = dateFrom ? new Date(dateFrom).toLocaleDateString() : 'any';
    const toDateStr = dateTo ? new Date(dateTo).toLocaleDateString() : 'any';
    
    csvContent += `# Date Filter: ${fromDateStr} to ${toDateStr}\r\n`;
    const inRangeCount = reviews.filter(review => review.inDateRange === true).length;
    csvContent += `# Reviews in date range: ${inRangeCount} of ${reviews.length}\r\n`;
    
    // Add explanation of date filtering
    csvContent += `# Note: All reviews are included, but only those within the date range are marked 'Yes' in the 'In Date Range' column.\r\n`;
  }
  
  csvContent += `\r\n`; // Empty line after metadata
  
  // Define CSV headers
  const headers = ['Product Name', 'Rating', 'Date', 'In Date Range', 'Title', 'Text', 'Extracted On'];
  csvContent += headers.join(',') + '\r\n';
  
  // Track the current product ID to add separators between products
  let currentProductId = null;
  
  // Add each review as a row in the CSV
  for (const review of reviews) {
    // Add a blank line and product header between different products for better readability
    if (currentProductId !== null && currentProductId !== review.productId) {
      csvContent += ',,,,,,\r\n'; // Empty row as separator
      csvContent += `"Product: ${review.productName || 'Unknown Product'} (ID: ${review.productId || 'unknown'})",,,,,,\r\n`; // Product header
    } else if (currentProductId === null) {
      // Add product header for the first product
      csvContent += `"Product: ${review.productName || 'Unknown Product'} (ID: ${review.productId || 'unknown'})",,,,,,\r\n`; // Product header
    }
    currentProductId = review.productId;
    
    // Format the date for display
    const reviewDate = formatDateForCsv(review.date);
    
    // Clean the title if it contains "Rated" text
    let cleanTitle = review.title || '';
    
    // First, handle any escaped characters (like \x22 for quotes)
    cleanTitle = cleanTitle.replace(/\\x22/g, '"');
    cleanTitle = cleanTitle.replace(/\\x27/g, "'");
    
    // Then remove the "Rated X out of 5" part
    if (cleanTitle.includes('Rated')) {
      cleanTitle = cleanTitle.split('Rated')[0].trim();
    }
    
    // Extract just the date part from the timestamp
    const extractionDate = review.extractedAt ? 
      formatDateForCsv(review.extractedAt.split('T')[0]) : 
      formatDateForCsv(new Date().toISOString().split('T')[0]);
    
    const row = [
      escapeCsvField(review.productName || 'Unknown Product'),
      escapeCsvField(review.rating || '5'),
      escapeCsvField(reviewDate),
      escapeCsvField(review.inDateRange === false ? 'No' : 'Yes'),
      escapeCsvField(cleanTitle),
      escapeCsvField(review.text || ''),
      escapeCsvField(extractionDate)
    ];
    
    csvContent += row.join(',') + '\r\n';
  }
  
  return csvContent;
}

/**
 * Add site type to reviews based on URL
 * @param {Array} reviews - The reviews to process
 * @param {string} url - The URL of the product
 * @returns {Array} - The processed reviews
 */
function addSiteTypeToReviews(reviews, url) {
  let siteType = 'unknown';
  
  if (url.includes('tesco.com')) {
    siteType = 'tesco';
  } else if (url.includes('sainsburys.co.uk')) {
    siteType = 'sainsburys';
  } else if (url.includes('asda.com')) {
    siteType = 'asda';
  } else if (url.includes('morrisons.com')) {
    siteType = 'morrisons';
  }
  
  return reviews.map(review => ({
    ...review,
    siteType: review.siteType || siteType
  }));
}

/**
 * Add product information to reviews
 * @param {Array} reviews - The reviews to process
 * @param {string} url - The URL of the product
 * @returns {Array} - The processed reviews
 */
function addProductInfoToReviews(reviews, url) {
  let productName = "Unknown Product";
  let productId = "unknown";
  
  try {
    // Extract product name from URL path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const domain = urlObj.hostname.toLowerCase();
    
    // Extract product ID
    productId = lastPart;
    
    // Special handling for ASDA URLs
    if (domain.includes('asda')) {
      // For ASDA, try to get a better product name from the path
      // The product name is usually in the second-to-last part
      if (pathParts.length >= 3) {
        const productNamePart = pathParts[pathParts.length - 2];
        productName = productNamePart
          .replace(/-/g, ' ')  // Replace hyphens with spaces
          .replace(/\d+g$/, '') // Remove weight suffix like 76g
          .replace(/\d+$/, '')  // Remove any trailing numbers
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim();
        
        // Capitalize first letter of each word
        productName = productName.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Add ASDA prefix
        productName = `ASDA ${productName}`;
      } else {
        // Fallback for ASDA
        productName = `ASDA Product ${lastPart}`;
      }
    } else {
      // Standard handling for other sites
      // Convert URL slug to readable name
      if (lastPart && lastPart.length > 0) {
        productName = lastPart
          .replace(/-/g, ' ')  // Replace hyphens with spaces
          .replace(/\d+g$/, '') // Remove weight suffix like 76g
          .replace(/\d+$/, '')  // Remove any trailing numbers
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim();
        
        // Capitalize first letter of each word
        productName = productName.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      // If we couldn't extract a clean name, use a generic one
      if (!productName || productName.length < 3) {
        productName = `Product from ${url}`;
      }
    }
  } catch (error) {
    console.log(`Could not extract product info from URL: ${error.message}`);
    productName = `Product from ${url}`;
  }
  
  return reviews.map(review => ({
    ...review,
    productId: review.productId || productId,
    productName: review.productName || productName,
    sourceUrl: review.sourceUrl || url
  }));
}

module.exports = {
  escapeCsvField,
  formatDateForCsv,
  generateCsvContent,
  addSiteTypeToReviews,
  addProductInfoToReviews
};
