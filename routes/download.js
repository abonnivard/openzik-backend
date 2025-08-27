import express from "express";
import jwt from "jsonwebtoken";
import { addTorrent } from "../services/qbittorrent.js";
import { pool } from "../services/init-db.js";
import { searchMusic } from "../services/prowlarr.js";

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

// POST /download
// Le body doit contenir { album: {...} } avec toutes les métadonnées Spotify
router.post("/", authenticateToken, async (req, res) => {
  const { album } = req.body;

  if (!album) {
    return res.status(400).json({ error: "Album is required in request body" });
  }

  try {
    const mainArtist = album.artists?.[0]?.name || "Unknown Artist";
    const images = album.images || [];

    const albumData = {
      id: album.id,
      name: album.name,
      artist: mainArtist,
      album_type: album.album_type,
      total_tracks: album.total_tracks,
      release_date: album.release_date,
      image_large: images[0]?.url || null,
      image_medium: images[1]?.url || null,
      image_small: images[2]?.url || null,
      spotify_url: album.external_urls?.spotify || null,
      uri: album.uri || null,
    };

    // Upsert album
    await pool.query(
      `
      INSERT INTO albums
        (id, name, artist, album_type, total_tracks, release_date, image_small, image_medium, image_large, spotify_url, uri)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        artist = EXCLUDED.artist,
        album_type = EXCLUDED.album_type,
        total_tracks = EXCLUDED.total_tracks,
        release_date = EXCLUDED.release_date,
        image_small = EXCLUDED.image_small,
        image_medium = EXCLUDED.image_medium,
        image_large = EXCLUDED.image_large,
        spotify_url = EXCLUDED.spotify_url,
        uri = EXCLUDED.uri
      `,
      [
        albumData.id,
        albumData.name,
        albumData.artist,
        albumData.album_type,
        albumData.total_tracks,
        albumData.release_date,
        albumData.image_small,
        albumData.image_medium,
        albumData.image_large,
        albumData.spotify_url,
        albumData.uri,
      ]
    );

    console.log("Album stored in DB:", albumData.name);

    let downloadUrl = null;
    if (!downloadUrl) {
      const release = await searchMusic(albumData.artist, albumData.name);
      console.log("Prowlarr search result:", release);
      if (release?.downloadUrl) {
        downloadUrl = release.downloadUrl;
        console.log("Torrent found via Prowlarr:", downloadUrl);
      } else {
        console.warn("No torrent found for album via Prowlarr");
      }
    }

    if (downloadUrl) {
      await addTorrent(downloadUrl);
      console.log("Torrent added:", downloadUrl);
    }

    res.json({
      message: "Album processed successfully",
      album: albumData,
      downloadUrl: downloadUrl || null,
    });
  } catch (err) {
    console.error("Error in /download:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
