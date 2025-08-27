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



dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// middlewares
app.use(cors({ origin: "http://localhost:3001" }));
app.use(express.json());

// routes
app.use("/search", searchRoutes);
app.use("/download", downloadRoutes);
app.use("/library", libraryRoutes);
app.use("/music", playerRoutes);
app.use("/login", authRoutes);
app.use("/playlists", playlistRoutes);
app.use("/likes", likeRoutes);
app.use("/home", homeRoutes);

// init db
initDB();

// scanner
startScanner({
  pool,
  downloadDir: process.env.DOWNLOAD_DIR || "./downloads",
  musicDir: process.env.MUSIC_DIR || "./../music",
});

// start server
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
