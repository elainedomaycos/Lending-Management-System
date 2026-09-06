import { scryptSync, randomBytes } from "node:crypto";

const raw = process.argv[2];
if (!raw || !/^\d{4,6}$/.test(raw)) {
  console.error("Usage: pnpm --filter @workspace/scripts set-pin <4-6 digit PIN>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(raw, salt, 64, { N: 16384, r: 8, p: 1 });
const stored = `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;

console.log(stored);
console.log(
  `update public.users set pin_hash = '${stored}' where name = 'Thine & Alvin';`,
);