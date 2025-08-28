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

  // Liste toutes les playlists d'un utilisateur
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user;
  try {
    const result = await pool.query(
      "SELECT * FROM playlists WHERE user_id = $1 ORDER BY is_pinned DESC, created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Liste tous les tracks d'une playlist
router.get("/:playlistId/tracks", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { playlistId } = req.params;

  // Cas spécial : si playlistId est "liked" ou "liked-songs", renvoyer les liked tracks
  if (playlistId === "liked" || playlistId === "liked-songs") {
    try {
      const result = await pool.query(
        `SELECT t.* FROM liked_tracks lt
         JOIN tracks t ON lt.track_id = t.id 
         WHERE lt.user_id = $1
         ORDER BY lt.created_at DESC`,
        [userId]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
  }

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur
    const playlistCheck = await pool.query(
      "SELECT * FROM playlists WHERE id = $1 AND user_id = $2",
      [playlistId, userId]
    );
    if (playlistCheck.rows.length === 0) return res.status(404).json({ error: "Playlist not found" });

    // Récupère tous les tracks
    const tracksResult = await pool.query(
      `SELECT t.* 
       FROM playlist_tracks pt
       JOIN tracks t ON pt.track_id = t.id
       WHERE pt.playlist_id = $1
       ORDER BY pt.id ASC`,
      [playlistId]
    );

    res.json(tracksResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});



// Créer une nouvelle playlist
router.post("/", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Playlist name is required" });

  try {
    const result = await pool.query(
      "INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING *",
      [userId, name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Ajouter un track à une playlist
router.post("/:playlistId/tracks", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { playlistId } = req.params;
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ error: "trackId is required" });

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur
    const playlistCheck = await pool.query(
      "SELECT * FROM playlists WHERE id = $1 AND user_id = $2",
      [playlistId, userId]
    );
    if (playlistCheck.rows.length === 0) return res.status(404).json({ error: "Playlist not found" });

    // Ajoute le track
    await pool.query(
      "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [playlistId, trackId]
    );

    res.json({ message: "Track added to playlist" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Supprimer un track d’une playlist
router.delete("/:playlistId/tracks/:trackId", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { playlistId, trackId } = req.params;

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur
    const playlistCheck = await pool.query(
      "SELECT * FROM playlists WHERE id = $1 AND user_id = $2",
      [playlistId, userId]
    );
    if (playlistCheck.rows.length === 0) return res.status(404).json({ error: "Playlist not found" });

    await pool.query(
      "DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2",
      [playlistId, trackId]
    );

    res.json({ message: "Track removed from playlist" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Supprimer une playlist entière
router.delete("/:playlistId", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { playlistId } = req.params;

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur
    const playlistCheck = await pool.query(
      "SELECT * FROM playlists WHERE id = $1 AND user_id = $2",
      [playlistId, userId]
    );
    if (playlistCheck.rows.length === 0) return res.status(404).json({ error: "Playlist not found" });

    await pool.query("DELETE FROM playlist_tracks WHERE playlist_id = $1", [playlistId]);
    await pool.query("DELETE FROM playlists WHERE id = $1", [playlistId]);

    res.json({ message: "Playlist deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Pin/Unpin une playlist
router.put("/:playlistId/pin", authenticateToken, async (req, res) => {
  const userId = req.user;
  const { playlistId } = req.params;
  const { isPinned } = req.body;

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur
    const playlistCheck = await pool.query(
      "SELECT * FROM playlists WHERE id = $1 AND user_id = $2",
      [playlistId, userId]
    );
    if (playlistCheck.rows.length === 0) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Met à jour le statut pin de la playlist
    await pool.query(
      "UPDATE playlists SET is_pinned = $1 WHERE id = $2",
      [isPinned, playlistId]
    );

    res.json({ message: `Playlist ${isPinned ? 'pinned' : 'unpinned'} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;


