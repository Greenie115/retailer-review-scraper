#!/bin/bash

# Start Xvfb
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99

# Wait for Xvfb to start
sleep 1

# Start the application
node server.js
