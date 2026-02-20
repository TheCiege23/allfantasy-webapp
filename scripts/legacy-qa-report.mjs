#!/usr/bin/env node

import { execSync } from 'node:child_process';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5000';
const requiredSecrets = ['OPENAI_API_KEY', 'XAI_API_KEY', 'NEXTAUTH_SECRET', 'DATABASE_URL'];

function checkSecrets() {
  return requiredSecrets.map((key) => ({
    key,
    present: Boolean(process.env[key]),
  }));
}

function checkPrismaClient() {
  try {
    execSync('node -e "require(\'@prisma/client\')"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkAppReachable() {
  try {
    const response = await fetch(baseUrl, { method: 'GET' });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 'NETWORK_ERROR', error: error instanceof Error ? error.message : String(error) };
  }
}

async function runSmoke() {
  try {
    const output = execSync('node scripts/legacy-feature-smoke-test.mjs', {
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    });
    return { ok: true, output };
  } catch (error) {
    return {
      ok: false,
      output: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
      code: error.status ?? 1,
    };
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

const app = await checkAppReachable();
const prismaClientOk = checkPrismaClient();
const secrets = checkSecrets();
const smoke = await runSmoke();

printSection('Prerequisites');
console.log(`${app.ok ? '✅' : '❌'} App reachable (${baseUrl}) -> ${app.status}`);
console.log(`${prismaClientOk ? '✅' : '❌'} Prisma client import check`);

const missingSecrets = secrets.filter((secret) => !secret.present);
if (missingSecrets.length === 0) {
  console.log('✅ Required secrets present');
} else {
  console.log(`❌ Missing required secrets: ${missingSecrets.map((secret) => secret.key).join(', ')}`);
}

printSection('Smoke Test Output');
process.stdout.write(smoke.output.trim() ? `${smoke.output.trim()}\n` : 'No smoke output captured\n');
if (smoke.stderr) {
  console.log('\n--- stderr ---');
  process.stdout.write(`${smoke.stderr.trim()}\n`);
}

const allOk = app.ok && prismaClientOk && missingSecrets.length === 0 && smoke.ok;
printSection('Summary');
console.log(allOk ? '✅ Legacy QA report passed' : '❌ Legacy QA report found issues');

process.exit(allOk ? 0 : 1);
