export async function GET() {
  const content = `# AppRanks.io
> Multi-platform app marketplace intelligence and analytics

AppRanks tracks apps across 11 major platforms: Shopify, Salesforce, Canva, Wix, WordPress, Google Workspace, Atlassian, Zoom, Zoho, Zendesk, and HubSpot.

## What We Track
- App rankings, reviews, and pricing across platforms
- Category performance and trends
- Keyword search rankings and visibility scores
- Featured/promoted app placements
- Developer profiles and portfolios
- Competitive analysis and market intelligence

## Public Page Types
- /apps/{platform}/{slug} — App detail with reviews, rankings, pricing
- /categories/{platform}/{slug} — Category with ranked apps
- /developers/{platform}/{slug} — Developer profile with apps
- /compare/{platform}/{app1}-vs-{app2} — Side-by-side app comparison
- /best/{platform}/{category} — Best apps in category
- /trends/{platform} — Market trends and statistics
- /insights/{platform}/keywords/{slug} — Keyword search insights
- /keywords/{platform}/{slug} — Keyword detail with rankings

## Data Coverage
- 11 platforms with daily data collection
- Historical ranking data for trend analysis
- Review sentiment and velocity tracking
- Pricing plan change detection
- Featured placement tracking

## Update Frequency
- App data: refreshed every 12-24 hours
- Rankings: daily snapshots
- Reviews: daily collection

## Contact
- Website: https://appranks.io
- Support: support@appranks.io
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
