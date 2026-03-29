import { colors, sizes } from "../design-tokens.js";

interface TableRow {
  cells: string[];
  changeValue?: number | null;
}

/** Ranking/comparison table with optional color-coded change column */
export function dataTable(headers: string[], rows: TableRow[]): string {
  const headerHtml = headers
    .map((h) => `<th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:${colors.darkMuted};border-bottom:2px solid ${colors.border};">${h}</th>`)
    .join("");

  const rowsHtml = rows
    .map((row) => {
      const cellsHtml = row.cells
        .map((cell) => `<td style="padding:10px 12px;border-bottom:1px solid ${colors.border};font-size:14px;">${cell}</td>`)
        .join("");

      let changeCell = "";
      if (row.changeValue !== undefined && row.changeValue !== null) {
        const color = row.changeValue > 0 ? colors.green : row.changeValue < 0 ? colors.red : colors.darkMuted;
        const arrow = row.changeValue > 0 ? "&#9650;" : row.changeValue < 0 ? "&#9660;" : "&#8211;";
        changeCell = `<td style="padding:10px 12px;border-bottom:1px solid ${colors.border};font-size:14px;color:${color};font-weight:600;">${arrow} ${Math.abs(row.changeValue)}</td>`;
      }

      return `<tr>${cellsHtml}${changeCell}</tr>`;
    })
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${sizes.paddingSmall} 0;">
<thead><tr>${headerHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>`;
}
