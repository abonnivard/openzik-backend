// scanner.js
import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { moveToLibrary } from "../utils/file.js";
import stringSimilarity from "string-similarity";

const AUDIO_EXTS = new Set([
  ".flac", ".mp3", ".m4a", ".aac", ".wav", ".alac", ".ogg", ".opus", ".aiff"
]);

// --- utils ---
async function waitForStableFile(filePath, { checks = 5, intervalMs = 2000 } = {}) {
  let lastSize = -1;
  for (let i = 0; i < checks; i++) {
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat) { await new Promise(r => setTimeout(r, intervalMs)); continue; }
    if (stat.size === lastSize && stat.size > 0) return true;
    lastSize = stat.size;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

function normalizeAlbumName(name) {
  if (!name) return "";

  return name
    .toLowerCase()
    // delete content between () or []
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    // delete mentions of common formats/editions
    .replace(/\b(cd\s*\d+|disc\s*\d+|2cd|deluxe|edition|remaster(ed)?|bonus|reissue)\b/gi, "")
    .replace(/\b(flac|mp3|aac|ogg|wav|vinyl|web|digital|16-44|24-96)\b/gi, "")
    // replace dashes/underscores with space
    .replace(/[-–_]/g, " ")
    // Nettoie espaces multiples
    .replace(/\s+/g, " ")
    // Trim final
    .trim();
}


// Devine métadonnées fallback depuis le chemin
function guessMetaFromPath(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const dir = path.basename(path.dirname(filePath));
  const parent = path.basename(path.dirname(path.dirname(filePath)));
  const title = base.replace(/^\d+\s*[-_.]\s*/i, "").trim();

  if (dir.includes(" - ")) {
    const [artistRaw, albumRaw] = dir.split(" - ");
    return { artist: artistRaw.trim(), album: albumRaw.trim(), title: title || base };
  }
  if (parent && dir) return { artist: parent.trim(), album: dir.trim(), title: title || base };
  if (base.includes(" - ")) {
    const [artistRaw, titleRaw] = base.split(" - ");
    return { artist: artistRaw.trim(), album: "Unknown Album", title: titleRaw.trim() };
  }
  return null;
}

// Lookup dans ingest_queue
async function lookupMetaInDB(pool, filePath) {
  const { rows: candidates } = await pool.query(
    `SELECT * FROM ingest_queue
     WHERE status = 'queued' AND
       (
         (source_dir IS NOT NULL AND $1 ILIKE '%' || source_dir || '%') OR
         (hint IS NOT NULL AND $1 ILIKE '%' || hint || '%')
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [filePath]
  );
  if (candidates.length) return candidates[0];

  const { rows } = await pool.query(
    `SELECT * FROM ingest_queue WHERE status = 'queued' ORDER BY created_at DESC LIMIT 1`
  );
  return rows[0] || null;
}

// Récupération du meilleur match par similarité
async function getAlbumNameFromDB(pool, artist, rawAlbum) {
  const normalizedInput = normalizeAlbumName(rawAlbum);

  try {
    const { rows } = await pool.query(
      `SELECT name, image_large FROM albums WHERE artist=$1`,
      [artist]
    );


    if (!rows.length) {
      return { name: rawAlbum, image: null };
    }

    const candidates = rows.map((row) => ({
      ...row,
      normalized: normalizeAlbumName(row.name),
    }));


    // Cherche la meilleure similarité
    const matches = stringSimilarity.findBestMatch(
      normalizedInput,
      candidates.map((c) => c.normalized)
    );


    const bestMatch = candidates[matches.bestMatchIndex];
    const score = matches.bestMatch.rating;


    if (score > 0.5) {
      // match probable
      return { name: bestMatch.name, image: bestMatch.image_large || null };
    }
  } catch (err) {
    console.warn("Albums lookup failed:", err.message);
  }

  return { name: rawAlbum, image: null };
}

// Upsert track
async function upsertTrack(pool, { title, artist, album, file_path, image }) {
  await pool.query(
    `INSERT INTO tracks (title, artist, album, file_path, image)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (file_path) DO NOTHING`,
    [title, artist, album, file_path, image]
  );
}

// Marque ingestion done
async function markIngestDone(pool, ingestId) {
  if (!ingestId) return;
  await pool.query(`UPDATE ingest_queue SET status='done' WHERE id=$1`, [ingestId]);
}

// --- traitement audio file ---
async function processAudioFile({ filePath, pool }) {
  const stable = await waitForStableFile(filePath);
  if (!stable) return console.warn("Fichier pas stable, skip:", filePath);

  const fromDB = await lookupMetaInDB(pool, filePath);
  const fallback = guessMetaFromPath(filePath);

  const artist = fromDB?.artist || fallback?.artist || "Unknown Artist";
  const albumRaw = fromDB?.album || fallback?.album || "Unknown Album";
  const title = fromDB?.title || fallback?.title || path.basename(filePath, path.extname(filePath));

  // Récupère vrai nom album et image
  const albumInfo = await getAlbumNameFromDB(pool, artist, albumRaw);
  const albumName = albumInfo.name;
  const image = albumInfo.image;

  // Déplacement fichier
  const finalPathAbsolute = path.resolve("./music", artist, albumName, path.basename(filePath));
  await moveToLibrary({ filePath, destPath: finalPathAbsolute });

  // Stocker le chemin relatif à la racine du projet
  const filePathRelative = path.relative("./", finalPathAbsolute);
  await upsertTrack(pool, { title, artist, album: albumName, file_path: filePathRelative, image });
  await markIngestDone(pool, fromDB?.id);

}

// --- scanner ---
export function startScanner({ pool, downloadDir }) {
  const DOWNLOAD_DIR = downloadDir || process.env.DOWNLOAD_DIR || "./downloads";
  const MUSIC_DIR = path.resolve("./music");

  const walk = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (AUDIO_EXTS.has(path.extname(e.name).toLowerCase())) {
        await processAudioFile({ filePath: full, pool }).catch(console.error);
      }
    }
  };

  if (fs.existsSync(DOWNLOAD_DIR)) walk(DOWNLOAD_DIR).catch(console.error);

  const watcher = chokidar.watch(DOWNLOAD_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 8,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 }
  });

  watcher.on("add", (filePath) => {
    if (!AUDIO_EXTS.has(path.extname(filePath).toLowerCase())) return;
    processAudioFile({ filePath, pool }).catch((e) => console.error("processAudioFile error:", e.message));
  });

  watcher.on("error", (err) => console.error("Watcher error:", err.message));

  console.log(`👀 Scanner démarré. Watch: ${path.resolve(DOWNLOAD_DIR)} → ${MUSIC_DIR}`);
}
