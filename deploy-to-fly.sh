#!/bin/bash
# Script to deploy the review scraper to fly.io

echo "Deploying review scraper to fly.io..."

# Make sure the checkpoint directory exists
if [ ! -d "checkpoint" ]; then
  echo "Error: checkpoint directory not found. Make sure you're in the correct directory."
  exit 1
fi

# Check if fly CLI is installed
if ! command -v flyctl &> /dev/null; then
  echo "Error: flyctl is not installed. Please install it first:"
  echo "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Check if user is logged in to fly.io
echo "Checking if you're logged in to fly.io..."
if ! flyctl auth whoami &> /dev/null; then
  echo "You need to log in to fly.io first:"
  flyctl auth login
fi

# Deploy the application
echo "Deploying application to fly.io..."
flyctl deploy

# Check if deployment was successful
if [ $? -eq 0 ]; then
  echo "Deployment successful!"
  echo "Your application is now available at: https://retailer-review-scraper.fly.dev"
  echo ""
  echo "You can open it in your browser with:"
  echo "  flyctl open"
  echo ""
  echo "To view logs:"
  echo "  flyctl logs"
else
  echo "Deployment failed. Please check the error messages above."
fi
