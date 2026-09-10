const { Client } = require('ssh2');
const fs = require('fs');

const SERVER = '139.199.186.198';
const USER = 'ubuntu';
const KEY_PATH = 'E:\\Trae资产库\\汇流密钥\\HuiLiu.pem';

const privateKey = fs.readFileSync(KEY_PATH, 'utf-8');
const conn = new Client();

const cmd = [
  'cd /www/ai-position/server',
  'rm -rf dist',
  'unzip -o /tmp/server-dist.zip -d dist/',
  'cd /www/ai-position/frontend',
  'rm -f *.js *.css *.html *.ico *.png *.svg assets/* 2>/dev/null',
  'unzip -o /tmp/client-dist.zip',
  'mkdir -p /www/ai-position/server/uploads/models',
  'cd /www/ai-position/server',
  'npm install --production 2>&1 | tail -2',
  'pm2 delete ai-position-backend 2>/dev/null; JWT_SECRET=ai-position-square-jwt-secret-2024 pm2 start dist/main.js --name ai-position-backend --cwd /www/ai-position/server',
  'sleep 3',
  'pm2 logs ai-position-backend --lines 5 --nostream 2>&1',
  'rm -f /tmp/server-dist.zip /tmp/client-dist.zip',
  'echo DEPLOY_DONE',
].join(' && ');

conn.on('ready', () => {
  console.log('Deploying...');
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('close', (code) => {
      conn.end();
      console.log(out.trim());
      process.exit(code || 0);
    }).on('data', (d) => { out += d.toString(); console.log(d.toString().trim()); })
      .stderr.on('data', (d) => { out += d.toString(); console.error(d.toString().trim()); });
  });
}).on('error', (err) => {
  console.error('Connection error:', err.message);
}).connect({
  host: SERVER,
  port: 22,
  username: USER,
  privateKey: privateKey,
  readyTimeout: 20000
});
