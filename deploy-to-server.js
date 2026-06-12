const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SERVER_IP = '123.207.59.250';
const SERVER_USER = 'ubuntu';
const SERVER_PASS = '15873093710Myh!';
const FRONTEND_REMOTE = '/www/ai-position/frontend';
const BACKEND_REMOTE = '/www/ai-position/server';

const conn = new Client();

function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', (data) => { output += data.toString(); });
      stream.stderr.on('data', (data) => { output += data.toString(); });
      stream.on('close', (code) => {
        resolve({ code, output });
      });
    });
  });
}

function getSFTP() {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function mkdirRemote(sftp, remoteDir) {
  return new Promise((resolve) => {
    sftp.mkdir(remoteDir, () => resolve());
  });
}

async function uploadDir(sftp, localDir, remoteDir) {
  await mkdirRemote(sftp, remoteDir);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
    } else {
      try {
        await uploadFile(sftp, localPath, remotePath);
      } catch (e) {
        console.error(`[SFTP] Failed: ${entry.name} - ${e.message}`);
      }
    }
  }
}

async function deploy() {
  return new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log('[SSH] Connected');
      try {
        const sftp = await getSFTP();

        // 1. Clear and upload frontend
        console.log('[Deploy] Uploading frontend...');
        await execCommand(`rm -rf ${FRONTEND_REMOTE}/assets ${FRONTEND_REMOTE}/index.html`);
        const frontendDist = path.join(__dirname, 'client', 'dist');
        await uploadDir(sftp, frontendDist, FRONTEND_REMOTE);
        console.log('[Deploy] Frontend uploaded');

        // 2. Upload backend dist
        console.log('[Deploy] Uploading backend...');
        const backendDist = path.join(__dirname, 'server', 'dist');
        await execCommand(`rm -rf ${BACKEND_REMOTE}/dist`);
        await uploadDir(sftp, backendDist, `${BACKEND_REMOTE}/dist`);
        console.log('[Deploy] Backend dist uploaded');

        // 3. Install deps and restart
        console.log('[Deploy] Installing dependencies...');
        const installResult = await execCommand(`cd ${BACKEND_REMOTE} && npm install --production 2>&1 | tail -3`);
        console.log('[Deploy] npm install:', installResult.output.trim());

        console.log('[Deploy] Restarting backend...');
        const restartResult = await execCommand(`cd ${BACKEND_REMOTE} && sudo pm2 delete ai-position-backend 2>/dev/null; sudo kill -9 $(sudo lsof -t -i:3000) 2>/dev/null; sleep 2; cd ${BACKEND_REMOTE} && sudo pm2 start dist/main.js --name ai-position-backend 2>&1`);
        console.log('[Deploy] PM2:', restartResult.output.trim());
        await execCommand(`sudo pm2 save`);

        console.log('[Deploy] Deployment complete!');
        conn.end();
        resolve();
      } catch (err) {
        console.error('[Deploy] Error:', err);
        conn.end();
        reject(err);
      }
    });

    conn.on('error', (err) => {
      console.error('[SSH] Connection error:', err.message);
      reject(err);
    });

    console.log(`[SSH] Connecting to ${SERVER_USER}@${SERVER_IP}...`);
    conn.connect({
      host: SERVER_IP,
      port: 22,
      username: SERVER_USER,
      password: SERVER_PASS,
      readyTimeout: 30000,
    });
  });
}

deploy().catch(console.error);
