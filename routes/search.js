import express from "express";
import jwt from "jsonwebtoken";
import { ensureSpotifyToken, searchSpotify } from "../services/spotify.js";
import { getLibrary } from "../services/db.js";

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

// Fonction pour normaliser les chaînes pour la comparaison
const normalize = (str) => str?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim() || '';

// Fonction pour vérifier si deux chaînes sont suffisamment similaires
const isSimilar = (str1, str2) => {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  if (s1 === s2) return true;
  
  // Vérification de sous-chaîne simple pour la performance
  return s1.includes(s2) || s2.includes(s1) || 
         (s1.length > 3 && s2.length > 3 && 
          s1.substring(0, Math.min(s1.length, s2.length, 5)) === s2.substring(0, Math.min(s1.length, s2.length, 5)));
};

// Fonction externe pour ajouter le champ "local" aux résultats Spotify
export async function addLocalMatchesToSpotifyResults(spotifyResults) {
  try {
    const allTracks = await getLibrary();
    
    // Limiter le nombre d'éléments à traiter pour éviter les problèmes de payload
    const limitedResults = {
      tracks: (spotifyResults.tracks || []).slice(0, 20),
      albums: (spotifyResults.albums || []).slice(0, 15),
      artists: (spotifyResults.artists || []).slice(0, 10),
    };

    // Matcher les albums
    const matchedAlbums = limitedResults.albums.map(spotifyAlbum => {
      const localTracks = allTracks.filter(localTrack => {
        const albumMatch = isSimilar(spotifyAlbum.name, localTrack.album);
        const artistMatch = spotifyAlbum.artists?.some(spotifyArtist => 
          isSimilar(spotifyArtist.name, localTrack.artist)
        );
        return albumMatch && artistMatch;
      });
      
      return {
        ...spotifyAlbum,
        local: localTracks.length > 0,
        localTracks: localTracks.length > 0 ? localTracks : undefined
      };
    });

    // Matcher les tracks
    const matchedTracks = limitedResults.tracks.map(spotifyTrack => {
      const localTrack = allTracks.find(localTrack => {
        const titleMatch = isSimilar(spotifyTrack.name, localTrack.title);
        const artistMatch = spotifyTrack.artists?.some(spotifyArtist => 
          isSimilar(spotifyArtist.name, localTrack.artist)
        );
        return titleMatch && artistMatch;
      });
      
      return {
        ...spotifyTrack,
        local: !!localTrack,
        localTrack: localTrack || undefined
      };
    });

    // Matcher les artistes (basé sur les tracks locaux de cet artiste)
    const matchedArtists = limitedResults.artists.map(spotifyArtist => {
      const localTracks = allTracks.filter(localTrack => 
        isSimilar(spotifyArtist.name, localTrack.artist)
      );
      
      return {
        ...spotifyArtist,
        local: localTracks.length > 0,
        localTracks: localTracks.length > 0 ? localTracks : undefined
      };
    });

    return {
      albums: matchedAlbums,
      tracks: matchedTracks,
      artists: matchedArtists
    };
  } catch (error) {
    console.error("Error adding local matches:", error);
    // En cas d'erreur, retourner les résultats originaux avec local: false
    return {
      albums: (spotifyResults.albums || []).map(album => ({ ...album, local: false })),
      tracks: (spotifyResults.tracks || []).map(track => ({ ...track, local: false })),
      artists: (spotifyResults.artists || []).map(artist => ({ ...artist, local: false }))
    };
  }
}

// /search?q=...
router.get("/", authenticateToken, ensureSpotifyToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    // Récupérer les résultats Spotify
    const spotifyResults = await searchSpotify(q);
    
    // Ajouter les informations de matching local
    const resultsWithLocal = await addLocalMatchesToSpotifyResults(spotifyResults);
    res.json(resultsWithLocal);
  } catch (err) {
    console.error("Error in /search:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
