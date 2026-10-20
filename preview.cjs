const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Use a port between 0 and 65535.');
const output = path.join(__dirname, 'dist');
if (!fs.existsSync(path.join(output, 'index.html'))) throw new Error('Run npm run build first.');
const routes = {'/': 'index.html'};
for (const name of ['index.html', 'ad-budget-calculator.html', 'ad-budget-conservative.html', 'ad-budget-suno.html', 'budget-model.js', 'budget-planner.js', 'budget-planner.css']) routes['/' + name] = name;
const contentTypes = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, {'Allow': 'GET, HEAD'});
    return response.end('Method not allowed');
  }
  const route = new URL(request.url, 'http://localhost').pathname;
  const file = routes[route];
  if (!file) {
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    return response.end('Not found');
  }
  const content = fs.readFileSync(path.join(output, file));
  response.writeHead(200, {'Content-Type': contentTypes[path.extname(file)] + '; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': content.length});
  response.end(request.method === 'HEAD' ? undefined : content);
});
server.on('error', error => {console.error(error.message);process.exitCode = 1;});
server.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port + '/'));
