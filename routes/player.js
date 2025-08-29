import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { pool } from "../services/db.js";

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

// /search?q=...
router.get("/:artist/:album/:track", (req, res) => {
  // decode les parties pour gérer espaces/accents
  const artist = decodeURIComponent(req.params.artist);
  const album = decodeURIComponent(req.params.album);
  const track = decodeURIComponent(req.params.track);


  const musicDir = path.resolve( "./music");
  const filePath = path.join(musicDir, artist, album, track);

  fs.stat(filePath, (err, stats) => {
    if (err) return res.status(404).send("File not found");

    const range = req.headers.range;
    if (!range) {
      // envoi complet si pas de range
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": stats.size,
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // streaming partiel (pause/reprise)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "audio/mpeg",
      });

      stream.pipe(res);
    }
  });
});


// player.js (backend)
router.post("/track-played", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ error: "trackId is required" });

  try {
    // Ajouter à recently_played
    await pool.query(
      "INSERT INTO recently_played (user_id, track_id) VALUES ($1, $2)",
      [userId, trackId]
    );

    // Incrémenter ou créer le compteur dans user_track_plays
    await pool.query(`
      INSERT INTO user_track_plays (user_id, track_id, play_count, last_played)
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT (user_id, track_id)
      DO UPDATE SET 
        play_count = user_track_plays.play_count + 1,
        last_played = NOW()
    `, [userId, trackId]);

    res.json({ message: "Track added to recently played and play count updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


export default router;
