import { dataLayer } from "./storage/data-layer";

// Initialize the data layer with default local user (in-memory)
async function ensureDataLayerReady() {
  await dataLayer.ensureLocalUser();
  return dataLayer;
}

export async function ensureStorageReady() {
  return await ensureDataLayerReady();
}
