import pino from 'pino';

/**
 * Simple logger configuration.  By default it logs at the `info` level and
 * pretty‑prints output.  You can override the log level by setting
 * `LOG_LEVEL` in your environment.  See https://github.com/pinojs/pino for
 * more options.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});