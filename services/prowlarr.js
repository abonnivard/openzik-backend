import axios from "axios";

export async function searchMusic(artist, album) {
  console.log("Searching for music:", { artist, album });
  const resp = await axios.get(`${process.env.PROWLARR_URL}/api/v1/search`, {
    params: { query: `{Artist:${artist}}{Album:${album}}`, type: "music" },
    headers: { "X-Api-Key": process.env.PROWLARR_API_KEY },
  });
  console.log("Prowlarr response data:", resp.data);

  if (!resp.data || resp.data.length === 0) {
    return null;
  }
  const release = resp.data[0];
  let torrentUrl = release.downloadUrl;

  // rewrite torrent URL pour Docker network
  try {
    const parsed = new URL(torrentUrl);
    parsed.hostname = "127.0.0.1"; // nom du service docker-compose
    parsed.port = "9696";
    release.downloadUrl = parsed.toString();
  } catch (err) {
    console.error("URL parse error:", err.message);
    throw new Error("Invalid torrent URL");
  }

  return release;
}
