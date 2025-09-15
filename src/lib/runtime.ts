export function isElectronRuntime(): boolean {
  if (typeof process !== 'undefined') {
    if ((process as any)?.versions?.electron) return true;
    if (process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1') return true;
  }
  if (typeof navigator !== 'undefined') {
    return /Electron/i.test(navigator.userAgent);
  }
  return false;
}
