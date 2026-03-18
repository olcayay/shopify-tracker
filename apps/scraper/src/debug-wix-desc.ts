import { HttpClient } from "./http-client.js";
import { extractReactQueryState } from "./platforms/wix/parsers/app-parser.js";

async function main() {
  const http = new HttpClient({ delayMs: 0 });

  const html = await http.fetchPage("https://www.wix.com/app-market/web-solution/123formbuilder");
  const state = extractReactQueryState(html);
  if (!state?.queries) { console.log("No queries"); process.exit(1); }

  for (const q of state.queries) {
    const key = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
    if (typeof key === "string" && key.startsWith("app-page-")) {
      const data = q.state?.data;
      const desc = data?.overview?.description;
      console.log("=== Raw description (first 1000 chars) ===");
      console.log(JSON.stringify(desc).substring(0, 1000));
      console.log("\n=== Rendered description ===");
      console.log(desc?.substring(0, 1000));
      break;
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
