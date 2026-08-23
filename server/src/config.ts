import dotenv from "dotenv";
import path from "node:path";
dotenv.config();

export const CONFIG = {
  PORT: Number.parseInt(process.env.PORT || "3000", 10),
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  DATA_DIR: path.resolve(process.cwd(), "data"),
  CLIENT_DIST: path.resolve(process.cwd(), "dist/client")
};
