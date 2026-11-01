const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../frontend-react/src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');
css = css.replace(
    "font-family: 'Inter', sans-serif;",
    "font-family: 'Geist', 'Noto Sans Devanagari', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
);
fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ CSS font-family updated with Noto Sans Devanagari fallback!');

