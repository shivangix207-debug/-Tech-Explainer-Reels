// Creates (or promotes) the initial administrator from environment variables. Nothing is hardcoded.
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create-admin
// Values can also live in backend/.env. Add --reset-password to change the password of an existing admin.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (env vars or backend/.env)");
  if (ADMIN_PASSWORD.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");

  await mongoose.connect(MONGO_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email }).select("+password");
  if (!existing) {
    await User.create({ name: "Platform Admin", email, password: ADMIN_PASSWORD, role: "admin" });
    console.log(`Admin created: ${email}`);
  } else {
    existing.role = "admin"; existing.isActive = true;
    if (process.argv.includes("--reset-password")) existing.password = ADMIN_PASSWORD;
    await existing.save();
    console.log(`Existing user ${email} is now an admin${process.argv.includes("--reset-password") ? " (password reset)" : " (password unchanged)"}.`);
  }
  await mongoose.disconnect();
};
run().then(() => process.exit(0)).catch((e) => { console.error("create-admin failed:", e.message); process.exit(1); });
