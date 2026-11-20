// Creates/updates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
const passwordHash = await bcrypt.hash(password, 12);
await prisma.user.upsert({
  where: { email },
  update: { role: "ADMIN", passwordHash },
  create: { email, passwordHash, firstName: "Admin", lastName: "Team", role: "ADMIN", emailVerifiedAt: new Date() },
});
console.log(`Admin ready: ${email}`);
await prisma.$disconnect();
