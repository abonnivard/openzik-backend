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
    req.user = decoded; // ajoute info user au req pour usage futur
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}


// Top 5 des tracks les plus écoutés par l'utilisateur
router.get("/top-tracks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT 
        t.*,
        utp.play_count
      FROM tracks t
      JOIN user_track_plays utp ON t.id = utp.track_id
      WHERE utp.user_id = $1
      ORDER BY utp.play_count DESC
      LIMIT 5
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération top tracks:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Artistes aléatoires (basés sur les tracks écoutés par l'utilisateur)
router.get("/random-artists", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const result = await pool.query(`
      SELECT 
        t.artist,
        MIN(t.image) as image,
        COUNT(DISTINCT utp.track_id) as track_count,
        SUM(utp.play_count) as total_plays
      FROM tracks t
      JOIN user_track_plays utp ON t.id = utp.track_id
      WHERE utp.user_id = $1 AND t.artist IS NOT NULL AND t.artist != ''
      GROUP BY t.artist
      ORDER BY RANDOM()
      LIMIT $2
    `, [userId, limit]);
    
    // Si l'utilisateur n'a pas encore écouté de musique, retourner des artistes globaux
    if (result.rows.length === 0) {
      const globalResult = await pool.query(`
        SELECT 
          artist,
          MIN(image) as image,
          COUNT(*) as track_count
        FROM tracks 
        WHERE artist IS NOT NULL AND artist != ''
        GROUP BY artist
        ORDER BY RANDOM()
        LIMIT $1
      `, [limit]);
      
      return res.json(globalResult.rows);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération artistes aléatoires:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Statistiques générales de l'utilisateur
router.get("/user-stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Total des écoutes
    const totalPlaysResult = await pool.query(`
      SELECT SUM(play_count) as total_plays
      FROM user_track_plays
      WHERE user_id = $1
    `, [userId]);

    // Nombre de tracks uniques écoutées
    const uniqueTracksResult = await pool.query(`
      SELECT COUNT(*) as unique_tracks
      FROM user_track_plays
      WHERE user_id = $1
    `, [userId]);

    // Nombre d'artistes uniques écoutés
    const uniqueArtistsResult = await pool.query(`
      SELECT COUNT(DISTINCT t.artist) as unique_artists
      FROM tracks t
      JOIN user_track_plays utp ON t.id = utp.track_id
      WHERE utp.user_id = $1 AND t.artist IS NOT NULL AND t.artist != ''
    `, [userId]);

    // Artiste le plus écouté
    const topArtistResult = await pool.query(`
      SELECT 
        t.artist,
        SUM(utp.play_count) as total_plays
      FROM tracks t
      JOIN user_track_plays utp ON t.id = utp.track_id
      WHERE utp.user_id = $1 AND t.artist IS NOT NULL AND t.artist != ''
      GROUP BY t.artist
      ORDER BY total_plays DESC
      LIMIT 1
    `, [userId]);

    const stats = {
      totalPlays: parseInt(totalPlaysResult.rows[0]?.total_plays) || 0,
      uniqueTracks: parseInt(uniqueTracksResult.rows[0]?.unique_tracks) || 0,
      uniqueArtists: parseInt(uniqueArtistsResult.rows[0]?.unique_artists) || 0,
      topArtist: topArtistResult.rows[0] || null
    };

    res.json(stats);
  } catch (error) {
    console.error("Erreur récupération statistiques utilisateur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
