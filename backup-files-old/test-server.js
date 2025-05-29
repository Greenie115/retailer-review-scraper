const http = require('http');

// Function to check if the server is running
function checkServer(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      console.log(`Server is running on port ${port}`);
      console.log(`Status code: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.error(`Server is not running on port ${port}: ${err.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Check if the server is running on port 3001
checkServer(3001)
  .then(isRunning => {
    console.log(`Server running: ${isRunning}`);
    process.exit(isRunning ? 0 : 1);
  })
  .catch(error => {
    console.error(`Error checking server: ${error.message}`);
    process.exit(1);
  });
