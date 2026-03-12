import { Router, type IRouter } from "express";
import { db, sessionFeedbackTable, behaviorRatingsTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router: IRouter = Router();

router.post("/feedback/:sessionId/complete", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { skipped, behaviorRatings, participationPcts } = req.body;

  const [feedback] = await db
    .insert(sessionFeedbackTable)
    .values({
      sessionId,
      skipped: skipped || false,
    })
    .returning();

  if (!skipped && behaviorRatings && behaviorRatings.length > 0) {
    for (const rating of behaviorRatings) {
      await db.insert(behaviorRatingsTable).values({
        feedbackId: feedback.id,
        childId: rating.childId,
        behaviorRating: rating.behaviorRating,
        participationPct: participationPcts?.[rating.childId] ?? 100,
      });
    }
  }

  res.json({ success: true });
});

export default router;
