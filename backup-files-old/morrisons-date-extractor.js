/**
 * Morrisons Date Extractor
 * 
 * This file contains a specialized function to extract dates from Morrisons reviews.
 * It can be imported and used in the main review-scraper-crawlee.js file.
 */

/**
 * Extracts the date from a Morrisons review element
 * @param {Object} page - The Playwright page object
 * @param {Object} reviewElement - The Playwright ElementHandle for the review
 * @param {Object} log - The logger object
 * @returns {Promise<string>} - The extracted date in YYYY-MM-DD format or empty string if not found
 */
async function extractMorrisonsDate(page, reviewElement, log) {
  try {
    // Take a screenshot of this specific review for debugging
    const screenshotBuffer = await reviewElement.screenshot();
    const fs = require('fs');
    const screenshotPath = `morrisons-review-${Date.now()}.png`;
    fs.writeFileSync(screenshotPath, screenshotBuffer);
    log.info(`Saved screenshot of review element to ${screenshotPath}`);

    // Get the full HTML of the review element for debugging
    const html = await reviewElement.evaluate(el => el.outerHTML);
    log.info(`FULL Review HTML: ${html}`);

    // DIRECT APPROACH: Extract the date using JavaScript in the page context
    const extractResult = await reviewElement.evaluate(el => {
      // Debug all spans in the review
      const allSpans = Array.from(el.querySelectorAll('span'));
      console.log(`Found ${allSpans.length} spans in review`);
      
      // Log all spans for debugging
      allSpans.forEach((span, index) => {
        console.log(`Span ${index}: class=${span.className}, text="${span.textContent.trim()}"`); 
      });
      
      // First try the exact class
      const dateSpans = Array.from(el.querySelectorAll('span._text_16wi0_1._text--s_16wi0_13'));
      console.log(`Found ${dateSpans.length} spans with exact class`);
      
      for (const span of dateSpans) {
        const text = span.textContent.trim();
        console.log(`Checking date span: "${text}"`);
        if (text.includes('Submitted')) {
          console.log(`FOUND DATE TEXT WITH EXACT CLASS: "${text}"`);
          
          // Extract the date using regex
          const match = text.match(/Submitted\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (match && match[1]) {
            const rawDate = match[1];
            console.log(`EXTRACTED DATE: ${rawDate}`);
            return { found: true, method: 'exact-class', text, date: rawDate };
          }
        }
      }
      
      // If not found with exact class, try any span
      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (text.includes('Submitted') && text.includes('/')) {
          console.log(`FOUND DATE TEXT IN GENERAL SPAN: "${text}"`);
          
          // Extract the date using regex
          const match = text.match(/Submitted\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (match && match[1]) {
            const rawDate = match[1];
            console.log(`EXTRACTED DATE FROM GENERAL SPAN: ${rawDate}`);
            return { found: true, method: 'general-span', text, date: rawDate };
          }
        }
      }
      
      // If still not found, look for any text that matches the date pattern
      const fullText = el.textContent;
      const dateMatch = fullText.match(/Submitted\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch && dateMatch[1]) {
        console.log(`FOUND DATE IN FULL TEXT: ${dateMatch[1]}`);
        return { found: true, method: 'full-text', text: dateMatch[0], date: dateMatch[1] };
      }
      
      return { found: false, method: 'none', text: 'No date found', date: null };
    });
    
    log.info(`Date extraction result: ${JSON.stringify(extractResult)}`);
    
    if (extractResult.found && extractResult.date) {
      // Convert to YYYY-MM-DD format
      const parts = extractResult.date.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        const formattedDate = `${year}-${month}-${day}`;
        log.info(`FINAL FORMATTED DATE: ${formattedDate} (from ${extractResult.date} via ${extractResult.method})`);
        return formattedDate;
      }
      log.info(`RETURNING RAW DATE: ${extractResult.date}`);
      return extractResult.date;
    }
    
    return '';
  } catch (e) {
    log.error(`ERROR in Morrisons date extractor: ${e.message}\n${e.stack}`);
    return '';
  }
}

module.exports = { extractMorrisonsDate };
