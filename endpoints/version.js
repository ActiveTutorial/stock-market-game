const packageJson = require('../package.json');

module.exports = (req, res) => {
  res.json({ version: packageJson.version });
};
