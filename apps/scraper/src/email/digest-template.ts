import type { DigestData, RankingChange } from "./digest-builder.js";

function changeIcon(type: RankingChange["type"]): string {
  switch (type) {
    case "improved":
      return "&#9650;"; // ▲
    case "dropped":
      return "&#9660;"; // ▼
    case "new_entry":
      return "&#9733;"; // ★
    case "dropped_out":
      return "&#10005;"; // ✕
    default:
      return "";
  }
}

function changeColor(type: RankingChange["type"]): string {
  switch (type) {
    case "improved":
      return "#16a34a";
    case "dropped":
      return "#dc2626";
    case "new_entry":
      return "#2563eb";
    case "dropped_out":
      return "#9ca3af";
    default:
      return "#6b7280";
  }
}

function posStr(pos: number | null): string {
  return pos !== null ? `#${pos}` : "\u2014";
}

function changeStr(change: number | null, type: RankingChange["type"]): string {
  if (type === "new_entry") return "New";
  if (type === "dropped_out") return "Out";
  if (change === null || change === 0) return "\u2014";
  return change > 0 ? `+${change}` : `${change}`;
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export function buildDigestHtml(data: DigestData): string {
  const { accountName, date, rankingChanges, competitorSummaries, summary } =
    data;

  const summaryParts: string[] = [];
  if (summary.improved > 0)
    summaryParts.push(
      `<span style="color:#16a34a;font-weight:600">${summary.improved} improved</span>`
    );
  if (summary.dropped > 0)
    summaryParts.push(
      `<span style="color:#dc2626;font-weight:600">${summary.dropped} dropped</span>`
    );
  if (summary.newEntries > 0)
    summaryParts.push(
      `<span style="color:#2563eb;font-weight:600">${summary.newEntries} new</span>`
    );
  if (summary.droppedOut > 0)
    summaryParts.push(
      `<span style="color:#9ca3af;font-weight:600">${summary.droppedOut} dropped out</span>`
    );

  let rankingRows = "";
  for (const r of rankingChanges) {
    const badge = r.isTracked
      ? '<span style="background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:3px;font-size:11px;margin-left:4px">tracked</span>'
      : r.isCompetitor
        ? '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-size:11px;margin-left:4px">competitor</span>'
        : "";

    rankingRows += `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 12px;font-size:13px">${r.keyword}</td>
        <td style="padding:8px 12px;font-size:13px">${r.appName}${badge}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center">${posStr(r.yesterdayPosition)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center">${posStr(r.todayPosition)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center;color:${changeColor(r.type)};font-weight:600">
          ${changeIcon(r.type)} ${changeStr(r.change, r.type)}
        </td>
      </tr>`;
  }

  let competitorSection = "";
  if (competitorSummaries.length > 0) {
    let competitorRows = "";
    for (const c of competitorSummaries) {
      const ratingDisplay = c.todayRating
        ? `${parseFloat(c.todayRating).toFixed(1)}`
        : "\u2014";
      const ratingDelta =
        c.ratingChange !== null && c.ratingChange !== 0
          ? `<span style="color:${c.ratingChange > 0 ? "#16a34a" : "#dc2626"};font-size:11px;margin-left:2px">(${c.ratingChange > 0 ? "+" : ""}${c.ratingChange.toFixed(1)})</span>`
          : "";
      const reviewsDisplay =
        c.todayReviews !== null ? c.todayReviews.toLocaleString() : "\u2014";
      const reviewsDelta =
        c.reviewsChange !== null && c.reviewsChange !== 0
          ? `<span style="color:${c.reviewsChange > 0 ? "#16a34a" : "#dc2626"};font-size:11px;margin-left:2px">(${c.reviewsChange > 0 ? "+" : ""}${c.reviewsChange})</span>`
          : "";

      const positionCells = c.keywordPositions
        .filter((kp) => kp.position !== null || kp.change !== null)
        .map((kp) => {
          const posDisplay = kp.position !== null ? `#${kp.position}` : "\u2014";
          const changePart =
            kp.change !== null && kp.change !== 0
              ? `<span style="color:${kp.change > 0 ? "#16a34a" : "#dc2626"};font-size:11px;margin-left:2px">(${kp.change > 0 ? "+" : ""}${kp.change})</span>`
              : "";
          return `${kp.keyword}: ${posDisplay}${changePart}`;
        })
        .join(" &middot; ");

      competitorRows += `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 12px;font-size:13px;font-weight:500">${c.appName}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center">${ratingDisplay}${ratingDelta}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center">${reviewsDisplay}${reviewsDelta}</td>
          <td style="padding:8px 12px;font-size:12px;color:#6b7280">${positionCells || "\u2014"}</td>
        </tr>`;
    }

    competitorSection = `
      <div style="margin-top:32px">
        <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">Competitor Overview</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">App</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500">Rating</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500">Reviews</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Keyword Positions</th>
            </tr>
          </thead>
          <tbody>
            ${competitorRows}
          </tbody>
        </table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden">
      <!-- Header -->
      <div style="background:#111827;padding:20px 24px">
        <h1 style="margin:0;font-size:18px;color:#ffffff;font-weight:600">Daily Ranking Report</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#9ca3af">${accountName} &middot; ${date}</p>
      </div>

      <div style="padding:24px">
        <!-- Summary -->
        <div style="background:#f9fafb;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:14px;color:#374151">
          ${summaryParts.length > 0 ? summaryParts.join(" &middot; ") : "No ranking changes today"}
        </div>

        ${
          rankingChanges.length > 0
            ? `
        <!-- Ranking Changes -->
        <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">Keyword Rankings</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">Keyword</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500">App</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500">Yesterday</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500">Today</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500">Change</th>
            </tr>
          </thead>
          <tbody>
            ${rankingRows}
          </tbody>
        </table>`
            : ""
        }

        ${competitorSection}
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
        <a href="${DASHBOARD_URL}/settings" style="color:#6b7280;font-size:12px;text-decoration:none">Manage email preferences</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildDigestSubject(data: DigestData): string {
  const parts: string[] = [];
  if (data.summary.improved > 0)
    parts.push(`${data.summary.improved} improved`);
  if (data.summary.dropped > 0) parts.push(`${data.summary.dropped} dropped`);
  if (data.summary.newEntries > 0)
    parts.push(`${data.summary.newEntries} new`);

  const detail = parts.length > 0 ? ` \u2014 ${parts.join(", ")}` : "";
  return `Ranking Report ${data.date}${detail}`;
}
