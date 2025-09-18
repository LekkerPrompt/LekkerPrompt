import fs from 'fs/promises';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile?: string;
  private isElectron: boolean;

  private constructor() {
    this.isElectron = !!(process as any)?.versions?.electron ||
                      process.env.ELECTRON === '1' ||
                      process.env.NEXT_PUBLIC_ELECTRON === '1';

    // Set log level based on environment
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLogLevel && envLogLevel in LogLevel) {
      this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel];
    }

    // Set up log file for Electron mode
    if (this.isElectron && process.env.DATA_DIR) {
      this.logFile = path.join(process.env.DATA_DIR, 'logs', 'promptcrafter.log');
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    let formattedMessage = `[${timestamp}] ${levelName}: ${message}`;

    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` | Context: ${JSON.stringify(context)}`;
    }

    if (error) {
      formattedMessage += ` | Error: ${error.message}`;
      if (error.stack) {
        formattedMessage += `\n${error.stack}`;
      }
    }

    return formattedMessage;
  }

  private async writeToFile(message: string): Promise<void> {
    if (!this.logFile) return;

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });

      // Rotate log file if it gets too large (10MB)
      try {
        const stats = await fs.stat(this.logFile);
        if (stats.size > 10 * 1024 * 1024) {
          const backupFile = `${this.logFile}.${Date.now()}.bak`;
          await fs.rename(this.logFile, backupFile);
        }
      } catch (error) {
        // File doesn't exist yet, that's fine
      }

      await fs.appendFile(this.logFile, message + '\n', 'utf8');
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.logLevel) return;

    const formattedMessage = this.formatMessage(level, message, context, error);

    // Always log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === LogLevel.ERROR ? 'error' :
                           level === LogLevel.WARN ? 'warn' :
                           level === LogLevel.DEBUG ? 'debug' : 'log';
      console[consoleMethod](formattedMessage);
    }

    // Write to file in Electron mode
    if (this.isElectron) {
      this.writeToFile(formattedMessage);
    }

    // In production web mode, you might want to send logs to a service
    // This could be extended to integrate with services like LogRocket, Sentry, etc.
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Specialized logging methods
  apiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string): void {
    this.info('API Request', {
      method,
      path,
      statusCode,
      duration,
      userId
    });
  }

  apiError(method: string, path: string, statusCode: number, error: Error, userId?: string): void {
    this.error('API Error', {
      method,
      path,
      statusCode,
      userId
    }, error);
  }

  databaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    this.info('Database Operation', {
      operation,
      table,
      duration,
      success
    });
  }

  authenticationEvent(event: string, userId?: string, success?: boolean, details?: Record<string, any>): void {
    this.info('Authentication Event', {
      event,
      userId,
      success,
      ...details
    });
  }

  performanceMetric(name: string, value: number, unit: string, context?: Record<string, any>): void {
    this.info('Performance Metric', {
      metric: name,
      value,
      unit,
      ...context
    });
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Helper functions for common logging patterns
export function logAPIRequest(req: Request, res: Response, duration: number, userId?: string): void {
  logger.apiRequest(req.method, new URL(req.url).pathname, res.status, duration, userId);
}

export function logAPIError(req: Request, error: Error, statusCode: number, userId?: string): void {
  logger.apiError(req.method, new URL(req.url).pathname, statusCode, error, userId);
}

export function logDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
  logger.databaseOperation(operation, table, duration, success);
}

export function logAuthEvent(event: string, userId?: string, success?: boolean, details?: Record<string, any>): void {
  logger.authenticationEvent(event, userId, success, details);
}

export function logPerformance(name: string, value: number, unit: string, context?: Record<string, any>): void {
  logger.performanceMetric(name, value, unit, context);
}

// Request ID generator for tracking requests across services
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
