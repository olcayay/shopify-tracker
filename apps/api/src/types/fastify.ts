import type { createDb } from "@appranks/db";

type Db = ReturnType<typeof createDb>;

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
