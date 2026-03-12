import { Router, type IRouter } from "express";
import { eq, or, inArray } from "drizzle-orm";
import { db, usersTable, childrenTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router: IRouter = Router();

router.get("/children", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let parentId = req.userId;

  if (req.userRole === "caregiver") {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId));

    if (user?.parentAccountId) {
      parentId = user.parentAccountId;
    }
  }

  const children = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.userId, parentId));

  res.json(children.map(c => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    birthMonth: c.birthMonth,
    birthYear: c.birthYear,
    entertainmentMinutes: c.entertainmentMinutes,
    ageRestrictionOverride: c.ageRestrictionOverride,
    favouritesAgeBypass: c.favouritesAgeBypass,
    eveningProtectionEnabled: c.eveningProtectionEnabled,
    eveningProtectionStartHour: c.eveningProtectionStartHour,
    eveningProtectionMaxStim: c.eveningProtectionMaxStim,
    sensitivity: c.sensitivity,
  })));
});

export default router;
