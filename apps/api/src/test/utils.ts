export const resetDatabase = async () => {
  const { prisma } = await import('../lib/prisma.js');
  await prisma.sessionTask.deleteMany();
  await prisma.session.deleteMany();
  await prisma.templateTask.deleteMany();
  await prisma.template.deleteMany();
  await prisma.child.deleteMany();
};

