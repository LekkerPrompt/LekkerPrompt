// Electron-only auth stub: always returns a local user session.
export const auth = async () => ({ user: { id: "local-user", name: "Local User", email: null } });
export const handlers = { GET: async () => {}, POST: async () => {} };
export const signIn = async () => {};
export const signOut = async () => {};


