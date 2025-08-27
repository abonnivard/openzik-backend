import express from "express";
import jwt from "jsonwebtoken";
import { ensureSpotifyToken, searchSpotify } from "../services/spotify.js";

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

// /search?q=...
router.get("/", authenticateToken, ensureSpotifyToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    const results = await searchSpotify(q);
    res.json(results);
  } catch (err) {
    console.error("Error in /search:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
