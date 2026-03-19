import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionFeedbackTable, sessionsTable, childrenTable, usersTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

function getOwnerId(user: { id: string; role: string; parentAccountId: string | null }): string {
  return user.role === "caregiver" && user.parentAccountId ? user.parentAccountId : user.id;
}

const router: IRouter = Router();

router.post("/feedback/:sessionId/complete", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const ownerId = getOwnerId(user);
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session || (session.userId !== user.id && session.userId !== ownerId)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { skipped, behaviorRating, childId, behaviorRatings, participationPcts } = req.body;

  await db
    .update(sessionsTable)
    .set({ feedbackCompletedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));

  const now = new Date();
  const hours = now.getHours();
  const timeOfDay = hours < 12 ? "morning" : hours < 17 ? "afternoon" : "evening";
  const baseMins = Math.round((session.totalDurationSeconds || 0) / 60);

  if (skipped) {
    await db.insert(sessionFeedbackTable).values({
      sessionId,
      skipped: true,
    });
  } else if (behaviorRatings && behaviorRatings.length > 0) {
    for (const rating of behaviorRatings) {
      const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, rating.childId));
      if (child && (child.userId === user.id || child.userId === ownerId)) {
        const pct = participationPcts?.[rating.childId] ?? 100;
        await db.insert(sessionFeedbackTable).values({
          sessionId,
          childId: rating.childId,
          behaviorRating: rating.behaviorRating,
          wasOverride: 0,
          timeOfDay,
          totalMinutesWatched: Math.round(baseMins * pct / 100),
          skipped: false,
        });
      }
    }
  } else if (behaviorRating && childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
    if (child && (child.userId === user.id || child.userId === ownerId)) {
      const pct = participationPcts?.[childId] ?? 100;
      await db.insert(sessionFeedbackTable).values({
        sessionId,
        childId,
        behaviorRating,
        wasOverride: 0,
        timeOfDay,
        totalMinutesWatched: Math.round(baseMins * pct / 100),
        skipped: false,
      });
    }
  }

  res.json({ success: true });
});

export default router;
