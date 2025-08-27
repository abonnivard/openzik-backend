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
  const destDir = path.dirname(destPath);
  fs.mkdirSync(destDir, { recursive: true });

  // Déplace
  fs.renameSync(filePath, destPath);

  console.log(`✅ Déplacé vers: ${destPath}`);
  return destPath;
}
