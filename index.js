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
app.post('/api/trade/buy', tradeEndpoint.buy);
app.post('/api/trade/sell', tradeEndpoint.sell);
app.post('/api/trade/look', tradeEndpoint.look);

// Register endpoint
const registerEndpoint = require('./endpoints/register');
app.post('/api/register', registerEndpoint);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
