import { dataLayer } from "./storage/data-layer";
import { initializeSystemPrompts } from "./storage/system-prompts-init";

// Initialize the data layer with default local user (in-memory)
async function ensureDataLayerReady() {
  await dataLayer.ensureLocalUser();
  return dataLayer;
}

export async function ensureStorageReady() {
  console.log('Ensuring storage is ready...');
  const dl = await ensureDataLayerReady();
  
  // Initialize system prompts on app startup with retry logic
  try {
    console.log('Initializing system prompts from storage-init.ts');
    await initializeSystemPrompts();
    console.log('System prompts initialized successfully');
  } catch (error) {
    console.error('Error in system prompts initialization:', error);
    // Try once more after a short delay
    try {
      console.log('Retrying system prompts initialization...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeSystemPrompts();
      console.log('System prompts initialized successfully on retry');
    } catch (retryError) {
      console.error('Failed to initialize system prompts after retry:', retryError);
    }
  }
  
  return dl;
}
