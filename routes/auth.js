import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../services/db.js";

const router = express.Router();

// login
router.post("/", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ message: "Utilisateur inconnu" });

    if (!user.password_hash) {
      return res.status(500).json({ message: "Utilisateur sans mot de passe défini" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Mot de passe incorrect" });

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" }
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
      },
      token,
      must_change_password: user.must_change_password,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


// change password
router.post("/change-password", async (req, res) => {
  const { username, newPassword, oldPassword } = req.body;
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Mot de passe actuel incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = false WHERE username = $2",
      [hash, username]
    );
    res.json({ message: "Mot de passe changé avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


// get user info
router.get("/user-info", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const userRes = await pool.query(
      "SELECT username, first_name, last_name, must_change_password, profile_image FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = userRes.rows[0];
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Unauthorized" });
  }
});

// update user info
router.post("/user-info", async (req, res) => {
  const { username, first_name, last_name } = req.body;
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    await pool.query(
      "UPDATE users SET username=$1, first_name=$2, last_name=$3 WHERE id=$4",
      [username, first_name, last_name, decoded.id]
    );
    res.json({ message: "Infos utilisateur mises à jour" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


export default router;
