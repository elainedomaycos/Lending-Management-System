const fs = require('node:fs');

for (const f of ['package-lock.json', 'yarn.lock']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const userAgent = process.env.npm_config_user_agent || '';
if (!userAgent.startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}