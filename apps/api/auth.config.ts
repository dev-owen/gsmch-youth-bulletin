// Better Auth CLI configuration. Runtime configuration is in src/auth.ts.
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:8787',
  trustedOrigins: [process.env.WEB_ORIGIN || 'http://localhost:5173'],
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'replace-me',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'replace-me',
    },
  },
});
