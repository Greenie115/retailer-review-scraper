const express = require('express');
const app = express();
const port = 3001;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Serve the HTML form
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Simple server listening at http://localhost:${port}`);
});
