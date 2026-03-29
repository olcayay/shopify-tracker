import { colors, fonts, sizes } from "../design-tokens.js";

/** Base HTML email wrapper with responsive meta tags */
export function emailLayout(body: string, previewText = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>AppRanks</title>
<style>
  body { margin: 0; padding: 0; background: ${colors.light}; font-family: ${fonts.body}; color: ${colors.dark}; line-height: 1.6; }
  .container { max-width: ${sizes.maxWidth}; margin: 0 auto; background: ${colors.white}; border-radius: ${sizes.borderRadius}; }
  img { max-width: 100%; }
  a { color: ${colors.primary}; text-decoration: none; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a2e !important; color: #e0e0e0 !important; }
    .container { background: #16213e !important; }
  }
</style>
${previewText ? `<span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>` : ""}
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.light};padding:${sizes.padding} 0;">
<tr><td align="center">
<div class="container" style="max-width:${sizes.maxWidth};margin:0 auto;background:${colors.white};border-radius:${sizes.borderRadius};overflow:hidden;">
${body}
</div>
</td></tr>
</table>
</body>
</html>`;
}
