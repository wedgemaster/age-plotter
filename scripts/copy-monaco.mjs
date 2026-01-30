/**
 * Copy Monaco Editor files from node_modules to static directory.
 * Monaco has workers that can't be easily bundled, so we copy it as-is.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const src = resolve(projectRoot, 'node_modules/monaco-editor/min');
const dest = resolve(projectRoot, 'src/age_plotter/static/vendor/monaco');

// Clean destination
if (existsSync(dest)) {
    rmSync(dest, { recursive: true });
}

// Create destination directory
mkdirSync(dest, { recursive: true });

// Copy Monaco files
cpSync(src, dest, { recursive: true });

console.log('Monaco Editor copied successfully');
