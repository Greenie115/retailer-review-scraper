/**
 * Morrisons Date Extractor
 * 
 * This file contains a function to extract dates from Morrisons reviews.
 * Copy and paste this function into your review-scraper-crawlee.js file.
 */

// Add this function to your parseReviewDate function in review-scraper-crawlee.js
// or modify your existing parseReviewDate function to include this logic:

function parseReviewDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') {
    return new Date(); // Default to current date if no date available
  }

  // Special handling for Morrisons "Submitted DD/MM/YYYY, by Author" format
  const morrisonsMatch = dateStr.match(/Submitted\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (morrisonsMatch) {
    const [_, day, month, year] = morrisonsMatch;
    console.log(`Parsed Morrisons date: day=${day}, month=${month}, year=${year}`);
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try direct parsing (ISO format: YYYY-MM-DD)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try UK format (DD/MM/YYYY or DD-MM-YYYY)
  const ukMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ukMatch) {
    const [_, day, month, year] = ukMatch;
    // Handle 2-digit years
    let fullYear = parseInt(year);
    if (fullYear < 100) {
      fullYear += fullYear < 50 ? 2000 : 1900;
    }
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  // Try US format (MM/DD/YYYY)
  const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    const [_, month, day, year] = usMatch;
    // Handle 2-digit years
    let fullYear = parseInt(year);
    if (fullYear < 100) {
      fullYear += fullYear < 50 ? 2000 : 1900;
    }
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }

  // Try text month format (DD Month YYYY or Month DD, YYYY)
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthNames = months.join('|');

  // Format: 25 December 2022 or 25th December 2022
  const textMatch1 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)? (${monthNames}) (\\d{4})`, 'i').exec(dateStr);
  if (textMatch1) {
    const [_, day, month, year] = textMatch1;
    const monthIndex = months.findIndex(m => m.toLowerCase() === month.toLowerCase());
    if (monthIndex !== -1) {
      return new Date(parseInt(year), monthIndex, parseInt(day));
    }
  }

  // Format: December 25, 2022
  const textMatch2 = new RegExp(`(${monthNames}) (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})`, 'i').exec(dateStr);
  if (textMatch2) {
    const [_, month, day, year] = textMatch2;
    const monthIndex = months.findIndex(m => m.toLowerCase() === month.toLowerCase());
    if (monthIndex !== -1) {
      return new Date(parseInt(year), monthIndex, parseInt(day));
    }
  }

  // Try relative dates (e.g., "2 days ago", "1 month ago")
  const relativeMatch = dateStr.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/);
  if (relativeMatch) {
    const [_, amount, unit] = relativeMatch;
    const now = new Date();
    const value = parseInt(amount);

    switch(unit.toLowerCase()) {
      case 'day':
      case 'days':
        now.setDate(now.getDate() - value);
        break;
      case 'week':
      case 'weeks':
        now.setDate(now.getDate() - (value * 7));
        break;
      case 'month':
      case 'months':
        now.setMonth(now.getMonth() - value);
        break;
      case 'year':
      case 'years':
        now.setFullYear(now.getFullYear() - value);
        break;
    }

    return now;
  }

  // If all else fails, try to extract any year, month, day from the string
  const yearMatch = dateStr.match(/(20\d{2})/);
  if (yearMatch) {
    // If we at least have a year, use January 1st of that year
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }

  // If we can't parse the date at all, return current date
  return new Date();
}
