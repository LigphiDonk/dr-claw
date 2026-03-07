import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Static template files to copy into new Research Lab projects.
 * Each entry maps a source template to its destination path relative to the project root.
 */
const TEMPLATES = [
  { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
  { src: 'cursor-project.md', dest: path.join('.cursor', 'rules', 'project.md') },
  { src: 'AGENTS.md', dest: 'AGENTS.md' },
  { src: 'GEMINI.md', dest: 'GEMINI.md' },
];

/**
 * Write agent instruction template files into a project directory.
 * Copies static .md templates from this directory.
 * Skips any file that already exists so user customizations are preserved.
 * @param {string} projectPath - Absolute path to the project directory.
 */
export async function writeProjectTemplates(projectPath) {
  for (const { src, dest } of TEMPLATES) {
    const destPath = path.join(projectPath, dest);
    try {
      const exists = await fs.access(destPath).then(() => true).catch(() => false);
      if (exists) continue;

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(path.join(__dirname, src), destPath);
    } catch (err) {
      console.error(`[templates] Failed to write ${dest}:`, err.message);
    }
  }
}
