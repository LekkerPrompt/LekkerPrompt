import { dataLayer, db as newDb } from "./storage/data-layer";

// Initialize the data layer with default user
async function ensureDataLayerReady() {
  await dataLayer.ensureLocalUser();
  return dataLayer;
}

// Export the new database interface
export const db = newDb;

export async function ensureDbReady() {
  return await ensureDataLayerReady();
}

export function getDb() {
  return db;
}

