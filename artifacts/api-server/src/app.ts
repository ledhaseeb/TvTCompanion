import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import router from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", router);

export default app;
