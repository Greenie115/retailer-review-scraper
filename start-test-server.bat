@echo off
echo Starting test server for the integrated review scraper...
echo.
echo This server will run on port 3003 and provide a web interface
echo for testing the integrated review scraper.
echo.
echo Open http://localhost:3003/test.html in your browser to access the test interface.
echo.
echo Press Ctrl+C to stop the server.
echo.

node test-integrated-server.js
