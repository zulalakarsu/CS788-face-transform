import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  data?: any;
  source?: string;
}

class Logger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private createLogEntry(level: LogEntry['level'], message: string, data?: any, source?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source
    };
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}.log`;
      const filepath = path.join(this.logDir, filename);
      
      const logLine = `[${entry.timestamp}] ${entry.level} ${entry.source ? `[${entry.source}]` : ''} ${entry.message}`;
      const logData = entry.data ? `\nData: ${JSON.stringify(entry.data, null, 2)}` : '';
      const fullLog = `${logLine}${logData}\n`;
      
      fs.appendFileSync(filepath, fullLog);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogEntry['level'], message: string, data?: any, source?: string): void {
    const entry = this.createLogEntry(level, message, data, source);
    
    // Always log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMessage = `[${level}] ${source ? `[${source}]` : ''} ${message}`;
      switch (level) {
        case 'ERROR':
          console.error(consoleMessage, data || '');
          break;
        case 'WARN':
          console.warn(consoleMessage, data || '');
          break;
        case 'DEBUG':
          console.debug(consoleMessage, data || '');
          break;
        default:
          console.log(consoleMessage, data || '');
      }
    }

    // Write to file
    this.writeToFile(entry);
  }

  info(message: string, data?: any, source?: string): void {
    this.log('INFO', message, data, source);
  }

  warn(message: string, data?: any, source?: string): void {
    this.log('WARN', message, data, source);
  }

  error(message: string, data?: any, source?: string): void {
    this.log('ERROR', message, data, source);
  }

  debug(message: string, data?: any, source?: string): void {
    this.log('DEBUG', message, data, source);
  }

  // Training-specific logging
  training = {
    started: (jobId: string, photoCount: number) => {
      this.info(`Training started for job ${jobId} with ${photoCount} photos`, { jobId, photoCount }, 'TRAINING');
    },
    
    statusUpdated: (jobId: string, status: string, progress?: number) => {
      this.info(`Training job ${jobId} status: ${status}`, { jobId, status, progress }, 'TRAINING');
    },
    
    completed: (jobId: string, modelVersion: string) => {
      this.info(`Training completed for job ${jobId}, model: ${modelVersion}`, { jobId, modelVersion }, 'TRAINING');
    },
    
    failed: (jobId: string, error: string) => {
      this.error(`Training failed for job ${jobId}: ${error}`, { jobId, error }, 'TRAINING');
    }
  };

  // Generation-specific logging
  generation = {
    started: (requestId: string, modelVersion: string, type: string) => {
      this.info(`Generation started for request ${requestId} using model ${modelVersion}`, { requestId, modelVersion, type }, 'GENERATION');
    },
    
    completed: (requestId: string, imageUrl: string, seed: number) => {
      this.info(`Generation completed for request ${requestId}`, { requestId, imageUrl, seed }, 'GENERATION');
    },
    
    failed: (requestId: string, error: string) => {
      this.error(`Generation failed for request ${requestId}: ${error}`, { requestId, error }, 'GENERATION');
    }
  };
}

export const logger = new Logger();