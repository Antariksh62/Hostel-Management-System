const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'backend', 'routes');
const files = fs.readdirSync(routesDir);

const inventory = {};
let totalEndpoints = 0;

files.forEach(f => {
  const content = fs.readFileSync(path.join(routesDir, f), 'utf8');
  const regex = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  let match;
  inventory[f] = [];
  while ((match = regex.exec(content)) !== null) {
    inventory[f].push({ method: match[1].toUpperCase(), path: match[2] });
    totalEndpoints++;
  }
});

console.log('=== HOSTEL HUB ROUTE INVENTORY ===');
for (const [file, routes] of Object.entries(inventory)) {
  console.log(`\n${file} (${routes.length} routes):`);
  routes.forEach(r => console.log(`  ${r.method.padEnd(6)} ${r.path}`));
}
console.log(`\nTotal registered route endpoints: ${totalEndpoints}`);

