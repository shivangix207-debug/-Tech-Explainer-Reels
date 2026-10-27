require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const missing = ["MONGO_URI", "JWT_SECRET"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}.\nCopy backend/.env.example to backend/.env and fill them in (or run: npm run setup:env).`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 16) console.warn("WARNING: JWT_SECRET is short. Use a long random string.");
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.warn("NOTE: GEMINI_API_KEY is not set - AI tutor/notes/quiz will return a clear 'not configured' error. Curated lesson quizzes still work.");
}

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
