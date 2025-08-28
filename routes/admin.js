import express from "express";
import { pool } from "../services/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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
    req.user = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// Middleware pour vérifier les droits d'administrateur
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user;
    const result = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

// GET /admin/users - Liste tous les utilisateurs (admin seulement)
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        username, 
        first_name, 
        last_name, 
        is_admin, 
        must_change_password,
        created_at,
        profile_image
      FROM users 
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /admin/users - Créer un nouvel utilisateur (admin seulement)
router.post("/users", authenticateToken, requireAdmin, async (req, res) => {
  const { username, first_name, last_name, password, is_admin = false } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  
  try {
    // Vérifier si le nom d'utilisateur existe déjà
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }
    
    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Créer le nouvel utilisateur
    const result = await pool.query(`
      INSERT INTO users (
        username, 
        first_name, 
        last_name, 
        password_hash, 
        is_admin, 
        must_change_password,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, first_name, last_name, is_admin, must_change_password, created_at
    `, [username, first_name, last_name, passwordHash, is_admin, true, new Date()]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /admin/users/:id - Modifier un utilisateur (admin seulement)
router.put("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, is_admin, must_change_password } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE users 
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        is_admin = COALESCE($3, is_admin),
        must_change_password = COALESCE($4, must_change_password)
      WHERE id = $5
      RETURNING id, username, first_name, last_name, is_admin, must_change_password, created_at
    `, [first_name, last_name, is_admin, must_change_password, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE /admin/users/:id - Supprimer un utilisateur (admin seulement)
router.delete("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user;
  
  // Empêcher l'auto-suppression
  if (parseInt(id) === currentUserId) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING username",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ message: `User ${result.rows[0].username} deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /admin/stats - Statistiques générales (admin seulement)
router.get("/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersCount, tracksCount, albumsCount, playlistsCount] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM tracks"),
      pool.query("SELECT COUNT(*) FROM albums"),
      pool.query("SELECT COUNT(*) FROM playlists")
    ]);
    
    res.json({
      users: parseInt(usersCount.rows[0].count),
      tracks: parseInt(tracksCount.rows[0].count),
      albums: parseInt(albumsCount.rows[0].count),
      playlists: parseInt(playlistsCount.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
