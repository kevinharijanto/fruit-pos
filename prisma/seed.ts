import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const names = ["Fruit", "Meat", "Vegetable"];
  for (const name of names) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main().finally(() => prisma.$disconnect());
