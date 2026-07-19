import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').toLowerCase();
  const name = process.env.ADMIN_BOOTSTRAP_NAME ?? 'Administrator';
  const tempPassword = process.env.ADMIN_BOOTSTRAP_TEMP_PASSWORD ?? '';

  if (!email || !tempPassword) {
    console.log('ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_TEMP_PASSWORD not set, skipping admin bootstrap.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin bootstrap: user ${email} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'ADMIN', mustChangePassword: true },
  });
  console.log(`Bootstrapped initial Admin user: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
