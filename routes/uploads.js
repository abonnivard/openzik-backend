import express from "express";
import { pool } from "../services/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware pour vérifier le token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Upload image de profil (base64)
router.post('/profile-image', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Vérifier que c'est du base64 valide
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Must be base64.' });
    }
    
    // Mettre à jour l'utilisateur avec la nouvelle image
    await pool.query(
      'UPDATE users SET profile_image = $1 WHERE id = $2',
      [imageData, req.user.id]
    );

    res.json({ 
      message: 'Profile image uploaded successfully',
      imageData: imageData 
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// Upload image de playlist (base64)
router.post('/playlist-image/:playlistId', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    const { playlistId } = req.params;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Vérifier que c'est du base64 valide
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Must be base64.' });
    }
    
    // Vérifier que l'utilisateur possède cette playlist
    const playlistCheck = await pool.query(
      'SELECT user_id FROM playlists WHERE id = $1',
      [playlistId]
    );

    if (playlistCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlistCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own playlists' });
    }

    // Mettre à jour la playlist avec la nouvelle image
    await pool.query(
      'UPDATE playlists SET custom_image = $1 WHERE id = $2',
      [imageData, playlistId]
    );

    res.json({ 
      message: 'Playlist image uploaded successfully',
      imageData: imageData 
    });
  } catch (error) {
    console.error('Error uploading playlist image:', error);
    res.status(500).json({ error: 'Failed to upload playlist image' });
  }
});

// Supprimer image de profil
router.delete('/profile-image', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET profile_image = NULL WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Profile image removed successfully' });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ error: 'Failed to remove profile image' });
  }
});

// Supprimer image de playlist
router.delete('/playlist-image/:playlistId', authenticateToken, async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    // Vérifier que l'utilisateur possède cette playlist
    const playlistCheck = await pool.query(
      'SELECT user_id FROM playlists WHERE id = $1',
      [playlistId]
    );

    if (playlistCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlistCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own playlists' });
    }

    await pool.query(
      'UPDATE playlists SET custom_image = NULL WHERE id = $1',
      [playlistId]
    );

    res.json({ message: 'Playlist image removed successfully' });
  } catch (error) {
    console.error('Error removing playlist image:', error);
    res.status(500).json({ error: 'Failed to remove playlist image' });
  }
});

export default router;
