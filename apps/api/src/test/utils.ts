import { prisma } from '../lib/prisma.js';

export const resetDatabase = async () => {
  await prisma.sessionTask.deleteMany();
  await prisma.session.deleteMany();
  await prisma.templateTask.deleteMany();
  await prisma.template.deleteMany();
  await prisma.child.deleteMany();
};

