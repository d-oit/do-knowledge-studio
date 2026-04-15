export const logger = {
  info: (msg: string, data?: unknown): void => {
    console.log(`[INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (msg: string, data?: unknown): void => {
    console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (msg: string, data?: unknown): void => {
    console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  },
};
