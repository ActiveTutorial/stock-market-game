const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Body parser middleware
app.use(express.json());

// Version endpoint
const versionEndpoint = require('./endpoints/version');
app.get('/api/version', versionEndpoint);

// Trade endpoint
const tradeEndpoint = require('./endpoints/trade');
app.use('/api/trade', tradeEndpoint);

// Register endpoint
const registerEndpoint = require('./endpoints/register');
app.use('/api/register', registerEndpoint);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
