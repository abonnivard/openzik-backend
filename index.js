import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./services/init-db.js";
import searchRoutes from "./routes/search.js";
import downloadRoutes from "./routes/download.js";
import libraryRoutes from "./routes/library.js";
import playerRoutes from "./routes/player.js";
import authRoutes from "./routes/auth.js";
import { startScanner } from "./services/scanner.js";
import { pool } from "./services/db.js";
import playlistRoutes from "./routes/playlists.js";
import likeRoutes from "./routes/likes.js";
import homeRoutes from "./routes/home.js";
import statsRoutes from "./routes/stats.js";
import adminRoutes from "./routes/admin.js";
import uploadRoutes from "./routes/uploads.js";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// middlewares
app.use(cors({ 
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// routes
app.use("/search", searchRoutes);
app.use("/download", downloadRoutes);
app.use("/library", libraryRoutes);
app.use("/music", playerRoutes);
app.use("/login", authRoutes);
app.use("/playlists", playlistRoutes);
app.use("/likes", likeRoutes);
app.use("/home", homeRoutes);
app.use("/stats", statsRoutes);
app.use("/admin", adminRoutes);
app.use("/uploads", uploadRoutes);

// Route pour récupérer le profil de l'utilisateur connecté
app.get("/me", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Récupérer les informations utilisateur depuis la base de données
    pool.query(
      "SELECT id, username, first_name, last_name, is_admin, must_change_password, profile_image, created_at FROM users WHERE id = $1",
      [decoded.id],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Database error" });
        }
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }
        
        res.json(result.rows[0]);
      }
    );
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

// init db
initDB()
  .then(() => {
    console.log('Database initialization completed. Starting scanner...');
    
    // scanner
    startScanner({
      pool,
      downloadDir: process.env.DOWNLOAD_DIR || "./downloads",
      musicDir: process.env.MUSIC_DIR || "./../music",
    });

    // start server
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`🎵 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
