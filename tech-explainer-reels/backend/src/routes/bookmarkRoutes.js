const express = require("express");
const router = express.Router();
const { getMyBookmarks, addBookmark, removeBookmark } = require("../controllers/bookmarkController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/", getMyBookmarks);
router.post("/:reelId", addBookmark);
router.delete("/:reelId", removeBookmark);

module.exports = router;
