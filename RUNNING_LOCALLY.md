# Running the Review Scraper Locally

This guide provides detailed instructions for running the Review Scraper application on your local machine for development and testing purposes.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- A modern web browser (Chrome recommended)

## Setup

1. Clone the repository or download the source code
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   PORT=3001
   HEADLESS=false
   ```

## Running the Main Application

### Start the Main Server

```bash
# Using npm script
npm run dev

# Or directly
node server.js
```

The main application will be available at http://localhost:3001

## Using the Local Browser Service

For Morrisons and Sainsbury's websites, which have stronger anti-bot measures, you can use the local browser service to scrape reviews using a visible browser.

### Start the Local Browser Service

```bash
# Using npm script
npm run local-browser

# Or using the batch/shell script
# On Windows
start-local-browser-service.bat

# On macOS/Linux
./start-local-browser-service.sh
```

The local browser service will run on port 3002 and will automatically be used when scraping Morrisons and Sainsbury's URLs from the main application.

## Testing

### Test the Integrated Scraper

To test the integrated scraper with a web interface:

```bash
# Using npm script
npm run test-server

# Or using the batch/shell script
# On Windows
start-test-server.bat

# On macOS/Linux
./start-test-server.sh
```

Then open http://localhost:3003/test.html in your browser to access the test interface.

### Test the Local Browser Service

To test the local browser service directly:

```bash
# Using npm script
npm run test-local-browser

# Or directly
node test-local-browser-service.js
```

Make sure the local browser service is running before running this test.

## Debugging

### Common Issues

1. **Browser Not Opening**: If the browser doesn't open when using the local browser service, check that:
   - You have a compatible browser installed
   - The `HEADLESS` environment variable is set to `false` in your `.env` file

2. **Connection Refused**: If you see "Connection refused" errors when trying to use the local browser service:
   - Make sure the local browser service is running on port 3002
   - Check that no other application is using port 3002

3. **No Reviews Found**: If no reviews are found:
   - Check that the URL is correct and points to a product page
   - Try opening the URL in a regular browser to see if reviews are visible
   - Some products may genuinely have no reviews

### Logs

- Check the console output for detailed logs
- Look for error messages that might indicate what's going wrong
- The application logs each step of the scraping process, which can help identify where issues occur

## Advanced Configuration

### Environment Variables

- `PORT`: The port for the main server (default: 8080)
- `HEADLESS`: Whether to run browsers in headless mode (default: true in production, false in development)
- `NODE_ENV`: Set to "production" for production mode, otherwise development mode is assumed

### Retailer-Specific Handlers

The application uses different handlers for each retailer:

- `checkpoint/tesco-handler-new.js`: Handler for Tesco websites
- `checkpoint/sainsburys-handler-new.js`: Handler for Sainsbury's websites
- `checkpoint/asda-handler-new.js`: Handler for ASDA websites
- `checkpoint/morrisons-handler-new.js`: Handler for Morrisons websites

If you need to modify how a specific retailer's site is scraped, edit the corresponding handler file.

## Architecture

The application consists of several components:

1. **Main Server** (`server.js`): Handles HTTP requests and coordinates the scraping process
2. **Integrated Scraper** (`review-scraper-integrated.js`): Core scraping logic for all retailers
3. **Local Browser Service** (`local-browser-service.js`): Service for scraping with a visible browser
4. **Retailer Handlers** (in `checkpoint/` directory): Retailer-specific scraping logic
5. **Utility Modules**:
   - `url-utils.js`: URL handling and retailer detection
   - `csv-exporter.js`: CSV file generation
   - `supermarket-utils.js`: Retailer-specific utilities

## Flow Diagram

```
User Request → Main Server → Integrated Scraper → Retailer Handler → Reviews
                                    ↓
                          Local Browser Service
                          (for Morrisons & Sainsbury's)
```

## Contributing

If you want to contribute to the project:

1. Make your changes in a new branch
2. Test your changes thoroughly
3. Submit a pull request with a clear description of your changes

## License

MIT
