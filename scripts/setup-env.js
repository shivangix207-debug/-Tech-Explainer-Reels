// Copies backend/.env.example -> backend/.env if it doesn't already exist yet.
// This lets a brand-new user run "npm run setup:env" once instead of manually
// copying and renaming a file. It NEVER overwrites an existing .env, so it's
// always safe to run again.
const fs = require("fs");
const path = require("path");

const examplePath = path.join(__dirname, "..", "backend", ".env.example");
const targetPath = path.join(__dirname, "..", "backend", ".env");

if (fs.existsSync(targetPath)) {
  console.log("backend/.env already exists — leaving it untouched.");
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error("Could not find backend/.env.example — nothing to copy.");
  process.exit(1);
}

fs.copyFileSync(examplePath, targetPath);
console.log("Created backend/.env from backend/.env.example");
console.log("Next step: open backend/.env and paste in your GEMINI_API_KEY (and adjust MONGO_URI/JWT_SECRET if needed).");
