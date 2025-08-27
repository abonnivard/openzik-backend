import express from "express";
import { getLibrary } from "../services/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware pour vérifier le token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded; // ajoute info user au req pour usage futur
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}


// /library
router.get("/", authenticateToken, async (req, res) => {
  try {
    const tracks = await getLibrary();
    res.json(tracks);
  } catch (err) {
    console.error("Error in /library:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
