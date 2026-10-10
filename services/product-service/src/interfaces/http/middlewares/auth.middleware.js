function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = (req.headers["x-user-role"] || "").toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    if (!userRole || !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Forbidden: insufficient permissions"
      });
    }
    next();
  };
}

module.exports = { requireRole };
