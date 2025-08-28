import axios from "axios";

let spotifyToken = null;
let tokenExpiresAt = 0;

// Middleware pour vérifier/renouveler le token
export async function ensureSpotifyToken(req, res, next) {
  if (Date.now() < tokenExpiresAt && spotifyToken) {
    return next();
  }

  try {
    const resp = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    spotifyToken = resp.data.access_token;
    tokenExpiresAt = Date.now() + resp.data.expires_in * 1000;
    next();
  } catch (err) {
    console.error("Failed to refresh Spotify token:", err.message);
    res.status(500).json({ error: "Failed to refresh Spotify token" });
  }
}

// Requête vers l’API Spotify
export async function searchSpotify(query) {
  const resp = await axios.get("https://api.spotify.com/v1/search", {
    headers: { Authorization: `Bearer ${spotifyToken}` },
    params: { q: query, type: "album,track,artist", limit: 50 },
  });

  const formatArtist = (a) => ({
    id: a.id,
    name: a.name,
    popularity: a.popularity,
    genres: a.genres,
    followers: a.followers,
    images: a.images,
    external_urls: a.external_urls,
    type: a.type,
    uri: a.uri,
  });

  const formatAlbum = (a) => ({
    id: a.id,
    name: a.name,
    album_type: a.album_type,
    total_tracks: a.total_tracks,
    release_date: a.release_date,
    images: a.images,
    external_urls: a.external_urls,
    artists: a.artists.map(formatArtist),
    type: a.type,
    uri: a.uri,
  });

  const formatTrack = (t) => ({
    id: t.id,
    name: t.name,
    duration_ms: t.duration_ms,
    explicit: t.explicit,
    popularity: t.popularity,
    preview_url: t.preview_url,
    album: t.album ? formatAlbum(t.album) : null,
    artists: t.artists.map(formatArtist),
    external_urls: t.external_urls,
    type: t.type,
    uri: t.uri,
  });


  return {
    artists: resp.data.artists?.items.map(formatArtist) || [],
    albums: resp.data.albums?.items.map(formatAlbum) || [],
    tracks: resp.data.tracks?.items.map(formatTrack) || [],
  };
}
