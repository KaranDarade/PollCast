import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
      permissions: JSON.stringify(['*']),
    },
  });

  const hostRole = await prisma.role.upsert({
    where: { name: RoleName.HOST },
    update: {},
    create: {
      name: RoleName.HOST,
      permissions: JSON.stringify([
        'event:create',
        'event:edit',
        'event:delete',
        'poll:create',
        'poll:manage',
        'question:moderate',
      ]),
    },
  });

  await prisma.role.upsert({
    where: { name: RoleName.PARTICIPANT },
    update: {},
    create: {
      name: RoleName.PARTICIPANT,
      permissions: JSON.stringify([
        'event:join',
        'poll:vote',
        'question:ask',
        'question:upvote',
      ]),
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@pollcast.app' },
    update: {},
    create: {
      email: 'admin@pollcast.app',
      passwordHash: hashedPassword,
      name: 'Admin',
      roleId: adminRole.id,
      emailVerified: new Date(),
    },
  });

  // Create host user
  await prisma.user.upsert({
    where: { email: 'host@pollcast.app' },
    update: {},
    create: {
      email: 'host@pollcast.app',
      passwordHash: hashedPassword,
      name: 'Demo Host',
      roleId: hostRole.id,
      emailVerified: new Date(),
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
