/* Creates (or promotes) the initial administrator from environment variables.
   Usage: ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='...' npm run admin:create
   If ADMIN_PASSWORD is unset, you are prompted (input is hidden). Nothing is hard-coded. */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as readline from 'readline';


function promptHidden(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    (rl as any)._writeToOutput = (s: string) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

async function main() {
  const prisma = new PrismaClient();
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? 'Administrator').trim();
  if (!email) throw new Error('ADMIN_EMAIL is required');
  const password = process.env.ADMIN_PASSWORD || (await promptHidden('Admin password (min 12 chars): '));
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const user = await prisma.user.upsert({ where: { email }, update: { role: 'ADMIN', passwordHash, status: 'ACTIVE' }, create: { email, name, passwordHash, role: 'ADMIN' } });
  console.log(`Administrator ready: ${user.email}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
