// Centralized error handler. Any next(err) or thrown error in an async route
// (wrapped by asyncHandler) ends up here.
const errorHandler = (err, req, res, next) => {
  // Full details are logged server-side only; clients never receive stack traces.
  if (process.env.NODE_ENV !== "test") console.error(err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Server Error";

  if (err.name === "CastError") {
    statusCode = err.path === "_id" ? 404 : 400;
    message = err.path === "_id" ? "Resource not found" : `Invalid value for ${err.path}`;
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  if (err.type === "entity.parse.failed") { statusCode = 400; message = "Malformed JSON body"; }
  if (err.type === "entity.too.large") { statusCode = 413; message = "Request body too large"; }
  if (statusCode >= 500 && process.env.NODE_ENV === "production") message = "Server error";

  res.status(statusCode).json({ success: false, message });
};

const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

// Wraps async route handlers so thrown errors are forwarded to errorHandler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, notFound, asyncHandler };
