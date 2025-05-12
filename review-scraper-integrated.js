const { PlaywrightCrawler, log } = require('crawlee');
const { parseDate } = require('chrono-node');
const urlUtils = require('./url-utils');
const axios = require('axios');

// Import retailer-specific handlers from checkpoint directory
const { handleTescoSite } = require('./checkpoint/tesco-handler-new');
const { handleSainsburysSite } = require('./checkpoint/sainsburys-handler-new');
const { handleAsdaSite } = require('./checkpoint/asda-handler-new');
const { handleMorrisonsSite } = require('./checkpoint/morrisons-handler-new');

// Global arrays to store reviews for each retailer
global.tescoReviews = [];
global.sainsburysReviews = [];
global.asdaReviews = [];
global.morrisonsReviews = [];
global.icelandReviews = [];

// Main function to extract reviews
async function extractReviews(page, url, maxReviews = 50) {
  log.info(`Starting review extraction for URL: ${url}`);

  // Determine which retailer's site we're on using the urlUtils module
  const retailer = urlUtils.detectRetailerFromUrl(url);
  log.info(`Detected retailer: ${retailer}`);

  // Configure site-specific settings
  const siteConfig = {
    log: log,
    retailer: retailer
  };

  // Handle the site based on the retailer
  let reviews = [];

  try {
    switch (retailer) {
      case 'tesco':
        log.info('Using Tesco specific handler');
        reviews = await handleTescoSite(page, siteConfig, maxReviews);
        break;
      case 'sainsburys':
        log.info('Using Sainsbury\'s specific handler');
        reviews = await handleSainsburysSite(page, siteConfig, maxReviews);
        break;
      case 'asda':
        log.info('Using ASDA specific handler');
        reviews = await handleAsdaSite(page, siteConfig, maxReviews);
        break;
      case 'morrisons':
        log.info('Using Morrisons specific handler');
        reviews = await handleMorrisonsSite(page, siteConfig, maxReviews);
        break;
      case 'iceland':
        log.warning(`Iceland handler not implemented yet, using generic handler`);
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
        break;
      default:
        log.warning(`Unknown retailer for URL: ${url}`);
        // Try a generic approach
        reviews = await handleGenericSite(page, siteConfig, maxReviews);
    }

    log.info(`Extracted ${reviews.length} reviews from ${retailer} site`);
    return reviews;
  } catch (error) {
    log.error(`Error extracting reviews: ${error.message}\n${error.stack}`);
    return [];
  }
}

// Helper function to scroll down the page
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// Helper function to parse dates
function parseReviewDate(dateStr) {
  if (!dateStr || dateStr === 'Unknown date') {
    return new Date();
  }

  try {
    // Check if the date is already in DD/MM/YYYY format
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmmyyyyMatch = dateStr.match(ddmmyyyyRegex);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1]);
      const month = parseInt(ddmmyyyyMatch[2]) - 1; // JS months are 0-indexed
      const year = parseInt(ddmmyyyyMatch[3]);
      return new Date(year, month, day);
    }

    // Try to parse the date using chrono
    const parsedDate = parseDate(dateStr);
    if (parsedDate) {
      return parsedDate;
    }
  } catch (e) {
    log.warning(`Error parsing date "${dateStr}": ${e.message}`);
  }

  // If we can't parse the date at all, return current date
  return new Date();
}

// Generic handler for unknown sites
async function handleGenericSite(page, siteConfig, maxReviews) {
  const log = siteConfig.log;
  log.info('Using generic handler');
  
  try {
    // Look for common review containers
    const reviews = await page.evaluate(() => {
      const results = [];
      
      // Try to find review containers using common selectors
      const reviewContainers = document.querySelectorAll('.review, .product-review, [class*="review"], [id*="review"], [data-testid*="review"]');
      console.log(`Found ${reviewContainers.length} review containers`);
      
      // Process each review container
      for (const container of reviewContainers) {
        try {
          // Extract rating
          let rating = '5'; // Default to 5 stars
          const ratingElement = container.querySelector('.rating, .stars, [class*="rating"], [class*="stars"]');
          if (ratingElement) {
            const ratingText = ratingElement.textContent.trim();
            const ratingMatch = ratingText.match(/\d+/);
            if (ratingMatch) {
              rating = ratingMatch[0];
            }
          }
          
          // Extract title
          let title = '';
          const titleElement = container.querySelector('.title, .review-title, h3, h4, [class*="title"]');
          if (titleElement) {
            title = titleElement.textContent.trim();
          }
          
          // Extract date
          let date = '';
          const dateElement = container.querySelector('.date, .review-date, time, [class*="date"]');
          if (dateElement) {
            date = dateElement.textContent.trim();
          }
          
          // Extract review text
          let text = '';
          const textElement = container.querySelector('.text, .review-text, .content, p, [class*="text"], [class*="content"]');
          if (textElement) {
            text = textElement.textContent.trim();
          }
          
          // Only add if we have meaningful text
          if (text) {
            results.push({ rating, title, date, text });
          }
        } catch (e) {
          console.error('Error processing review container:', e);
        }
      }
      
      return results;
    });
    
    log.info(`Extracted ${reviews.length} reviews using generic method`);
    return reviews;
  } catch (error) {
    log.error(`Error in generic review extraction: ${error.message}`);
    return [];
  }
}

// Function to try using the local browser service
async function tryLocalBrowserService(url, options = {}) {
  const retailer = urlUtils.detectRetailerFromUrl(url);
  
  // Only use local browser service for Morrisons and Sainsburys
  if (retailer !== 'morrisons' && retailer !== 'sainsburys') {
    return null;
  }
  
  log.info(`Attempting to use local browser service for ${retailer} URL: ${url}`);
  
  try {
    // Try to connect to the local browser service
    const response = await axios.post('http://localhost:3002/scrape-with-visible-browser', {
      url,
      retailer,
      options
    }, {
      timeout: 30000 // 30 second timeout
    });
    
    if (response.status === 200 && response.data && response.data.reviews) {
      log.info(`Successfully retrieved ${response.data.reviews.length} reviews from local browser service`);
      
      // Add metadata to reviews
      const { productId, productName } = urlUtils.extractProductInfoFromUrl(url);
      const now = new Date();
      
      const reviews = response.data.reviews.map(review => ({
        ...review,
        extractedAt: now.toISOString(),
        sourceUrl: url,
        siteType: retailer,
        productId: productId,
        productName: productName,
        // Generate a unique ID for deduplication
        uniqueId: urlUtils.createReviewUniqueId({
          ...review,
          sourceUrl: url,
          siteType: retailer
        })
      }));
      
      // Add date parsing and filtering
      reviews.forEach(review => {
        if (review.date && review.date !== 'Unknown date') {
          try {
            // Parse the date using our helper function
            const parsedDate = parseReviewDate(review.date);
            review.parsedDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format

            // Check if the review is within the specified date range
            let inRange = true;
            if (options.dateFrom) {
              const fromDate = new Date(options.dateFrom);
              inRange = inRange && parsedDate >= fromDate;
            }
            if (options.dateTo) {
              const toDate = new Date(options.dateTo);
              toDate.setHours(23, 59, 59, 999); // End of the day
              inRange = inRange && parsedDate <= toDate;
            }
            review.inDateRange = inRange;
          } catch (e) {
            log.warning(`Error parsing date "${review.date}": ${e.message}`);
            review.parsedDate = null;
            review.inDateRange = false;
          }
        } else {
          review.parsedDate = null;
          review.inDateRange = false;
        }
      });
      
      return reviews;
    }
    
    log.info('Local browser service returned invalid response');
    return null;
  } catch (error) {
    log.error(`Error using local browser service: ${error.message}`);
    log.info('Falling back to regular scraper');
    return null;
  }
}

// Main scraper function that will be called from server.js
async function scrapeReviews(url, options = {}) {
  log.info(`Starting scrapeReviews for URL: ${url}`);
  log.info(`Options: ${JSON.stringify(options)}`);

  // Determine which retailer's site we're on
  const retailer = urlUtils.detectRetailerFromUrl(url);
  
  // For Morrisons and Sainsburys, try the local browser service first
  if (retailer === 'morrisons' || retailer === 'sainsburys') {
    try {
      const localBrowserReviews = await tryLocalBrowserService(url, options);
      if (localBrowserReviews && localBrowserReviews.length > 0) {
        log.info(`Using ${localBrowserReviews.length} reviews from local browser service for ${retailer}`);
        return localBrowserReviews;
      }
      log.info(`Local browser service didn't return reviews for ${retailer}, falling back to headless browser`);
    } catch (localBrowserError) {
      log.error(`Error with local browser service: ${localBrowserError.message}`);
      log.info('Falling back to headless browser');
    }
  }

  try {
    // Directly use the extractReviews function without the crawler
    // This simplifies the process and ensures we get the reviews
    const { chromium } = require('playwright');

    // Determine if we should run in headless mode
    const isProduction = process.env.NODE_ENV === 'production';
    
    // For Morrisons and Sainsbury's, use non-headless mode even in production if Xvfb is available
    const isXvfbAvailable = process.env.DISPLAY && process.env.DISPLAY.startsWith(':');
    const isMorrisonsOrSainsburys = retailer === 'morrisons' || retailer === 'sainsburys';
    
    // Use headless mode unless:
    // 1. We're in development and HEADLESS is not 'true', or
    // 2. We're scraping Morrisons or Sainsbury's and Xvfb is available
    const headlessMode = (isProduction && !(isMorrisonsOrSainsburys && isXvfbAvailable)) || 
                         process.env.HEADLESS === 'true';

    log.info(`Running in ${headlessMode ? 'headless' : 'visible'} mode (NODE_ENV: ${process.env.NODE_ENV || 'not set'}, DISPLAY: ${process.env.DISPLAY || 'not set'})`);
    log.info(`Retailer: ${retailer}, Using Xvfb: ${isMorrisonsOrSainsburys && isXvfbAvailable}`);

    // Launch a browser with additional options for production environment
    console.log(`DEBUGGING: Launching browser with headless=${headlessMode}`);
    console.log(`DEBUGGING: PUPPETEER_EXECUTABLE_PATH=${process.env.PUPPETEER_EXECUTABLE_PATH || 'undefined'}`);
    console.log(`DEBUGGING: NODE_ENV=${process.env.NODE_ENV || 'undefined'}`);
    
    // Enhanced browser configuration to bypass security measures
    // Use different configurations based on the retailer
    const detectedRetailer = urlUtils.detectRetailerFromUrl(url);
    
    // Set up browser launch options with advanced anti-detection measures
    const launchOptions = {
      headless: headlessMode,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-http2',
        '--window-size=1280,800',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--enable-features=NetworkService',
        // Advanced anti-detection measures
        '--disable-blink-features=AutomationControlled',
        '--disable-features=AutomationControlled',
        // Random window size to appear more human-like
        `--window-size=${1200 + Math.floor(Math.random() * 100)},${800 + Math.floor(Math.random() * 100)}`,
        // Disable automation flags
        '--disable-automation',
        // Additional flags for Tesco specifically
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-first-run',
        '--password-store=basic',
        '--use-mock-keychain',
        '--hide-scrollbars',
        '--mute-audio'
      ]
    };
    
    // Add specific user agent for different retailers
    if (detectedRetailer === 'tesco') {
      // Use a very recent Chrome version for Tesco
      launchOptions.args.push('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    } else {
      // Use a standard user agent for other retailers
      launchOptions.args.push('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    }
    
    const browser = await chromium.launch(launchOptions);
    
    console.log('DEBUGGING: Browser launched successfully');
    
    // Enhanced browser context with additional configurations
    // Use different context options based on the retailer
    const contextOptions = {
      viewport: { 
        width: 1200 + Math.floor(Math.random() * 100), 
        height: 800 + Math.floor(Math.random() * 100) 
      },
      ignoreHTTPSErrors: true,
      deviceScaleFactor: 1,
      hasTouch: false,
      javaScriptEnabled: true,
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      permissions: ['geolocation'],
      // Add extra HTTP headers to appear more like a real browser
      extraHTTPHeaders: {
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    // Add specific user agent for different retailers
    if (detectedRetailer === 'tesco') {
      contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else {
      contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    }
    
    const context = await browser.newContext(contextOptions);
    
    // Add advanced anti-detection scripts
    await context.addInitScript(() => {
      // Overwrite the navigator properties to avoid detection
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Add fake plugins
      const mockPlugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client Executable' }
      ];

      // Create a more realistic plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = {
            length: mockPlugins.length,
            item: (index) => mockPlugins[index],
            namedItem: (name) => mockPlugins.find(plugin => plugin.name === name),
            refresh: () => {}
          };

          // Add array-like access to plugins
          for (let i = 0; i < mockPlugins.length; i++) {
            plugins[i] = mockPlugins[i];
          }

          return plugins;
        }
      });

      // Set realistic languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en-US', 'en'] });

      // Create a more realistic chrome object
      window.chrome = {
        runtime: {
          connect: () => ({}),
          sendMessage: () => {}
        },
        loadTimes: () => ({
          firstPaintTime: 0,
          firstPaintAfterLoadTime: 0,
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: Date.now() / 1000,
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
          npnNegotiatedProtocol: 'http/1.1',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'http/1.1'
        }),
        csi: () => ({ startE: Date.now(), onloadT: Date.now(), pageT: Date.now(), tran: 15 }),
        app: { isInstalled: false },
        webstore: { onInstallStageChanged: {}, onDownloadProgress: {} }
      };

      // Override permissions API
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => {
          if (parameters.name === 'notifications' || parameters.name === 'geolocation') {
            return Promise.resolve({ state: 'granted' });
          }
          return originalQuery(parameters);
        };
      }

      // Add fake media devices
      if (navigator.mediaDevices) {
        navigator.mediaDevices.enumerateDevices = () => Promise.resolve([
          { deviceId: 'default', kind: 'audioinput', label: 'Default - Internal Microphone', groupId: 'default' },
          { deviceId: 'default', kind: 'audiooutput', label: 'Default - Internal Speakers', groupId: 'default' },
          { deviceId: 'default', kind: 'videoinput', label: 'Default - Internal Webcam', groupId: 'default' }
        ]);
      }

      // Override WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      // Add window.outerWidth and window.outerHeight to make the window dimensions look realistic
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 100 });

      // Add fake screen properties
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

      // Add additional spoofing for other properties
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); // Spoof device memory
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); // Spoof hardware concurrency
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 }); // Spoof touch points
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '0' }); // Spoof Do Not Track
      Object.defineProperty(navigator, 'connection', { // Spoof network connection
        get: () => ({
          rtt: 50,
          type: 'wifi',
          effectiveType: '4g',
          downlink: 10,
          saveData: false
        })
      });

      // Spoof canvas fingerprinting
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
        if (type === 'image/png') {
          // Return a consistent, non-unique image data URL
          return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }
        return originalToDataURL.call(this, type, encoderOptions);
      };

      // Spoof WebGL fingerprinting
      const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      WebGLRenderingContext.prototype.getSupportedExtensions = function() {
        return [
          'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_half_float',
          'EXT_disjoint_timer_query', 'EXT_float_blend', 'EXT_frag_depth',
          'EXT_shader_texture_lod', 'EXT_sRGB', 'EXT_texture_filter_anisotropic',
          'OES_element_index_uint', 'OES_standard_derivatives', 'OES_texture_float',
          'OES_texture_float_linear', 'OES_texture_half_float', 'OES_texture_half_float_linear',
          'OES_vertex_array_object', 'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_astc',
          'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_s3tc',
          'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info', 'WEBGL_debug_shaders',
          'WEBGL_depth_texture', 'WEBGL_draw_buffers', 'WEBGL_lose_context'
        ];
      };

      const originalGetParameterWebGL = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // GL_VENDOR
        if (parameter === 7936) return 'Intel Inc.';
        // GL_RENDERER
        if (parameter === 7937) return 'Intel Iris OpenGL Engine';
        // GL_VERSION
        if (parameter === 7938) return 'WebGL 1.0 (OpenGL ES 2.0)';
        // GL_SHADING_LANGUAGE_VERSION
        if (parameter === 35724) return 'WebGL GLSL ES 1.00';
        // Other parameters can be spoofed here if needed
        return originalGetParameterWebGL.call(this, parameter);
      };

    });

    console.log('DEBUGGING: Browser context created');
    
    const page = await context.newPage();
    console.log('DEBUGGING: New page created');

    // Add page-specific anti-detection measures
    await page.addInitScript(() => {
      // Override property descriptors to hide automation
      try {
        const originalDescriptors = Object.getOwnPropertyDescriptors(HTMLIFrameElement.prototype);
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          ...originalDescriptors.contentWindow,
          get: function() {
            const result = originalDescriptors.contentWindow.get.call(this);
            if (result) {
              Object.defineProperty(result.navigator, 'webdriver', { get: () => false });
            }
            return result;
          }
        });
      } catch (e) {
        console.log('Error in page-specific anti-detection:', e);
      }
    });
    
    // Add random mouse movements to appear more human-like
    if (detectedRetailer === 'tesco' && !headlessMode) {
      // Only do this in visible mode and for Tesco
      const moveMouseRandomly = async () => {
        const width = contextOptions.viewport.width;
        const height = contextOptions.viewport.height;
        
        // Move to random positions a few times
        for (let i = 0; i < 3; i++) {
          const x = Math.floor(Math.random() * width);
          const y = Math.floor(Math.random() * height);
          await page.mouse.move(x, y, { steps: 5 });
          await page.waitForTimeout(Math.random() * 500 + 100);
        }
      };
      
      // Perform random mouse movements
      await moveMouseRandomly();
    }
    
    // Enhanced navigation with retry logic and cookies handling
    console.log(`DEBUGGING: Navigating to URL: ${url}`);
    
    // For Tesco, try a special approach
    if (detectedRetailer === 'tesco') {
      try {
        // First, visit the Tesco homepage to get cookies
        await page.goto('https://www.tesco.com/', { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        console.log('DEBUGGING: Visited Tesco homepage to get cookies');
        
        // Accept cookies if the banner appears
        try {
          const acceptCookiesButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies")');
          if (acceptCookiesButton) {
            await acceptCookiesButton.click();
            console.log('DEBUGGING: Accepted cookies on Tesco homepage');
            await page.waitForTimeout(2000);
          }
        } catch (cookieError) {
          console.log(`DEBUGGING: Error handling cookie consent: ${cookieError.message}`);
        }
        
        // Now navigate to the actual product page
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        console.log('DEBUGGING: Navigated to Tesco product page after homepage visit');
        
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => {
          console.log(`DEBUGGING: Network idle wait timed out: ${e.message}`);
        });
      } catch (tescoError) {
        console.log(`DEBUGGING: Tesco special approach failed: ${tescoError.message}, trying direct navigation`);
        await navigateWithRetry(page, url);
      }
    } else if (detectedRetailer === 'sainsburys') {
      // For Sainsbury's, try a special approach similar to Tesco
      try {
        // First, visit the Sainsbury's homepage to get cookies
        await page.goto('https://www.sainsburys.co.uk/', { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        log.info('DEBUGGING: Visited Sainsbury\'s homepage to get cookies');
        
        // Accept cookies if the banner appears
        try {
          const acceptCookiesButton = await page.$('#onetrust-accept-btn-handler, button:has-text("Accept all cookies"), button[id*="accept-cookies"]');
          if (acceptCookiesButton) {
            log.info('DEBUGGING: Found cookie consent button on Sainsbury\'s homepage, clicking...');
            await acceptCookiesButton.click();
            log.info('DEBUGGING: Accepted cookies on Sainsbury\'s homepage');
            await page.waitForTimeout(2000);
          }
        } catch (cookieError) {
          log.warning(`DEBUGGING: Error handling cookie consent on Sainsbury's homepage: ${cookieError.message}`);
        }
        
        // Now navigate to the actual product page
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        log.info('DEBUGGING: Navigated to Sainsbury\'s product page after homepage visit');
        
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => {
          log.info(`DEBUGGING: Network idle wait timed out: ${e.message}`);
        });
      } catch (sainsburysError) {
        log.warning(`DEBUGGING: Sainsbury's special approach failed: ${sainsburysError.message}, trying direct navigation`);
        await navigateWithRetry(page, url);
      }
    }
    else {
      // For other retailers, use standard navigation with retry
      await navigateWithRetry(page, url);
    }

  // Helper function for navigation with retry
  async function navigateWithRetry(page, url) {
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000
      });
      log.info('DEBUGGING: Initial navigation successful with domcontentloaded');
        
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => {
          console.log(`DEBUGGING: Network idle wait timed out: ${e.message}`);
        });
      } catch (navigationError) {
        console.log(`DEBUGGING: Initial navigation failed: ${navigationError.message}, trying with different options`);
        // Try again with different options
        try {
          await page.goto(url, { 
            waitUntil: 'load', 
            timeout: 90000
          });
          console.log('DEBUGGING: Retry navigation successful with load');
        } catch (retryError) {
          console.log(`DEBUGGING: Navigation retry failed: ${retryError.message}, trying with minimal options`);
          
          // Last attempt with minimal options
          try {
            await page.goto(url, { timeout: 120000 });
            console.log('DEBUGGING: Last attempt navigation successful with minimal options');
          } catch (lastError) {
            console.log(`DEBUGGING: All navigation attempts failed: ${lastError.message}`);
            throw lastError;
          }
        }
      }
    }

    // Log the detected retailer
    log.info(`Detected retailer: ${detectedRetailer} for URL: ${url}`);

    // Extract reviews
    const reviews = await extractReviews(page, url, 50);
    log.info(`Directly extracted ${reviews.length} reviews from ${url}`);

    // Extract product information from URL
    const { productId, productName } = urlUtils.extractProductInfoFromUrl(url);
    log.info(`Extracted product info - ID: ${productId}, Name: ${productName}`);

    // Add metadata to each review
    const now = new Date();
    reviews.forEach(review => {
      // Add extraction timestamp and source URL
      review.extractedAt = now.toISOString();
      review.sourceUrl = url;

      // Add product information
      review.productId = productId;
      review.productName = productName;

      // Add site type if not already set
      if (!review.siteType) {
        review.siteType = detectedRetailer;
      }

      // Add a unique identifier for deduplication
      review.uniqueId = urlUtils.createReviewUniqueId(review);

      // Format the date for display
      if (review.date && review.date !== 'Unknown date') {
        try {
          // Parse the date using our helper function
          const parsedDate = parseReviewDate(review.date);
          review.parsedDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format

          // Check if the review is within the specified date range
          let inRange = true;
          if (options.dateFrom) {
            const fromDate = new Date(options.dateFrom);
            inRange = inRange && parsedDate >= fromDate;
          }
          if (options.dateTo) {
            const toDate = new Date(options.dateTo);
            toDate.setHours(23, 59, 59, 999); // End of the day
            inRange = inRange && parsedDate <= toDate;
          }
          review.inDateRange = inRange;
        } catch (e) {
          log.warning(`Error parsing date "${review.date}": ${e.message}`);
          review.parsedDate = null;
          review.inDateRange = false;
        }
      } else {
        review.parsedDate = null;
        review.inDateRange = false;
      }
    });

    // Close the browser
    await browser.close();

    // Return the reviews
    return reviews;
  } catch (error) {
    log.error(`Error in scrapeReviews: ${error.message}\n${error.stack}`);
    console.log('DEBUGGING: Error in scrapeReviews:', error);

    // Return empty array
    return [];
  }
}

// Export the functions
module.exports = {
  scrapeReviews,
  extractReviews,
  handleGenericSite,
  autoScroll,
  parseReviewDate
};
