import fs from 'fs';
import path from 'path';
import { ChordsDatabase } from './database.js';

// Cargar configuración
const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

async function main() {
  const db = new ChordsDatabase(config.postgres);
  
  try {
    await db.init();
    const songs = await db.getAllSongs();

    console.log('==================================================');
    console.log('          CONTENIDO DE LA BASE DE DATOS           ');
    console.log('==================================================');
    console.log(`Base de datos:   PostgreSQL (localhost:5432)`);
    console.log(`Total canciones: ${songs.length}`);
    console.log('==================================================\n');

    if (songs.length === 0) {
      console.log('La base de datos está vacía.');
    } else {
      songs.forEach((song, index) => {
        console.log(`[${index + 1}] ${song.artist.toUpperCase()} - ${song.title}`);
        console.log(`    Versión:    ${song.version_number}`);
        console.log(`    Tipo:       ${song.type.toUpperCase()}`);
        console.log(`    Acordes:    ${song.chords ? song.chords : 'Ninguno listado'}`);
        console.log(`    Original:   ${song.source_url}`);
        console.log(`    Wayback:    ${song.archive_url}`);
        console.log('    Contenido (Primeras 5 líneas):');
        
        const lines = song.content.split('\n').slice(0, 5);
        lines.forEach(line => {
          console.log(`        | ${line}`);
        });
        if (song.content.split('\n').length > 5) {
          console.log('        | ... [continúa]');
        }
        console.log('--------------------------------------------------');
      });
    }
  } catch (error) {
    console.error('[ERROR] No se pudo leer la base de datos:', error.message);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
