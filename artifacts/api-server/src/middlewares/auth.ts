import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: Record<string, string> = {};
let certsExpiry = 0;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpiry && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Google certs");

  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  certsExpiry = Date.now() + maxAge * 1000;

  cachedCerts = (await res.json()) as Record<string, string>;
  return cachedCerts;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf-8");
}

function pemToCryptoKey(pem: string): Buffer {
  return Buffer.from(pem);
}

interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  auth_time: number;
  user_id: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  firebase?: {
    sign_in_provider: string;
    identities: Record<string, unknown>;
  };
}

async function verifyFirebaseToken(
  idToken: string,
): Promise<FirebaseTokenPayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const headerStr = base64UrlDecode(parts[0]);
  const header = JSON.parse(headerStr) as { alg: string; kid: string };

  if (header.alg !== "RS256") throw new Error("Unsupported algorithm");

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Unknown signing key");

  const crypto = await import("crypto");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  const signatureBuffer = Buffer.from(
    parts[2].replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
  const isValid = verifier.verify(cert, signatureBuffer);

  if (!isValid) throw new Error("Invalid signature");

  const payloadStr = base64UrlDecode(parts[1]);
  const payload = JSON.parse(payloadStr) as FirebaseTokenPayload;

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp < now) throw new Error("Token expired");
  if (payload.iat > now + 300) throw new Error("Token issued in the future");
  if (payload.aud !== FIREBASE_PROJECT_ID)
    throw new Error("Invalid audience");
  if (
    payload.iss !==
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  )
    throw new Error("Invalid issuer");
  if (!payload.sub || payload.sub.length === 0)
    throw new Error("Invalid subject");

  return payload;
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
    const decoded = await verifyFirebaseToken(token);
    req.firebaseUid = decoded.sub;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, decoded.sub));

    if (user) {
      req.userId = user.id;
      req.userRole = user.role;
    }

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid token";
    res.status(401).json({ error: message });
    return;
  }
}
