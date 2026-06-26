import { access, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, 'femic-whatsapp-bot-discloud.zip');

const excludes = [
  '.git/*',
  'dist/*',
  'node_modules/*',
  'services/whatsapp-worker/.runtime/*',
  'services/whatsapp-worker/.session/*',
  '*.log',
];

function run(command, args){
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} saiu com código ${code}`)));
  });
}

await mkdir(outDir, { recursive: true });
await rm(outFile, { force: true });

async function fileExists(file){
  try{
    await access(path.join(root, file));
    return true;
  }catch{
    return false;
  }
}

const optionalFiles = [];
if(await fileExists('.env')) optionalFiles.push('.env');

await run('zip', [
  '-r',
  outFile,
  'discloud.config',
  'package.json',
  'package-lock.json',
  'js/femic-appointment-slot-utils.js',
  'js/femic-pending-task-utils.js',
  'js/femic-whatsapp-ai-utils.js',
  'js/femic-whatsapp-reminder-utils.js',
  'services/whatsapp-worker',
  '.env.discloud.example',
  ...optionalFiles,
  ...excludes.flatMap((pattern) => ['-x', pattern]),
]);

console.log(`Pacote Discloud criado em ${outFile}`);
