export const APP_ENV = import.meta.env.VITE_APP_ENV || 'local';
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || 'false').toLowerCase() === 'true';
export const API_BASE_ENV = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

export const isProductionApp = APP_ENV === 'production';
export const isStagingApp = APP_ENV === 'staging';
export const isLocalApp = APP_ENV === 'local';
