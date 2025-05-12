# Retailer Review Scraper

A web application for extracting product reviews from major UK retailers including Tesco, Sainsbury's, ASDA, and Morrisons.

## Features

- Extract reviews from multiple retailer websites
- Support for Tesco, Sainsbury's, ASDA, and Morrisons
- Automatic detection of retailer from URL
- Date range filtering for reviews
- CSV export with product information
- Modern, responsive user interface

## Project Structure

The project consists of the following key files:

- `server.js` - Main server file that handles HTTP requests and coordinates the scraping process
- `review-scraper-crawlee-fixed.js` - Core scraping logic for all retailers
- `csv-exporter.js` - Utilities for generating CSV files from review data
- `url-utils.js` - Utilities for URL handling and retailer detection
- `delete-screenshots.js` - Utility for cleaning up screenshot files
- `public/index.html` - User interface for the application

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/retailer-review-scraper.git
   cd retailer-review-scraper
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Application Locally

Start the server in development mode:
```
npm run dev
```

Or in production mode:
```
npm start
```

Then open a browser and navigate to:
```
http://localhost:3001
```

## Usage

1. Enter one or more product URLs in the text area (one per line)
2. Optionally specify a date range for filtering reviews
3. Click "Scrape Reviews" to start the process
4. Wait for the scraping to complete (a browser window may appear for captcha solving)
5. The CSV file will automatically download when complete

### Using the Local Browser Service

For Morrisons and Sainsbury's websites, which have stronger anti-bot measures, you can use the local browser service to scrape reviews using a visible browser:

1. Start the local browser service before running the main application:
   ```
   # On Windows
   start-local-browser-service.bat
   
   # On macOS/Linux
   ./start-local-browser-service.sh
   ```

2. The service will run on port 3002 and will automatically be used when scraping Morrisons and Sainsbury's URLs
3. When a Morrisons or Sainsbury's URL is being scraped, a visible Chrome window will open
4. The window will automatically close after the reviews have been extracted
5. Keep the service running in the background while using the main application

### Using with Deployed Application

When using the application deployed on Fly.io, it automatically uses Xvfb (X Virtual Framebuffer) to run browsers in "visible" mode for Morrisons and Sainsbury's websites. This approach helps bypass anti-bot measures without requiring any additional setup from users.

The application will:
1. Start Xvfb to create a virtual display
2. Run Chrome in non-headless mode on this virtual display for Morrisons and Sainsbury's websites
3. Use headless mode for other retailers (Tesco, ASDA)

This means you can use the deployed application to scrape all supported retailers without any additional setup on your computer.

## Supported Retailers

- **Tesco**: Product URLs from tesco.com
- **Sainsbury's**: Product URLs from sainsburys.co.uk
- **ASDA**: Product URLs from asda.com
- **Morrisons**: Product URLs from morrisons.com

## CSV Output Format

The CSV file includes the following columns:
- Product Name
- Product URL
- Review Title
- Review Text
- Rating
- Date
- Retailer

## Deployment

### GitHub Setup

1. Create a new GitHub repository
2. Push your code to the repository:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/retailer-review-scraper.git
   git push -u origin main
   ```

### Fly.io Deployment

1. Install the Fly.io CLI:
   ```
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```
   fly auth login
   ```

3. Create a new app on Fly.io:
   ```
   fly launch
   ```

4. Set up GitHub Actions for CI/CD:
   - Go to your GitHub repository settings
   - Navigate to "Secrets and variables" > "Actions"
   - Add a new repository secret named `FLY_API_TOKEN` with your Fly.io API token

5. Manual deployment (if not using GitHub Actions):
   ```
   npm run deploy
   ```

### Docker Deployment

You can also build and run the application using Docker:

```
docker build -t retailer-review-scraper .
docker run -p 3001:8080 retailer-review-scraper
```

## Notes

- The application may open browser windows during scraping to handle captchas
- Screenshots are automatically deleted after the CSV is generated
- Date filtering marks reviews outside the selected range but still includes them in the CSV
- When deployed to Fly.io, the application runs in headless mode

## Troubleshooting

### Common Issues

1. **Puppeteer/Chrome Issues**: If you encounter issues with Puppeteer or Chrome, make sure you have all the required dependencies installed for your operating system.

2. **Port Already in Use**: If port 3001 is already in use, you can change the port by setting the `PORT` environment variable:
   ```
   PORT=3002 npm start
   ```

3. **Deployment Issues**: If you encounter issues during deployment, check the Fly.io logs:
   ```
   fly logs
   ```

## License

MIT
