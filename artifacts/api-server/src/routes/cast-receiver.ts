import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

const currentDir = (() => {
  try {
    return path.dirname(new URL(import.meta.url).pathname);
  } catch {
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
})();

let cachedHtml: string | null = null;

function loadCastReceiverHtml(): string {
  if (cachedHtml) return cachedHtml;
  const htmlPath = path.resolve(currentDir, "..", "..", "public", "cast-receiver.html");
  cachedHtml = fs.readFileSync(htmlPath, "utf-8");
  return cachedHtml;
}

router.get("/cast-receiver", (_req, res) => {
  const html = loadCastReceiverHtml();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.send(html);
});

router.get("/cast-receiver.html", (_req, res) => {
  const html = loadCastReceiverHtml();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.send(html);
});

export default router;
