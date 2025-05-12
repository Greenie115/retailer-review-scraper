@echo off
REM Script to deploy the review scraper to fly.io

echo Deploying review scraper to fly.io...

REM Make sure the checkpoint directory exists
if not exist "checkpoint" (
  echo Error: checkpoint directory not found. Make sure you're in the correct directory.
  exit /b 1
)

REM Check if fly CLI is installed
where flyctl >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Error: flyctl is not installed. Please install it first:
  echo   iwr https://fly.io/install.ps1 -useb ^| iex
  exit /b 1
)

REM Check if user is logged in to fly.io
echo Checking if you're logged in to fly.io...
flyctl auth whoami >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo You need to log in to fly.io first:
  flyctl auth login
)

REM Deploy the application
echo Deploying application to fly.io...
flyctl deploy

REM Check if deployment was successful
if %ERRORLEVEL% equ 0 (
  echo Deployment successful!
  echo Your application is now available at: https://retailer-review-scraper.fly.dev
  echo.
  echo You can open it in your browser with:
  echo   flyctl open
  echo.
  echo To view logs:
  echo   flyctl logs
) else (
  echo Deployment failed. Please check the error messages above.
)
