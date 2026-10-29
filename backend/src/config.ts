import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name} (see .env.example)`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 16 || jwtSecret.startsWith('change-this')) {
  throw new Error('JWT_SECRET must be a long random string (at least 16 characters). Edit your .env file.');
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'roman_urdu_feedback',
  },
  jwtSecret,
  modelServiceUrl: process.env.MODEL_SERVICE_URL ?? 'http://127.0.0.1:8000',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
