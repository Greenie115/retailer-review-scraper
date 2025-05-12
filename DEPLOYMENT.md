# Deploying the Retailer Review Scraper to Fly.io

This guide will help you deploy the Retailer Review Scraper application to Fly.io, making it accessible from anywhere on the internet.

## Prerequisites

1. A Fly.io account (sign up at [fly.io](https://fly.io/))
2. Fly CLI installed on your computer
   - For Windows: `iwr https://fly.io/install.ps1 -useb | iex`
   - For macOS/Linux: `curl -L https://fly.io/install.sh | sh`

## Deployment Steps

### 1. Log in to Fly.io

If you haven't already logged in to Fly.io, run:

```bash
flyctl auth login
```

### 2. Deploy the Application

You can use the provided deployment scripts:

- For Windows: Run `deploy-to-fly.bat`
- For macOS/Linux: Run `./deploy-to-fly.sh` (make it executable first with `chmod +x deploy-to-fly.sh`)

Alternatively, you can deploy manually:

```bash
flyctl deploy
```

### 3. Access Your Application

Once deployed, your application will be available at:

```
https://retailer-review-scraper.fly.dev
```

You can open it in your browser with:

```bash
flyctl open
```

## Monitoring and Troubleshooting

### View Logs

To view the application logs:

```bash
flyctl logs
```

### Check Application Status

To check the status of your application:

```bash
flyctl status
```

## Important Notes

1. **Browser Automation in Production**: The application uses headless Chrome for web scraping. This is configured in the Dockerfile and should work automatically on Fly.io.

2. **Resource Allocation**: The default configuration in `fly.toml` allocates 1 CPU and 1GB of memory. If you need more resources, you can modify the `[[vm]]` section in `fly.toml`.

3. **Scaling**: By default, the application is configured to scale down to zero when not in use (`min_machines_running = 0`). This saves costs but means the first request after inactivity will take longer to respond.

4. **Port Configuration**: The application listens on port 8080 internally, which is mapped to the standard HTTP port (80) externally.

5. **Virtual Display with Xvfb**: For Morrisons and Sainsbury's websites, which have stronger anti-bot measures, the application uses Xvfb (X Virtual Framebuffer) to run browsers in "visible" mode even though there's no actual display. This approach helps bypass anti-bot measures without requiring any additional setup from users.

   The Xvfb setup is automatically configured in the Dockerfile and start-with-xvfb.sh script, so no additional action is required from users. When deployed to Fly.io, the application will:
   
   1. Start Xvfb to create a virtual display
   2. Run Chrome in non-headless mode on this virtual display for Morrisons and Sainsbury's websites
   3. Use headless mode for other retailers (Tesco, ASDA)
   
   This approach provides better results for retailers with strong anti-bot measures without requiring users to run any local services.

## Troubleshooting

If you encounter issues during deployment:

1. Check the deployment logs for errors
2. Ensure your Fly.io account has sufficient resources
3. Verify that the application works locally before deploying
4. Check if there are any region-specific issues (you can change the region in `fly.toml`)

For more help, refer to the [Fly.io documentation](https://fly.io/docs/).
