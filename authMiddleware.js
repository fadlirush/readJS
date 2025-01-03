const jwt = require("jsonwebtoken");
const JWT_SECRET = "your_jwt_secret_key";
function authMiddleware(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (Date.now() >= decoded.exp * 1000) {
      res.clearCookie("token");
      activeSessions.delete(decoded.username);
      console.log(`Session expired and cleared for user: ${decoded.username}`);
      return res.redirect("/");
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie("token");
    if (err instanceof jwt.TokenExpiredError) {
      const decoded = jwt.decode(token);
      activeSessions.delete(decoded.username);
    }
    return res.redirect("/");
  }
}

module.exports = authMiddleware;
