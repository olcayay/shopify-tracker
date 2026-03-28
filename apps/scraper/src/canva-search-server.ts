import Fastify from "fastify";
import { CanvaModule } from "./platforms/canva/index.js";
import { createLogger } from "@appranks/shared";

const log = createLogger("canva-search-server");
const PORT = parseInt(process.env.CANVA_SEARCH_PORT || "3002", 10);
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let canva: CanvaModule | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (canva) {
      log.info("idle timeout reached, closing browser");
      await canva.closeBrowser();
      canva = null;
    }
  }, IDLE_TIMEOUT_MS);
}

function getCanva(): CanvaModule {
  if (!canva) {
    canva = new CanvaModule();
  }
  resetIdleTimer();
  return canva;
}

const app = Fastify({ logger: false });

app.get("/health", async () => {
  return {
    status: "ok",
    browserActive: canva !== null,
    uptime: process.uptime(),
  };
});

app.get("/canva-search", async (request, reply) => {
  const { q } = request.query as { q?: string };
  if (!q || q.length < 1) {
    return reply.code(400).send({ error: "q parameter is required" });
  }

  log.info("search request", { keyword: q });
  const start = Date.now();

  try {
    const module = getCanva();
    const result = await module.liveSearch(q);

    // Map Canva's internal format (A=id, B=name, C=description, D=icon) to SearchApp
    const apps = (result.C || []).map((app: any, idx: number) => {
      const urlSlug = (app.B || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return {
        position: idx + 1,
        app_slug: urlSlug ? `${app.A}--${urlSlug}` : app.A,
        app_name: app.B || app.A,
        short_description: app.C || "",
        average_rating: 0,
        rating_count: 0,
        logo_url: app.D || undefined,
        is_sponsored: false,
        is_built_in: false,
        is_built_for_shopify: false,
      };
    });

    log.info("search complete", { keyword: q, apps: apps.length, ms: Date.now() - start });

    return {
      keyword: q,
      totalResults: result.A || apps.length,
      apps,
      source: "live",
    };
  } catch (err: any) {
    log.error("search failed", { keyword: q, error: err.message });

    // If browser is broken, kill it so next request gets a fresh one
    if (canva) {
      try { await canva.closeBrowser(); } catch (err) { log.warn("failed to close browser during cleanup", { error: String(err) }); }
      canva = null;
    }

    return reply.code(500).send({ error: `Search failed: ${err.message}` });
  }
});

// Graceful shutdown
async function shutdown(signal: string) {
  log.info(`${signal} received, shutting down`);
  if (idleTimer) clearTimeout(idleTimer);
  if (canva) {
    await canva.closeBrowser();
    canva = null;
  }
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  log.info(`Canva search server listening on port ${PORT}`);
  log.info("Browser will launch on first search request");
  resetIdleTimer();
});
