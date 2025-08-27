// services/init-db.js
import pg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PGUSER || "adrien",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "adrien",
  password: process.env.PGPASSWORD || "adrien",
  port: process.env.PGPORT || 5432,
});

export async function initDB() {
  try {
    // --- Tables existantes ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        image TEXT,
        file_path TEXT UNIQUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artist TEXT NOT NULL,
        album_type TEXT,
        total_tracks INTEGER,
        release_date TEXT,
        image_small TEXT,
        image_medium TEXT,
        image_large TEXT,
        spotify_url TEXT,
        uri TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingest_queue (
        id SERIAL PRIMARY KEY,
        artist TEXT,
        album TEXT,
        title TEXT,
        hint TEXT,
        source_dir TEXT,
        status TEXT DEFAULT 'queued',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        must_change_password BOOLEAN DEFAULT TRUE
      )
    `);

    // Crée l'admin initial si non existant
    const adminUsername = "admin";
    const adminPassword = "admin";
    const { rows } = await pool.query("SELECT * FROM users WHERE is_admin=$1", [true]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT INTO users (username, first_name, last_name, password_hash, is_admin, must_change_password)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [adminUsername, "Admin", "User", hash]
      );
      console.log("✅ Admin initial créé (username: admin, password: admin)");
    }

    // --- Nouvelles tables pour playlists et liked tracks ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id SERIAL PRIMARY KEY,
        playlist_id INT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INT DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS liked_tracks (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recently_played (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("✅ PostgreSQL initialisé (tracks + albums + ingest_queue + users + playlists + liked_tracks, recently_played)");
  } catch (err) {
    console.error("Erreur initDB:", err.message);
    throw err;
  }
}

export { pool };
