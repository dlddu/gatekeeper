import path from 'path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrate: {
    async adapter() {
      const { PrismaLibSql } = await import('@prisma/adapter-libsql');
      const url = process.env.DATABASE_URL ?? 'file:./dev.db';
      return new PrismaLibSql({ url });
    },
  },
});
