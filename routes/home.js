import express from "express";
import { pool } from "../services/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// Récupérer toutes les playlists de l'utilisateur
router.get("/playlists", authenticateToken, async (req, res) => {
  const userId = req.user;
  try {
    const playlistsResult = await pool.query("SELECT * FROM playlists WHERE user_id=$1", [userId]);
    const playlists = playlistsResult.rows;

    // Optionnel : récupérer les tracks pour chaque playlist
    for (const pl of playlists) {
      const tracksResult = await pool.query(
        `SELECT t.* 
         FROM playlist_tracks pt
         JOIN tracks t ON pt.track_id = t.id
         WHERE pt.playlist_id = $1
         ORDER BY pt.position ASC`,
        [pl.id]
      );
      pl.tracks = tracksResult.rows || [];
    }

    res.json(playlists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Récupérer les morceaux récemment joués
router.get("/recently-played", authenticateToken, async (req, res) => {
  const userId = req.user;
  try {
    const result = await pool.query(`
      SELECT t.*, rp.played_at
      FROM recently_played rp
      JOIN tracks t ON rp.track_id = t.id
      WHERE rp.user_id=$1
      ORDER BY rp.played_at DESC
      LIMIT 20
    `, [userId]);
    res.json(result.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Ajouter un morceau aux récemment joués
router.post("/recently-played/:trackId", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { trackId } = req.params;
  try {
    // Supprime l'entrée si déjà existante pour éviter doublons
    await pool.query(
      "DELETE FROM recently_played WHERE user_id=$1 AND track_id=$2",
      [userId, trackId]
    );

    // Insère la nouvelle entrée avec timestamp actuel
    await pool.query(
      "INSERT INTO recently_played (user_id, track_id, played_at) VALUES ($1, $2, NOW())",
      [userId, trackId]
    );

    res.json({ message: "Track added to recently played" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
