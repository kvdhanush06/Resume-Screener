import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { CONFIG } from "./config.js";
import { apiRouter } from "./routes/api.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", apiRouter);

if (fs.existsSync(CONFIG.CLIENT_DIST)) {
  app.use(express.static(CONFIG.CLIENT_DIST));
  app.get("*", (req, res, next) => (req.path.startsWith("/api") ? next() : res.sendFile(path.join(CONFIG.CLIENT_DIST, "index.html"))));
}

app.listen(CONFIG.PORT, () => {
  console.log(`Resume Screener server running on port ${CONFIG.PORT}`);
});
