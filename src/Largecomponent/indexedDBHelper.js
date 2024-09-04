
import { openDB } from 'idb';

const DB_NAME = 'fbx_files_db';
const STORE_NAME = 'files_store';

// Initialize IndexedDB
export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

// Store file in IndexedDB
export async function storeFile(file) {
  const db = await initDB();
  const reader = new FileReader();

  return new Promise((resolve) => {
    reader.onload = async () => {
      await db.put(STORE_NAME, reader.result, file.name);
      resolve();
    };
    reader.readAsArrayBuffer(file);
  });
}

// Get file from IndexedDB
export async function getFile(fileName) {
  const db = await initDB();
  return db.get(STORE_NAME, fileName);
}
