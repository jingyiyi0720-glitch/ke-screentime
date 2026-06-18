const http = require('http');
const handler = require('./api/screentime');

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port', process.env.PORT || 3000);
});
