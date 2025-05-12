@echo off
echo Starting local browser service for Morrisons and Sainsbury's scraping...
echo.
echo This service will open a visible browser window when needed to scrape reviews
echo from Morrisons and Sainsbury's websites, which helps bypass anti-bot measures.
echo.
echo The service will run on port 3002 and communicate with the main scraper.
echo.
echo Press Ctrl+C to stop the service.
echo.

node local-browser-service.js
