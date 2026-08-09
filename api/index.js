// Vercel serverless entry point. Express app exported as the default handler;
// Vercel's api/ directory maps this file to /api/*.
import app from '../server/app.js'

export const config = {
  maxDuration: 30,
}

export default app
