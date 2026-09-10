const { Client } = require('ssh2');
const fs = require('fs');

const SERVER = '139.199.186.198';
const USER = 'ubuntu';
const KEY_PATH = 'E:\\Trae资产库\\汇流密钥\\HuiLiu.pem';

const privateKey = fs.readFileSync(KEY_PATH, 'utf-8');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected. Uploading files via SFTP...');
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    
    console.log('Uploading server-dist.zip...');
    sftp.fastPut('server-dist.zip', '/tmp/server-dist.zip', (err) => {
      if (err) { console.error('server-dist.zip:', err.message); conn.end(); return; }
      console.log('server-dist.zip uploaded');
      
      console.log('Uploading client-dist.zip...');
      sftp.fastPut('client-dist.zip', '/tmp/client-dist.zip', (err) => {
        if (err) { console.error('client-dist.zip:', err.message); conn.end(); return; }
        console.log('client-dist.zip uploaded');
        conn.end();
        console.log('UPLOAD_DONE');
      });
    });
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
