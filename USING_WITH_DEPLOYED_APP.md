# Using the Local Browser Service with the Deployed Application

This guide explains how to use the local browser service with the application deployed on Fly.io.

## How It Works

When the application is deployed to Fly.io:

1. The main application runs in headless mode on the Fly.io servers
2. For most retailers (Tesco, ASDA), this works fine
3. For Morrisons and Sainsbury's, which have stronger anti-bot measures, the application needs to use a visible browser

Since Fly.io servers can't run a visible browser, we use a hybrid approach:

- The main application runs on Fly.io
- A local browser service runs on your computer
- When you submit Morrisons or Sainsbury's URLs, the Fly.io server connects to your local browser service
- The local browser service opens a visible Chrome window on your computer, scrapes the reviews, and sends them back to the Fly.io server

## Setup Instructions

### 1. Download the Local Browser Service Files

Download these files from the repository:
- `local-browser-service.js`
- `start-local-browser-service.bat` (Windows)
- `start-local-browser-service.sh` (Unix/Linux)
- `package.json` (for dependencies)

### 2. Install Dependencies

```bash
npm install express cors playwright axios
```

### 3. Start the Local Browser Service

```bash
# On Windows
start-local-browser-service.bat

# On macOS/Linux
chmod +x start-local-browser-service.sh
./start-local-browser-service.sh
```

You should see a message indicating that the service is running on port 3002.

### 4. Configure Your Network (If Needed)

If your computer is behind a firewall or NAT:

1. Set up port forwarding on your router to forward port 3002 to your computer
2. Use a service like ngrok to create a tunnel:
   ```
   ngrok http 3002
   ```
3. Update the URL in the deployed application to point to your ngrok URL

### 5. Use the Deployed Application

1. Keep the local browser service running on your computer
2. Go to the deployed application at https://retailer-review-scraper.fly.dev
3. Enter product URLs (including Morrisons and Sainsbury's URLs)
4. Click "Scrape Reviews"

When the application processes Morrisons or Sainsbury's URLs:
- A Chrome window will open on your computer
- It will navigate to the product page and scrape reviews
- The window will close automatically when done
- The reviews will be sent back to the Fly.io server and included in the CSV

### 6. Fallback Behavior

If the local browser service is not running or cannot be reached:
- The application will fall back to using the headless browser on Fly.io
- This may not work as reliably for Morrisons and Sainsbury's websites
- You'll see a message in the logs indicating that the fallback was used

## Troubleshooting

### Local Browser Service Not Starting

- Make sure you have Node.js installed
- Check that all dependencies are installed
- Try running `node local-browser-service.js` directly to see any error messages

### Connection Issues

- Make sure your firewall allows connections on port 3002
- Check that no other application is using port 3002
- If using ngrok, make sure the tunnel is active

### Browser Not Opening

- Make sure you have Chrome installed
- Try setting the `PLAYWRIGHT_BROWSER_PATH` environment variable to your Chrome executable path

### Reviews Not Being Scraped

- Check the console output of the local browser service for errors
- Try opening the product page manually to see if reviews are visible
- Some products may genuinely have no reviews

## Security Considerations

The local browser service accepts connections from any source by default. For better security:

1. Edit `local-browser-service.js` to restrict access to specific IP addresses
2. Use a firewall to block external access to port 3002 except from Fly.io IP ranges
3. Consider using HTTPS and authentication for the local browser service

## Advanced: Running on a Server

If you want to run the local browser service on a server instead of your local machine:

1. Set up a server with a GUI environment (e.g., using Xvfb on Linux)
2. Install Node.js and the required dependencies
3. Start the local browser service on the server
4. Make sure the service is accessible from the internet
5. Update the URL in the deployed application to point to your server
