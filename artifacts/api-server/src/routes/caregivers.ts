import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, caregiverInvitesTable, usersTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router: IRouter = Router();

router.get("/caregivers/invite/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [invite] = await db
    .select()
    .from(caregiverInvitesTable)
    .where(eq(caregiverInvitesTable.token, token));

  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "Invalid or expired invitation" });
    return;
  }

  const [parent] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, invite.parentUserId));

  res.json({
    email: invite.email,
    parentName: parent?.displayName || parent?.email || "A SafeWatch user",
  });
});

router.post("/caregivers/accept", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId || !req.firebaseUid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { token } = req.body;

  const [invite] = await db
    .select()
    .from(caregiverInvitesTable)
    .where(eq(caregiverInvitesTable.token, token));

  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "Invalid or expired invitation" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      role: "caregiver",
      parentAccountId: invite.parentUserId,
    })
    .where(eq(usersTable.id, req.userId));

  await db
    .update(caregiverInvitesTable)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
    })
    .where(eq(caregiverInvitesTable.id, invite.id));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId));

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

export default router;
