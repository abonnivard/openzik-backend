import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Récupérer la liste des tracks
export async function getLibrary() {
  const result = await pool.query("SELECT * FROM tracks ORDER BY id DESC");
  return result.rows;
}

// Ajouter un track
export async function addTrack({ title, album, artist }) {
  const result = await pool.query(
    "INSERT INTO tracks (title, album, artist) VALUES ($1, $2, $3) RETURNING *",
    [title, album, artist]
  );
  return result.rows[0];
}
