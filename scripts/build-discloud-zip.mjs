import { access, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const botDir = path.join(root, 'bot');
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, 'femic-whatsapp-bot-discloud.zip');

const excludes = [
  'node_modules/*',
  'baileys-auth-*/*',
  '*.log',
];

function run(command, args, cwd = root){
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} saiu com código ${code}`)));
  });
}

await mkdir(outDir, { recursive: true });
await rm(outFile, { force: true });

async function fileExists(file){
  try{
    await access(path.join(botDir, file));
    return true;
  }catch{
    return false;
  }
}

const optionalFiles = [];
if(await fileExists('.env')) optionalFiles.push('.env');
if(await fileExists('package-lock.json')) optionalFiles.push('package-lock.json');

await run('zip', [
  '-r',
  outFile,
  'discloud.config',
  'package.json',
  'index.js',
  'reminder.js',
  'reminder-utils.js',
  'supabase.js',
  'vendor',
  '.env.example',
  ...optionalFiles,
  ...excludes.flatMap((pattern) => ['-x', pattern]),
], botDir);

console.log(`Pacote Discloud criado em ${outFile}`);
