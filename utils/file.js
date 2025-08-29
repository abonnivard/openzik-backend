// utils/file.js
import fs from "fs";
import path from "path";

/**
 * Déplace un fichier audio dans la bibliothèque
 * @param {Object} params
 * @param {string} params.filePath - Chemin du fichier source
 * @param {string} params.destPath - Chemin final (incluant le nom de fichier)
 */
export async function moveToLibrary({ filePath, destPath }) {
  try {
    const destDir = path.dirname(destPath);
    
    // Créer le répertoire avec des permissions spécifiques
    fs.mkdirSync(destDir, { recursive: true, mode: 0o755 });

    // Déplace
    fs.renameSync(filePath, destPath);

    console.log(`✅ Déplacé vers: ${destPath}`);
    return destPath;
  } catch (error) {
    console.error(`❌ Erreur lors du déplacement vers ${destPath}:`, error);
    
    if (error.code === 'EACCES') {
      console.error(`❌ Permissions insuffisantes pour écrire dans: ${path.dirname(destPath)}`);
    }
    
    throw error;
  }
}
