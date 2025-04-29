// Utility functions for URL handling and retailer detection

/**
 * Detects the retailer from a URL
 * @param {string} url - The URL to analyze
 * @returns {string} - The detected retailer (tesco, sainsburys, asda, morrisons, or unknown)
 */
function detectRetailerFromUrl(url) {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('tesco.com')) {
    return 'tesco';
  } else if (lowerUrl.includes('sainsburys.co.uk')) {
    return 'sainsburys';
  } else if (lowerUrl.includes('asda.com')) {
    return 'asda';
  } else if (lowerUrl.includes('morrisons.com')) {
    return 'morrisons';
  } else {
    return 'unknown';
  }
}

/**
 * Extracts product information from a URL
 * @param {string} url - The URL to analyze
 * @returns {Object} - Object containing productId and productName
 */
function extractProductInfoFromUrl(url) {
  try {
    // Extract product name from URL or use a generic name
    let productName = "Unknown Product";
    let productId = "unknown";
    
    // Extract product name from URL path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const domain = urlObj.hostname.toLowerCase();
    
    // Extract product ID
    productId = lastPart || "unknown";
    
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
      
      // Add retailer prefix
      const retailer = detectRetailerFromUrl(url);
      if (retailer !== 'unknown') {
        productName = `${retailer.charAt(0).toUpperCase() + retailer.slice(1)} ${productName}`;
      }
    }
    
    return { productId, productName };
  } catch (error) {
    console.log(`Could not extract product info from URL: ${error.message}`);
    return { 
      productId: "unknown", 
      productName: `Product from ${url}` 
    };
  }
}

/**
 * Creates a unique identifier for a review to help with deduplication
 * @param {Object} review - The review object
 * @returns {string} - A unique identifier for the review
 */
function createReviewUniqueId(review) {
  // Create a unique ID based on title and text content
  const titlePart = review.title ? review.title.substring(0, 30) : '';
  const textPart = review.text ? review.text.substring(0, 50) : '';
  return `${titlePart}-${textPart}`.replace(/\s+/g, '-').toLowerCase();
}

module.exports = {
  detectRetailerFromUrl,
  extractProductInfoFromUrl,
  createReviewUniqueId
};
