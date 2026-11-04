import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type PreviewConfig = { pr?: string; sha?: string; mapsConfigured?: boolean };
export type PreviewLogEntry = {
  time: string;
  event: string;
  detail: string;
  level: 'info' | 'error';
  sha: string;
};
const preview = Constants.expoConfig?.extra?.preview as PreviewConfig | undefined;
export const isPreviewBuild = !!preview?.pr && /^[1-9]\d*$/.test(preview.pr);
export const isPreviewMapBlocked = Platform.OS === 'android' && isPreviewBuild && preview?.mapsConfigured !== true;
const STORAGE_KEY = 'hwb-preview-diagnostics-v1';
const MAX_ENTRIES = 100;
let queue: Promise<unknown> = Promise.resolve();

export function redactPreviewDetail(value: string) {
  return value
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[redacted-key]')
    .replace(/(["']?(?:password|passwort|secret|authorization|(?:access_|refresh_|id_)?token|api_?key)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s)"'<>]+/g, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname.replace(/\([^)]*\)/g, '([redacted])')}`;
      } catch { return '[redacted-url]'; }
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .slice(0, 2000);
}

async function loadEntries(): Promise<PreviewLogEntry[]> {
  try {
    const data: unknown = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is PreviewLogEntry =>
      entry && typeof entry.time === 'string' && typeof entry.event === 'string' &&
      typeof entry.detail === 'string' && typeof entry.sha === 'string' &&
      (entry.level === 'info' || entry.level === 'error')
    ).slice(-MAX_ENTRIES);
  } catch { return []; }
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  // A storage failure must never change application/error-handler behaviour.
  queue = result.catch(() => undefined);
  return result;
}

export function recordPreviewEvent(event: string, detail = '', level: PreviewLogEntry['level'] = 'info') {
  if (!isPreviewBuild) return Promise.resolve();
  const entry: PreviewLogEntry = {
    time: new Date().toISOString(), event: redactPreviewDetail(event),
    detail: redactPreviewDetail(detail), level, sha: preview?.sha || '',
  };
  return enqueue(async () => {
    const entries = await loadEntries();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...entries, entry].slice(-MAX_ENTRIES)));
  }).catch(() => undefined);
}

export function readPreviewLogs() {
  return isPreviewBuild ? enqueue(loadEntries) : Promise.resolve([]);
}

export function clearPreviewLogs() {
  return isPreviewBuild ? enqueue(() => AsyncStorage.removeItem(STORAGE_KEY)) : Promise.resolve();
}

export function previewBuildDetails() {
  const android = Platform.OS === 'android'
    ? Platform.constants as { Release?: string; Model?: string } | undefined : undefined;
  return {
    pr: preview?.pr || '', sha: preview?.sha || '',
    backend: redactPreviewDetail(String(Constants.expoConfig?.extra?.backendUrl || '')),
    platform: Platform.OS, osVersion: android?.Release || String(Platform.Version),
    deviceModel: android?.Model || '',
    appVersion: Constants.nativeAppVersion || Constants.expoConfig?.version || '',
    mapsConfigured: preview?.mapsConfigured === true,
  };
}

type ErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsType = { getGlobalHandler: () => ErrorHandler; setGlobalHandler: (handler: ErrorHandler) => void };

export function installPreviewErrorHandler() {
  if (!isPreviewBuild) return () => {};
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return () => {};
  const previous = errorUtils.getGlobalHandler();
  const handler: ErrorHandler = (error, isFatal) => {
    // Best effort: native process termination can happen before storage flushes.
    void recordPreviewEvent(isFatal ? 'js.fatal' : 'js.error', error.stack || error.message, 'error');
    previous(error, isFatal);
  };
  errorUtils.setGlobalHandler(handler);
  return () => {
    if (errorUtils.getGlobalHandler() === handler) errorUtils.setGlobalHandler(previous);
  };
}
