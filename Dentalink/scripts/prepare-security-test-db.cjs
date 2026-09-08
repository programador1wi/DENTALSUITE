#!/usr/bin/env node
// Creates a NEW disposable database. Never drops or restores over an existing database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Client } = require('pg');
const dotenv = require('dotenv');

async function main() {
  const env = { ...dotenv.parse(fs.readFileSync('.env')), ...process.env };
  const source = new URL(env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) throw new Error('Only local source databases are allowed');
  const dump = path.resolve(process.argv[2] || '');
  if (!dump.endsWith('.dump') || !fs.existsSync(dump)) throw new Error('Pass a verified .dump file');
  const manifest = JSON.parse(fs.readFileSync(dump.replace(/\.dump$/, '.manifest.json'), 'utf8'));
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(dump)) hash.update(chunk);
  if (hash.digest('hex') !== manifest.sha256) throw new Error('Backup checksum mismatch');
  const name = `dentalwarner_test_security_${Date.now()}`;
  const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try { await admin.query(`CREATE DATABASE "${name}"`); } finally { await admin.end(); }
  const child = spawn('docker', ['exec', '-i', env.POSTGRES_CONTAINER || 'dentalwarner-postgres',
    'pg_restore', '-U', decodeURIComponent(source.username), '-d', name, '--no-owner', '--no-privileges', '--exit-on-error'],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Restore failed: ${code}`)));
  });
  await Promise.all([pipeline(fs.createReadStream(dump), child.stdin), finished]);
  const testUrl = new URL(source); testUrl.pathname = `/${name}`;
  const client = new Client({ connectionString: testUrl.toString() }); await client.connect();
  let counts;
  try {
    counts = (await client.query(`SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')::int AS tables,
      (SELECT count(*) FROM "Patient")::int AS patients,
      (SELECT count(*) FROM "Appointment")::int AS appointments,
      (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS migrations`)).rows[0];
    if (counts.tables < 250 || counts.migrations < 107) throw new Error('Restored database is incomplete');
  } finally { await client.end(); }
  const root = path.resolve('backups', name); fs.mkdirSync(root);
  const testEnv = { ...env, NODE_ENV: 'test', DATABASE_URL: testUrl.toString(), SECURITY_TEST_DATABASE_URL: testUrl.toString(),
    MAIL_ENABLED: 'false', APPOINTMENT_REMINDER_WORKER_ENABLED: 'false', BACKGROUND_WORKERS_ENABLED: 'false' };
  const keys = Object.keys(dotenv.parse(fs.readFileSync('.env')));
  for (const key of ['NODE_ENV', 'DATABASE_URL', 'SECURITY_TEST_DATABASE_URL', 'MAIL_ENABLED', 'APPOINTMENT_REMINDER_WORKER_ENABLED', 'BACKGROUND_WORKERS_ENABLED']) if (!keys.includes(key)) keys.push(key);
  fs.writeFileSync(path.join(root, '.env.test'), keys.map(key => `${key}=${JSON.stringify(testEnv[key] || '')}`).join('\n') + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(root, 'restore-evidence.json'), JSON.stringify({ database: name, dump: path.basename(dump), checksum: manifest.sha256, counts }, null, 2));
  console.log(JSON.stringify({ database: name, environmentFile: path.join(root, '.env.test'), counts }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
