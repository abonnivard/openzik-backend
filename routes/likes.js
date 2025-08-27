import express from "express";
import { pool } from "../services/db.js";
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
    req.user = decoded.id; // ajoute info user au req pour usage futur
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// GET liked tracks for a user
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user;
  try {
    const result = await pool.query(
      `SELECT t.* FROM liked_tracks lt
       JOIN tracks t ON lt.track_id = t.id
       WHERE lt.user_id = $1
       ORDER BY lt.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST like a track
router.post("/", authenticateToken, async (req, res) => {
  const trackId = req.body.trackId;
  const userId = req.user;

  try {
    const result = await pool.query(
      "INSERT INTO liked_tracks (user_id, track_id) VALUES ($1, $2) RETURNING *",
      [userId, trackId]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ message: "Already liked" });
    res.status(500).json({ message: e.message });
  }
});

// DELETE unlike a track
router.delete("/", authenticateToken, async (req, res) => {
  const trackId = req.body.trackId;
  const userId = req.user;
  try {
    await pool.query(
      "DELETE FROM liked_tracks WHERE user_id=$1 AND track_id=$2",
      [userId, trackId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
