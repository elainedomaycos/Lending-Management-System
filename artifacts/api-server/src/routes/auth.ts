import { Router, type IRouter } from "express";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { LoginRequest } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const candidate = scryptSync(pin, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(candidate, expected);
}

router.post("/login", async (req, res) => {
  const parsed = LoginRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "PIN must be 4 to 6 digits." });
    return;
  }

  try {
    const { db, users } = await import("@workspace/db");
    const [owner] = await db
      .select()
      .from(users)
      .orderBy(users.createdAt)
      .limit(1);

    if (!owner) {
      res.status(500).json({
        ok: false,
        error:
          "No user is configured. Seed the users table via the database migration.",
      });
      return;
    }

    if (!verifyPin(parsed.data.pin, owner.pinHash)) {
      res.status(401).json({ ok: false, error: "Incorrect PIN. Please try again." });
      return;
    }

    res.json({ ok: true, name: owner.name });
  } catch (err) {
    logger.error({ err }, "auth login failed");
    res.status(500).json({
      ok: false,
      error: "Login is temporarily unavailable. Check the database connection.",
    });
  }
});

export default router;