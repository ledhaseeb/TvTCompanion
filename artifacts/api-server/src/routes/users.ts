import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router: IRouter = Router();

router.get("/users/me", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.firebaseUid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.firebaseUid, req.firebaseUid));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    parentAccountId: user.parentAccountId,
    isFoundingMember: user.isFoundingMember,
  });
});

router.post("/users/me", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.firebaseUid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.firebaseUid, req.firebaseUid));

  if (existing) {
    res.json({
      id: existing.id,
      firebaseUid: existing.firebaseUid,
      email: existing.email,
      displayName: existing.displayName,
      role: existing.role,
      parentAccountId: existing.parentAccountId,
      isFoundingMember: existing.isFoundingMember,
    });
    return;
  }

  const admin = await import("firebase-admin");
  let email = "";
  let displayName = req.body?.displayName || null;

  try {
    const firebaseUser = await admin.default.auth().getUser(req.firebaseUid);
    email = firebaseUser.email || "";
    if (!displayName) {
      displayName = firebaseUser.displayName || null;
    }
  } catch {
    email = "unknown@example.com";
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      firebaseUid: req.firebaseUid,
      email,
      displayName,
      role: "parent",
    })
    .returning();

  res.status(201).json({
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    parentAccountId: user.parentAccountId,
    isFoundingMember: user.isFoundingMember,
  });
});

export default router;
