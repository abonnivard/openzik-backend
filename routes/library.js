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

// /library/search?q=...
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    const allTracks = await getLibrary();
    const query = q.toLowerCase();
    
    // Filter tracks that match the search query
    const matchingTracks = allTracks.filter(track => 
      track.title?.toLowerCase().includes(query) ||
      track.artist?.toLowerCase().includes(query) ||
      track.album?.toLowerCase().includes(query)
    );

    // Group by artist and album for better organization
    const artists = {};
    const albums = {};
    const tracks = [];

    matchingTracks.forEach(track => {
      // Add to tracks
      tracks.push(track);

      // Group by artist
      const artistName = track.artist || "Unknown Artist";
      if (!artists[artistName]) {
        artists[artistName] = {
          id: artistName.toLowerCase().replace(/\s+/g, '-'),
          name: artistName,
          tracks: [],
          isLocal: true
        };
      }
      artists[artistName].tracks.push(track);

      // Group by album
      const albumName = track.album || "Unknown Album";
      const albumKey = `${artistName} - ${albumName}`;
      if (!albums[albumKey]) {
        albums[albumKey] = {
          id: albumKey.toLowerCase().replace(/\s+/g, '-'),
          name: albumName,
          artist: artistName,
          tracks: [],
          isLocal: true,
          images: track.image ? [{ url: track.image }] : []
        };
      }
      albums[albumKey].tracks.push(track);
    });

    res.json({
      artists: Object.values(artists),
      albums: Object.values(albums),
      tracks: tracks
    });
  } catch (err) {
    console.error("Error in /library/search:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

// /library/match - Match Spotify results with local content
router.post("/match", authenticateToken, async (req, res) => {
  try {
    const { spotifyResults } = req.body;
    if (!spotifyResults) return res.status(400).json({ error: "Spotify results required" });

    const allTracks = await getLibrary();
    
    // Limit the number of items to process to avoid payload issues
    const limitedResults = {
      tracks: (spotifyResults.tracks || []).slice(0, 20),
      albums: (spotifyResults.albums || []).slice(0, 15),
      artists: (spotifyResults.artists || []).slice(0, 10),
    };
    
    // Function to normalize strings for comparison
    const normalize = (str) => str?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim() || '';
    
    // Function to check if two strings are similar enough (simplified for performance)
    const isSimilar = (str1, str2) => {
      const s1 = normalize(str1);
      const s2 = normalize(str2);
      if (s1 === s2) return true;
      
      // Simple substring check for performance
      return s1.includes(s2) || s2.includes(s1) || 
             (s1.length > 3 && s2.length > 3 && 
              s1.substring(0, Math.min(s1.length, s2.length, 5)) === s2.substring(0, Math.min(s1.length, s2.length, 5)));
    };
    
   

    // Match albums
    const matchedAlbums = limitedResults.albums.map(spotifyAlbum => {
      const localTracks = allTracks.filter(localTrack => {
        const albumMatch = isSimilar(spotifyAlbum.name, localTrack.album);
        const artistMatch = spotifyAlbum.artists?.some(spotifyArtist => 
          isSimilar(spotifyArtist.name, localTrack.artist)
        );
        return albumMatch && artistMatch;
      });
      
      if (localTracks.length > 0) {
        return {
          ...spotifyAlbum,
          isLocal: true,
          localTracks: localTracks,
          canPlay: true
        };
      }
      return spotifyAlbum;
    });


  } catch (err) {
    console.error("Error in /library/match:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
