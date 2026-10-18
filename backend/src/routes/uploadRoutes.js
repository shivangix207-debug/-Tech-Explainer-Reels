const express = require("express");
const router = express.Router();
const { uploadVideo } = require("../controllers/uploadController");
const { protect, authorize } = require("../middleware/auth");

router.post("/video", protect, authorize("creator", "admin"), uploadVideo);

module.exports = router;
