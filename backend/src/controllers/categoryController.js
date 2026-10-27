const Category = require("../models/Category");
const Reel = require("../models/Reel");
const { asyncHandler } = require("../middleware/errorHandler");

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// @route GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });

  const counts = await Reel.aggregate([
    { $match: { isPublished: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  const result = categories.map((c) => ({
    ...c.toObject(),
    reelCount: countMap[c._id.toString()] || 0,
  }));

  res.json({ success: true, categories: result });
});

// @route POST /api/categories (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, color } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

  const category = await Category.create({ name, slug: slugify(name), description, icon, color });
  res.status(201).json({ success: true, category });
});

// @route PUT /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  const { name, description, icon, color } = req.body;
  if (name) {
    category.name = name;
    category.slug = slugify(name);
  }
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;

  await category.save();
  res.json({ success: true, category });
});

// @route DELETE /api/categories/:id (admin)
const deleteCategory = asyncHandler(async (req, res) => {
  const inUse = await Reel.countDocuments({ category: req.params.id });
  if (inUse > 0) {
    return res.status(400).json({ success: false, message: `Cannot delete: ${inUse} reel(s) use this category` });
  }
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  await category.deleteOne();
  res.json({ success: true, message: "Category deleted" });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
