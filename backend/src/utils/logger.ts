/**
 * 结构化日志 (V1.30)
 *
 * - 开发模式: 彩色 + 人类可读
 * - 生产模式: JSON 行, 便于 logstash / loki / cloudwatch 收集
 * - 输出: stdout (容器友好) + 可选文件 (backend/logs/avm-YYYY-MM-DD.log)
 */
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../env';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_DIR = path.join(process.cwd(), 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/** 自定义格式化: 生产 JSON, 开发 console */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${message}${metaStr}`;
  }),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: IS_PRODUCTION ? productionFormat : developmentFormat,
  defaultMeta: { service: 'avm-backend' },
  transports: [
    // stdout: 容器 / pm2 友好
    new winston.transports.Console(),
  ],
});

// 生产环境额外写文件 (轮转由 winston-daily-rotate-file 可选)
if (IS_PRODUCTION) {
  logger.add(new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 7,
  }));
  logger.add(new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 7,
  }));
}

/** 子 logger, 便于按模块分类 */
export const authLogger = logger.child({ module: 'auth' });
export const dbLogger = logger.child({ module: 'db' });
export const apiLogger = logger.child({ module: 'api' });
export const aiLogger = logger.child({ module: 'ai' });
