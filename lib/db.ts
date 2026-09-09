import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Singleton do Prisma.
 *
 * O Prisma 7 não embute mais o engine: a conexão passa por um driver adapter.
 * Para SQLite usamos better-sqlite3, que é síncrono e sem servidor — combina
 * com um app local de usuário único.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; sem o cache
 * global abaixo, cada reload abriria uma nova conexão e o SQLite acabaria
 * respondendo "database is locked".
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não está definida. Copie .env.example para .env antes de rodar a aplicação.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Id fixo do usuário local. O v1 não tem autenticação, mas todas as entidades
 * já são vinculadas a um User para que login e sincronização entrem depois sem
 * migração destrutiva.
 */
export const LOCAL_USER_ID = "local-user";

/** Garante que o usuário local exista. Idempotente. */
export async function ensureLocalUser() {
  return db.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: { id: LOCAL_USER_ID, name: "Eu" },
  });
}
