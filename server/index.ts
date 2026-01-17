import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";
import { logger, logApiError } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Disable X-Powered-By header to hide framework information
app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "OK", message: "Server is running" });
});

app.get("/api/config", (req: Request, res: Response) => {
  res.json({
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api", apiRoutes);

// Serve output directory for generated files
app.use("/output", express.static(path.join(process.cwd(), "output")));

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client")));

  app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
  });
}

// Global error handler - must be after all routes
app.use((err: Error, req: Request, res: Response, __next: NextFunction) => {
  logApiError(err, {
    path: req.path,
    method: req.method,
    statusCode: 500,
  });
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info("Server started", { port: PORT });
});
