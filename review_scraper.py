const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const ora = require('ora');
const chalk = require('chalk');
const ExcelJS = require('exceljs');

// Add the stealth plugin to puppeteer (this helps avoid detection)
puppeteer.use(StealthPlugin());

// Setup command line interface
program
  .version('1.0.0')
  .description('Advanced Review Scraper for E-commerce Sites')
  .option('-u, --url <url>', 'URL of the product page to scrape')
  .option('-o, --output <path>', 'Output file path (CSV or XLSX)', 'reviews.xlsx')
  .option('-p, --proxy <proxy>', 'Proxy to use (e.g. http://user:pass@host:port)')
  .option('-m, --max-reviews <number>', 'Maximum number of reviews to collect', parseInt, 50)
  .option('-d, --delay <ms>', 'Delay between actions in ms', parseInt, 1000)
  .option('-t, --timeout <ms>', 'Page load timeout in ms', parseInt, 30000)
  .option('-v, --visible', 'Run in visible browser mode (not headless)')
  .parse(process.argv);

const options = program.opts();

// Helper function to add random delays
const randomDelay = async (min, max) => {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
  return delay;
};

// Main scraping function
async function scrapeReviews() {
  const spinner = ora('Initializing scraper...').start();
  let browser;
  
  try {
    // Detect site type from URL
    const url = options.url;
    if (!url) {
      throw new Error('Please provide a URL with the --url option');
    }
    
    const domain = new URL(url).hostname;
    spinner.text = `Detected domain: ${domain}`;
    
    // Configure browser launch options
    const launchOptions = {
      headless: !options.visible,
      executablePath: executablePath(),
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    };
    
    // Add proxy if provided
    if (options.proxy) {
      launchOptions.args.push(`--proxy-server=${options.proxy}`);
    }
    
    // Launch the browser
    spinner.text = 'Launching browser...';
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Set navigation timeout
    page.setDefaultNavigationTimeout(options.timeout);
    
    // Add additional headers and browser fingerprinting
    await page.evaluateOnNewDocument(() => {
      // Overwrite the navigator properties
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      
      // Fake plugins and MIME types
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/pdf"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          }
        ]
      });
      
      // Fake languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'es'],
      });
      
      // Fake platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });
    });
    
    // Randomize viewport size slightly (within desktop ranges)
    const viewportWidth = 1440 + Math.floor(Math.random() * 480);
    const viewportHeight = 900 + Math.floor(Math.random() * 300);
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight
    });
    
    // Navigate to the product page
    spinner.text = `Navigating to ${url}...`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to be fully loaded
    await randomDelay(2000, 4000);
    
    // Handle cookie consent popups
    spinner.text = 'Handling cookie notices...';
    await handleCookieNotices(page);
    
    // Find and interact with reviews section
    spinner.text = 'Looking for reviews section...';
    const reviewSectionFound = await findAndClickReviewsSection(page);
    
    if (!reviewSectionFound) {
      spinner.info('No specific reviews section found, trying to extract reviews directly');
    }
    
    // Extract reviews based on the detected site
    spinner.text = 'Extracting reviews...';
    let reviews = [];
    
    if (domain.includes('amazon')) {
      reviews = await scrapeAmazonReviews(page, options.maxReviews);
    } else if (domain.includes('walmart')) {
      reviews = await scrapeWalmartReviews(page, options.maxReviews);
    } else if (domain.includes('bestbuy')) {
      reviews = await scrapeBestBuyReviews(page, options.maxReviews);
    } else {
      // Generic scraping approach for other sites
      reviews = await scrapeGenericReviews(page, options.maxReviews);
    }
    
    spinner.succeed(`Successfully extracted ${reviews.length} reviews`);
    
    // Save the reviews
    await saveReviews(reviews, options.output);
    
    console.log(chalk.green.bold(`\n✓ Saved ${reviews.length} reviews to ${options.output}`));
    
    // Display a sample of reviews
    console.log(chalk.yellow('\nSample of extracted reviews:'));
    reviews.slice(0, 3).forEach((review, i) => {
      console.log(chalk.cyan(`\nReview #${i+1}:`));
      console.log(`Rating: ${review.rating}`);
      console.log(`Date: ${review.date}`);
      console.log(`Text: ${review.text.substring(0, 150)}${review.text.length > 150 ? '...' : ''}`);
    });
    
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
    console.error(error);
  } finally {
    if (browser) {
      spinner.text = 'Closing browser...';
      await browser.close();
      spinner.succeed('Browser closed');
    }
  }
}

// Helper function to handle cookie consent popups
async function handleCookieNotices(page) {
  try {
    // Common cookie consent button selectors
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      '.accept-cookies',
      'button[aria-label*="Accept"]',
      'button[aria-label*="accept"]',
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("Allow all")',
      'button:has-text("I accept")',
      'button[data-testid*="cookie-accept"]',
      '.cookie-banner button',
      '#cookie-banner button'
    ];
    
    for (const selector of cookieSelectors) {
      if (await page.$(selector)) {
        await page.click(selector).catch(() => {});
        await randomDelay(500, 1500);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn('Error handling cookie notices:', error.message);
    return false;
  }
}

// Helper function to find and click on reviews section
async function findAndClickReviewsSection(page) {
  try {
    // Common review section selectors
    const reviewTabSelectors = [
      // Text-based selectors
      'a:has-text("Customer Reviews")',
      'a:has-text("Reviews")',
      'button:has-text("Reviews")',
      'a:has-text("Ratings & Reviews")',
      
      // Common ID and class based selectors
      '#reviews-tab',
      '.reviews-tab',
      '[data-tab="reviews"]',
      '[data-target="#reviews"]',
      '[href="#reviews"]',
      '[aria-controls="reviews"]',
      
      // Site-specific selectors
      '.review-link',
      '.product-reviews-tab',
      '.pr-snippet-read-reviews',
      '.bv-rating-ratio',
      '.ratings-reviews'
    ];
    
    for (const selector of reviewTabSelectors) {
      if (await page.$(selector)) {
        // Scroll to the element first
        await page.evaluate(selector => {
          const element = document.querySelector(selector);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, selector);
        
        await randomDelay(500, 1500);
        
        // Click the element
        await page.click(selector).catch(() => {});
        await randomDelay(1500, 3000);
        return true;
      }
    }
    
    // If no specific tab is found, just scroll to where reviews likely are
    await page.evaluate(() => {
      window.scrollTo({
        top: document.body.scrollHeight * 0.7,
        behavior: 'smooth'
      });
    });
    
    await randomDelay(1000, 2000);
    return false;
    
  } catch (error) {
    console.warn('Error finding reviews section:', error.message);
    return false;
  }
}

// Handle "Load More" buttons for reviews
async function clickLoadMoreReviews(page) {
  try {
    // Common "Load More" button selectors
    const loadMoreSelectors = [
      // Text-based selectors
      'button:has-text("Load More")',
      'button:has-text("See More")',
      'button:has-text("Show More")',
      'a:has-text("Load More")',
      'a:has-text("See More")',
      
      // Common attribute-based selectors
      '[data-hook="load-more-button"]',
      '.load-more-button',
      '.show-more-reviews',
      '.reviews-load-more',
      '.bv-content-btn-pages-load-more',
      '.see-more-reviews',
      '#reviews-load-more'
    ];
    
    let loadMoreClicked = false;
    let clickCount = 0;
    const maxClicks = 5; // Limit to prevent infinite loops
    
    while (clickCount < maxClicks) {
      let buttonFound = false;
      
      for (const selector of loadMoreSelectors) {
        const buttonVisible = await page.evaluate((selector) => {
          const button = document.querySelector(selector);
          if (!button) return false;
          
          const rect = button.getBoundingClientRect();
          return rect.top >= 0 && rect.left >= 0 && 
                 rect.bottom <= window.innerHeight && 
                 rect.right <= window.innerWidth;
        }, selector);
        
        if (buttonVisible) {
          // Scroll to the button
          await page.evaluate(selector => {
            const element = document.querySelector(selector);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, selector);
          
          await randomDelay(1000, 2000);
          
          try {
            await page.click(selector);
            buttonFound = true;
            loadMoreClicked = true;
            clickCount++;
            await randomDelay(2000, 4000); // Longer delay to allow content to load
            break;
          } catch (err) {
            console.warn(`Could not click "${selector}": ${err.message}`);
          }
        }
      }
      
      if (!buttonFound) break;
    }
    
    return loadMoreClicked;
  } catch (error) {
    console.warn('Error clicking load more button:', error.message);
    return false;
  }
}

// Amazon-specific review scraping
async function scrapeAmazonReviews(page, maxReviews = 50) {
  const reviews = [];
  
  try {
    // Expand all review content first (click on "Read more" links)
    const expandButtons = await page.$$('[data-hook="expand-collapse-read-more"]');
    for (const button of expandButtons) {
      try {
        await button.click();
        await randomDelay(300, 800);
      } catch (e) {
        // Ignore click errors
      }
    }
    
    // Load more reviews if available
    await clickLoadMoreReviews(page);
    
    // Extract reviews
    const reviewElements = await page.$$('[data-hook="review"]');
    
    for (const reviewElement of reviewElements.slice(0, maxReviews)) {
      try {
        const review = await page.evaluate(el => {
          const ratingElement = el.querySelector('[data-hook="review-star-rating"]');
          const rating = ratingElement ? ratingElement.textContent.trim().split(' ')[0] : 'N/A';
          
          const titleElement = el.querySelector('[data-hook="review-title"]');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const dateElement = el.querySelector('[data-hook="review-date"]');
          const date = dateElement ? dateElement.textContent.trim() : 'N/A';
          
          const textElement = el.querySelector('[data-hook="review-body"]');
          const text = textElement ? textElement.textContent.trim() : '';
          
          const verifiedElement = el.querySelector('[data-hook="avp-badge"]');
          const verified = verifiedElement ? true : false;
          
          return { rating, title, date, text, verified };
        }, reviewElement);
        
        reviews.push(review);
      } catch (error) {
        console.warn('Error extracting review:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error in Amazon reviews scraping:', error);
  }
  
  return reviews;
}

// Walmart-specific review scraping
async function scrapeWalmartReviews(page, maxReviews = 50) {
  const reviews = [];
  
  try {
    // Click on "Customer Reviews" section if it's not already active
    await page.evaluate(() => {
      const reviewsTab = document.querySelector('button:has-text("Customer Reviews")');
      if (reviewsTab) reviewsTab.click();
    });
    
    await randomDelay(2000, 3000);
    
    // Load more reviews if available
    await clickLoadMoreReviews(page);
    
    // Extract reviews
    const reviewElements = await page.$$('.review-card');
    
    for (const reviewElement of reviewElements.slice(0, maxReviews)) {
      try {
        const review = await page.evaluate(el => {
          const ratingElement = el.querySelector('.stars-container');
          const rating = ratingElement ? 
            ratingElement.getAttribute('aria-label').replace('stars', '').trim() : 'N/A';
          
          const titleElement = el.querySelector('.review-title');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const dateElement = el.querySelector('.review-date');
          const date = dateElement ? dateElement.textContent.trim() : 'N/A';
          
          const textElement = el.querySelector('.review-text');
          const text = textElement ? textElement.textContent.trim() : '';
          
          const verifiedElement = el.querySelector('.verified-purchaser-badge');
          const verified = verifiedElement ? true : false;
          
          return { rating, title, date, text, verified };
        }, reviewElement);
        
        reviews.push(review);
      } catch (error) {
        console.warn('Error extracting Walmart review:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error in Walmart reviews scraping:', error);
  }
  
  return reviews;
}

// Best Buy-specific review scraping
async function scrapeBestBuyReviews(page, maxReviews = 50) {
  const reviews = [];
  
  try {
    // Click on "Reviews" tab if it exists
    await page.evaluate(() => {
      const reviewsTab = document.querySelector('.reviews-tab,.v-tab:has-text("Reviews")');
      if (reviewsTab) reviewsTab.click();
    });
    
    await randomDelay(2000, 3000);
    
    // Load more reviews if available
    await clickLoadMoreReviews(page);
    
    // Extract reviews
    const reviewElements = await page.$$('.review-item,.user-review');
    
    for (const reviewElement of reviewElements.slice(0, maxReviews)) {
      try {
        const review = await page.evaluate(el => {
          const ratingElement = el.querySelector('.c-review-rating');
          const rating = ratingElement ? 
            ratingElement.getAttribute('aria-label').replace(/[^0-9.]/g, '') : 'N/A';
          
          const titleElement = el.querySelector('.c-review-title,.review-title');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const dateElement = el.querySelector('.submission-date,.review-date');
          const date = dateElement ? dateElement.textContent.trim() : 'N/A';
          
          const textElement = el.querySelector('.c-review-content,.review-content');
          const text = textElement ? textElement.textContent.trim() : '';
          
          const verifiedElement = el.querySelector('.verified-purchaser');
          const verified = verifiedElement ? true : false;
          
          return { rating, title, date, text, verified };
        }, reviewElement);
        
        reviews.push(review);
      } catch (error) {
        console.warn('Error extracting Best Buy review:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error in Best Buy reviews scraping:', error);
  }
  
  return reviews;
}

// Generic review scraping for other sites
async function scrapeGenericReviews(page, maxReviews = 50) {
  const reviews = [];
  
  try {
    // Try to scroll down to load all reviews
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight || totalHeight > 10000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await randomDelay(2000, 3000);
    
    // Try to load more reviews
    await clickLoadMoreReviews(page);
    
    // Common review container selectors
    const reviewSelectors = [
      '.review', 
      '.review-item', 
      '[data-hook="review"]', 
      '.product-review', 
      '.user-review',
      '.feedback',
      '.comment',
      'div[class*="review"]',
      'div[id*="review"]',
      'li[class*="review"]',
      '.ratings-reviews-item'
    ];
    
    // Find valid review containers
    let reviewElements = [];
    
    for (const selector of reviewSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        reviewElements = elements;
        console.log(`Found ${elements.length} reviews with selector: ${selector}`);
        break;
      }
    }
    
    // Extract reviews from the found containers
    for (const reviewElement of reviewElements.slice(0, maxReviews)) {
      try {
        const review = await page.evaluate(el => {
          // Try to find rating
          let rating = 'N/A';
          const ratingSelectors = [
            '.rating', '.stars', '[itemprop="ratingValue"]',
            '.score', '.review-rating', '.star-rating',
            'span[class*="star"]', 'div[class*="star"]'
          ];
          
          for (const selector of ratingSelectors) {
            const ratingElement = el.querySelector(selector);
            if (ratingElement) {
              // Try to extract a number from the rating element
              const ratingText = ratingElement.textContent.trim();
              const ratingMatch = ratingText.match(/(\d+(\.\d+)?)/);
              if (ratingMatch) {
                rating = ratingMatch[0];
                break;
              } else if (ratingElement.getAttribute('style')) {
                // Try to extract rating from width percentage in style
                const styleMatch = ratingElement.getAttribute('style').match(/width:\s*(\d+)%/);
                if (styleMatch) {
                  const percentage = parseInt(styleMatch[1]);
                  rating = (percentage / 20).toFixed(1); // Assume 100% = 5 stars
                  break;
                }
              }
            }
          }
          
          // Try to count visible stars if no numeric rating found
          if (rating === 'N/A') {
            const stars = el.querySelectorAll('.fa-star, .filled-stars, .Icon--star-fill');
            if (stars.length > 0) {
              rating = stars.length.toString();
            }
          }
          
          // Try to find review title
          let title = '';
          const titleSelectors = [
            '.review-title', '[itemprop="name"]', '.title',
            'h3', 'h4', '.review-heading'
          ];
          
          for (const selector of titleSelectors) {
            const titleElement = el.querySelector(selector);
            if (titleElement) {
              title = titleElement.textContent.trim();
              break;
            }
          }
          
          // Try to find review date
          let date = 'N/A';
          const dateSelectors = [
            '.date', '.review-date', '[itemprop="datePublished"]',
            '.timestamp', 'time', '.published-date', '.submit-date'
          ];
          
          for (const selector of dateSelectors) {
            const dateElement = el.querySelector(selector);
            if (dateElement) {
              date = dateElement.textContent.trim();
              // Also try the datetime attribute
              if (!date && dateElement.hasAttribute('datetime')) {
                date = dateElement.getAttribute('datetime');
              }
              break;
            }
          }
          
          // Try to find review text
          let text = '';
          const textSelectors = [
            '.review-text', '.review-content', '[itemprop="reviewBody"]',
            '.description', '.comment-text', '.review-body', 'p'
          ];
          
          for (const selector of textSelectors) {
            const textElements = el.querySelectorAll(selector);
            if (textElements.length > 0) {
              // Combine all paragraphs
              text = Array.from(textElements)
                .map(elem => elem.textContent.trim())
                .filter(t => t.length > 0)
                .join(' ');
              
              if (text) break;
            }
          }
          
          // If no specific text element found, use the container text
          if (!text) {
            text = el.textContent.trim();
            
            // Try to clean up the text by removing the title, date, etc.
            if (title) text = text.replace(title, '');
            if (date !== 'N/A') text = text.replace(date, '');
            if (rating !== 'N/A') text = text.replace(rating, '');
            
            // Clean up whitespace
            text = text.replace(/\s+/g, ' ').trim();
          }
          
          return { rating, title, date, text, verified: false };
        }, reviewElement);
        
        if (review.text && review.text.length > 10) {
          reviews.push(review);
        }
      } catch (error) {
        console.warn('Error extracting generic review:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error in generic reviews scraping:', error);
  }
  
  return reviews;
}

// Save the reviews to a file
async function saveReviews(reviews, outputPath) {
  try {
    const ext = path.extname(outputPath).toLowerCase();
    
    if (ext === '.csv') {
      // Save as CSV
      let csv = 'Rating,Date,Verified,Title,Text\n';
      
      for (const review of reviews) {
        // Escape CSV fields properly
        const escapeCsv = (field) => {
          if (field === undefined || field === null) return '';
          const str = String(field).replace(/"/g, '""');
          return `"${str}"`;
        };
        
        csv += `${escapeCsv(review.rating)},${escapeCsv(review.date)},${escapeCsv(review.verified)},${escapeCsv(review.title)},${escapeCsv(review.text)}\n`;
      }
      
      fs.writeFileSync(outputPath, csv, 'utf8');
      
    } else {
      // Default to Excel (XLSX)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reviews');
      
      // Add columns
      worksheet.columns = [
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Verified', key: 'verified', width: 10 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Text', key: 'text', width: 100 }
      ];
      
      // Add rows
      worksheet.addRows(reviews);
      
      // Save to file
      await workbook.xlsx.writeFile(outputPath);
    }
    
    return true;
    
  } catch (error) {
    console.error('Error saving reviews:', error);
    return false;
  }
}

// Execute the main function if this script is run directly
if (require.main === module) {
  scrapeReviews();
}

module.exports = { scrapeReviews };