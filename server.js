const http = require('http');
const handler = require('./api/screentime');

const PORT = parseInt(process.env.WEB_PORT) || parseInt(process.env.PORT) || 8080;

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
