import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import type { Request, Response } from "express";

const logsDir = path.join(process.cwd(), "logs");

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Application log transport (info level and above)
const appTransport = new DailyRotateFile({
  filename: path.join(logsDir, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  level: "info",
});

// Error log transport (error level only)
const errorTransport = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
  level: "error",
});

// Handle transport errors
appTransport.on("error", (error) => {
  console.error("App log transport error:", error);
});

errorTransport.on("error", (error) => {
  console.error("Error log transport error:", error);
});

// Create logger instance
export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [appTransport, errorTransport],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }),
      ),
    }),
  );
}

// Convenience methods for API error logging
export const logApiError = (
  error: Error | unknown,
  context: {
    path?: string;
    method?: string;
    statusCode?: number;
    userId?: string;
    [key: string]: unknown;
  } = {},
) => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error(errorObj.message, {
    stack: errorObj.stack,
    ...context,
  });
};

export const logApiRequest = (
  message: string,
  context: {
    path?: string;
    method?: string;
    duration?: number;
    [key: string]: unknown;
  } = {},
) => {
  logger.info(message, context);
};

// Helper for logging API error responses (non-crash errors returned to client)
export const logApiErrorResponse = (
  errorMessage: string,
  context: {
    path?: string;
    method?: string;
    statusCode?: number;
    details?: string;
    [key: string]: unknown;
  } = {},
) => {
  logger.warn("API error response", {
    error: errorMessage,
    ...context,
  });
};

// Combined helper: logs error and sends response
export const sendApiError = (
  res: Response,
  req: Request,
  statusCode: number,
  errorMessage: string,
  details?: string,
) => {
  logger.warn("API error response", {
    error: errorMessage,
    path: req.path,
    method: req.method,
    statusCode,
    ...(details ? { details } : {}),
  });
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(details ? { details } : {}),
  });
};
