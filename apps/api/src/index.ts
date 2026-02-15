import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@shopify-tracking/db";
import { categoryRoutes } from "./routes/categories.js";
import { appRoutes } from "./routes/apps.js";
import { keywordRoutes } from "./routes/keywords.js";
import { adminRoutes } from "./routes/admin.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const db = createDb(databaseUrl);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Auth middleware — checks API_KEY header for admin routes
const apiKey = process.env.API_KEY;
app.decorate("db", db);

app.addHook("onRequest", async (request, reply) => {
  if (apiKey && request.url.startsWith("/api/admin")) {
    const provided = request.headers["x-api-key"];
    if (provided !== apiKey) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  }
});

// Register routes
await app.register(categoryRoutes, { prefix: "/api/categories" });
await app.register(appRoutes, { prefix: "/api/apps" });
await app.register(keywordRoutes, { prefix: "/api/keywords" });
await app.register(adminRoutes, { prefix: "/api/admin" });

// Error handler
app.setErrorHandler((error: any, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({
    error: error.message || "Internal Server Error",
  });
});

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`API server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
