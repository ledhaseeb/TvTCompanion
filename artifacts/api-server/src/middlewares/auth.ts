import { type Request, type Response, type NextFunction } from "express";
import admin from "firebase-admin";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    admin.initializeApp();
  }
}

export interface AuthRequest extends Request {
  firebaseUid?: string;
  userId?: string;
  userRole?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No authorization token provided" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUid = decoded.uid;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, decoded.uid));

    if (user) {
      req.userId = user.id;
      req.userRole = user.role;
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}
