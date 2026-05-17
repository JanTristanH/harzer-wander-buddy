import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { extractRolesFromClaims, hasAdminRole } from '@/lib/admin-access';
import { fetchCurrentUserProfile, type CurrentUserProfileData } from '@/lib/api';
import { appConfig, getAuth0ClientIdForPlatform, getMissingConfig } from '@/lib/config';
import { useConnectivity } from '@/lib/connectivity';
import { clearPersistedQueryCache } from '@/lib/query-persistence';
import { queryClient } from '@/lib/query-client';

if (typeof WebBrowser.maybeCompleteAuthSession === 'function') {
  WebBrowser.maybeCompleteAuthSession();
}

const TOKEN_STORAGE_KEY = 'hwb-auth-token-response';
const TOKEN_METADATA_STORAGE_KEY = 'hwb-auth-token-response-metadata';
const TOKEN_ACCESS_TOKEN_STORAGE_KEY = 'hwb-auth-token-response-access-token';
const TOKEN_ID_TOKEN_STORAGE_KEY = 'hwb-auth-token-response-id-token';
const TOKEN_REFRESH_TOKEN_STORAGE_KEY = 'hwb-auth-token-response-refresh-token';
const ONBOARDING_STORAGE_KEY = 'hwb-auth-onboarding-complete';
const WEB_AUTH_PENDING_KEY = 'hwb-auth-pending-web-request';
const CURRENT_USER_PROFILE_QUERY_KEY_PREFIX = 'current-user-profile';
const inMemoryStorage = new Map<string, string>();
const AUTH_DEBUG_ENABLED = false;

type AuthState = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  issuedAt?: number;
  expiresIn?: number;
};

type StoredTokenState = {
  accessToken: string;
  tokenType?: AuthSession.TokenType;
  scope?: string;
  idToken?: string;
  refreshToken?: string;
  issuedAt?: number;
  expiresIn?: number;
};

type StoredTokenMetadata = Omit<StoredTokenState, 'accessToken' | 'idToken' | 'refreshToken'> & {
  storageVersion: 2;
};

type SessionMode = 'online' | 'offline_grace';

type ResolveValidTokenResponseResult = {
  tokenResponse: AuthSession.TokenResponse | null;
  sessionMode: SessionMode;
};

type PendingWebAuthState = {
  codeVerifier: string;
  redirectUri: string;
  state: string;
};

type AuthContextValue = {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  issuedAt: number | null;
  expiresIn: number | null;
  sessionMode: SessionMode;
  isOffline: boolean;
  canPerformWrites: boolean;
  currentUserProfile: CurrentUserProfileData | null;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  configError: string | null;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  completeWebRedirectAuth: () => Promise<boolean>;
  getValidAccessToken: () => Promise<string | null>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  resetApp: () => Promise<void>;
  preloadCurrentUserProfile: () => Promise<CurrentUserProfileData | null>;
  setCurrentUserProfile: (profile: CurrentUserProfileData | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getIssuer() {
  const domain = appConfig.auth0Domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${domain}`;
}

function normalizePath(path?: string | null) {
  if (typeof path !== 'string') {
    return 'auth/logout';
  }

  const normalizedPath = path.trim();
  return normalizedPath.length > 0 ? normalizedPath : 'auth/logout';
}

function getWebBasePath() {
  const configuredBasePath = (
    Constants.expoConfig as
      | {
          experiments?: {
            baseUrl?: string;
          };
        }
      | undefined
  )?.experiments?.baseUrl;

  if (typeof configuredBasePath !== 'string') {
    return '';
  }

  const trimmed = configuredBasePath.trim();
  if (!trimmed) {
    return '';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function joinUrlPath(basePath: string, path: string) {
  const normalizedPath = path.replace(/^\/+/, '');

  if (!basePath) {
    return `/${normalizedPath}`;
  }

  return `${basePath}/${normalizedPath}`;
}

function getRedirectUri(path?: string | null) {
  const configScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configScheme) ? configScheme[0] : configScheme;

  if (Platform.OS === 'web') {
    const webPath = joinUrlPath(getWebBasePath(), normalizePath(path));
    const origin = globalThis.location?.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      return `${origin}${webPath}`;
    }

    return AuthSession.makeRedirectUri({
      path: webPath.replace(/^\//, ''),
    });
  }

  return AuthSession.makeRedirectUri({
    scheme: scheme ?? 'harzerwanderbuddyapp',
    path: normalizePath(path),
  });
}

function decodeJwt<T>(token: string | undefined): T | null {
  if (!token) {
    return null;
  }

  try {
    return jwtDecode<T>(token);
  } catch {
    return null;
  }
}

function hasSecureStoreApi() {
  return (
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function' &&
    typeof SecureStore.deleteItemAsync === 'function'
  );
}

function getLocalStorageOrNull() {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function getWebStorageOrNull() {
  const storage = getLocalStorageOrNull();
  if (!storage) {
    return null;
  }

  try {
    const probeKey = '__hwb_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function shouldUseWebRedirectAuth() {
  if (Platform.OS !== 'web' || typeof globalThis.navigator?.userAgent !== 'string') {
    return false;
  }

  return /android|iphone|ipad|ipod|mobile/i.test(globalThis.navigator.userAgent);
}

async function setStoredValue(key: string, value: string) {
  if (Platform.OS !== 'web' && hasSecureStoreApi()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (error) {
      console.warn('Failed to write to SecureStore. Falling back to web/in-memory storage.', error);
    }
  }

  const webStorage = getWebStorageOrNull();
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }

  inMemoryStorage.set(key, value);
}

async function getStoredValue(key: string) {
  if (Platform.OS !== 'web' && hasSecureStoreApi()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('Failed to read from SecureStore. Falling back to web/in-memory storage.', error);
    }
  }

  const webStorage = getWebStorageOrNull();
  if (webStorage) {
    return webStorage.getItem(key);
  }

  return inMemoryStorage.get(key) ?? null;
}

async function deleteStoredValue(key: string) {
  if (Platform.OS !== 'web' && hasSecureStoreApi()) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch (error) {
      console.warn('Failed to delete from SecureStore. Falling back to web/in-memory storage.', error);
    }
  }

  const webStorage = getWebStorageOrNull();
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }

  inMemoryStorage.delete(key);
}

async function setOptionalStoredValue(key: string, value: string | undefined) {
  if (value) {
    await setStoredValue(key, value);
    return;
  }

  await deleteStoredValue(key);
}

function toTokenResponse(storedToken: StoredTokenState) {
  return new AuthSession.TokenResponse({
    accessToken: storedToken.accessToken,
    tokenType: storedToken.tokenType,
    scope: storedToken.scope,
    idToken: storedToken.idToken,
    refreshToken: storedToken.refreshToken,
    issuedAt: storedToken.issuedAt,
    expiresIn: storedToken.expiresIn,
  });
}

async function saveTokenResponse(tokenResponse: AuthSession.TokenResponse) {
  const metadata: StoredTokenMetadata = {
    storageVersion: 2,
    tokenType: tokenResponse.tokenType,
    scope: tokenResponse.scope,
    issuedAt: tokenResponse.issuedAt,
    expiresIn: tokenResponse.expiresIn,
  };

  await Promise.all([
    setStoredValue(TOKEN_METADATA_STORAGE_KEY, JSON.stringify(metadata)),
    setOptionalStoredValue(TOKEN_ACCESS_TOKEN_STORAGE_KEY, tokenResponse.accessToken),
    setOptionalStoredValue(TOKEN_ID_TOKEN_STORAGE_KEY, tokenResponse.idToken),
    setOptionalStoredValue(TOKEN_REFRESH_TOKEN_STORAGE_KEY, tokenResponse.refreshToken),
    deleteStoredValue(TOKEN_STORAGE_KEY),
  ]);
}

async function loadTokenResponse() {
  const [metadataValue, accessToken, idToken, refreshToken] = await Promise.all([
    getStoredValue(TOKEN_METADATA_STORAGE_KEY),
    getStoredValue(TOKEN_ACCESS_TOKEN_STORAGE_KEY),
    getStoredValue(TOKEN_ID_TOKEN_STORAGE_KEY),
    getStoredValue(TOKEN_REFRESH_TOKEN_STORAGE_KEY),
  ]);

  if (metadataValue || accessToken || idToken || refreshToken) {
    try {
      if (!metadataValue || (!accessToken && !refreshToken)) {
        throw new Error('Incomplete token storage state.');
      }

      const metadata = JSON.parse(metadataValue) as StoredTokenMetadata;
      return toTokenResponse({
        accessToken: accessToken ?? '',
        tokenType: metadata.tokenType,
        scope: metadata.scope,
        idToken: idToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
        issuedAt: accessToken ? metadata.issuedAt : 0,
        expiresIn: accessToken ? metadata.expiresIn : 1,
      });
    } catch (error) {
      console.warn('Failed to parse split token response. Clearing persisted token state.', error);
      await clearTokenResponse();
      return null;
    }
  }

  const storedValue = await getStoredValue(TOKEN_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue) as StoredTokenState;
    const tokenResponse = toTokenResponse(parsed);
    await saveTokenResponse(tokenResponse);
    return tokenResponse;
  } catch (error) {
    console.warn('Failed to parse stored token response. Clearing persisted token state.', error);
    await clearTokenResponse();
    return null;
  }
}

async function clearTokenResponse() {
  await Promise.all([
    deleteStoredValue(TOKEN_STORAGE_KEY),
    deleteStoredValue(TOKEN_METADATA_STORAGE_KEY),
    deleteStoredValue(TOKEN_ACCESS_TOKEN_STORAGE_KEY),
    deleteStoredValue(TOKEN_ID_TOKEN_STORAGE_KEY),
    deleteStoredValue(TOKEN_REFRESH_TOKEN_STORAGE_KEY),
  ]);
}

async function saveOnboardingState(hasCompletedOnboarding: boolean) {
  await setStoredValue(ONBOARDING_STORAGE_KEY, hasCompletedOnboarding ? 'true' : 'false');
}

async function loadOnboardingState() {
  const storedValue = await getStoredValue(ONBOARDING_STORAGE_KEY);
  return storedValue === 'true';
}

function isMissingCurrentUserProfile(error: unknown) {
  return (
    error instanceof Error &&
    /not found/i.test(error.message) &&
    /Users/i.test(error.message)
  );
}

function getCurrentUserProfileQueryKey(accessToken: string) {
  const claims = decodeJwt<{ sub?: string }>(accessToken);
  return [CURRENT_USER_PROFILE_QUERY_KEY_PREFIX, claims?.sub ?? accessToken.slice(-16)] as const;
}

function toAuthState(tokenResponse: AuthSession.TokenResponse): AuthState {
  return {
    accessToken: tokenResponse.accessToken,
    idToken: tokenResponse.idToken,
    refreshToken: tokenResponse.refreshToken,
    issuedAt: tokenResponse.issuedAt,
    expiresIn: tokenResponse.expiresIn,
  };
}

function logTokenResponseMetadata(event: string, tokenResponse: AuthSession.TokenResponse | null) {
  if (!AUTH_DEBUG_ENABLED) {
    return;
  }

  console.info(`[auth] ${event}`, {
    hasAccessToken: Boolean(tokenResponse?.accessToken),
    hasIdToken: Boolean(tokenResponse?.idToken),
    hasRefreshToken: Boolean(tokenResponse?.refreshToken),
    issuedAt: tokenResponse?.issuedAt ?? null,
    expiresIn: tokenResponse?.expiresIn ?? null,
    scope: tokenResponse?.scope ?? null,
  });
}

function logAuthMetadata(event: string, metadata: Record<string, unknown>) {
  if (!AUTH_DEBUG_ENABLED) {
    return;
  }

  console.info(`[auth] ${event}`, metadata);
}

function isTokenFresh(tokenResponse: AuthSession.TokenResponse | null) {
  return AuthSession.TokenResponse.isTokenFresh(tokenResponse);
}

function isUnauthorizedError(error: unknown) {
  return error instanceof Error && error.name === 'UnauthorizedError';
}

function isInvalidGrantRefreshError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorRecord = error as {
    error?: unknown;
    message?: unknown;
    params?: {
      error?: unknown;
      error_description?: unknown;
    };
  };
  const errorCode = typeof errorRecord.error === 'string' ? errorRecord.error : '';
  const paramsErrorCode =
    typeof errorRecord.params?.error === 'string' ? errorRecord.params.error : '';
  const errorDescription =
    typeof errorRecord.params?.error_description === 'string'
      ? errorRecord.params.error_description
      : '';
  const message = typeof errorRecord.message === 'string' ? errorRecord.message : '';
  const normalizedText = `${errorCode} ${paramsErrorCode} ${errorDescription} ${message}`.toLowerCase();

  return normalizedText.includes('invalid_grant');
}

function mergeTokenResponse(
  previousTokenResponse: AuthSession.TokenResponse,
  nextTokenResponse: AuthSession.TokenResponse
) {
  return new AuthSession.TokenResponse({
    accessToken: nextTokenResponse.accessToken,
    tokenType: nextTokenResponse.tokenType ?? previousTokenResponse.tokenType,
    scope: nextTokenResponse.scope ?? previousTokenResponse.scope,
    idToken: nextTokenResponse.idToken ?? previousTokenResponse.idToken,
    refreshToken: nextTokenResponse.refreshToken ?? previousTokenResponse.refreshToken,
    issuedAt: nextTokenResponse.issuedAt ?? previousTokenResponse.issuedAt,
    expiresIn: nextTokenResponse.expiresIn ?? previousTokenResponse.expiresIn,
  });
}

function isNetworkRefreshError(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timed out') ||
    message.includes('fetch')
  );
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const { isOffline } = useConnectivity();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>('online');
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfileData | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<ResolveValidTokenResponseResult> | null>(null);
  const discoveryRef = useRef<AuthSession.DiscoveryDocument | null>(null);
  const discoveryPromiseRef = useRef<Promise<AuthSession.DiscoveryDocument | null> | null>(null);

  const missingConfig = getMissingConfig().filter(
    (key) => key !== 'auth0LogoutReturnPath' && !(Platform.OS === 'web' && key === 'backendUrl')
  );
  const configError =
    missingConfig.length > 0 ? `Missing Expo config: ${missingConfig.join(', ')}` : null;
  const auth0ClientId = getAuth0ClientIdForPlatform();

  const resolveDiscovery = useCallback(async () => {
    if (configError) {
      return null;
    }

    if (discoveryRef.current) {
      return discoveryRef.current;
    }

    if (!discoveryPromiseRef.current) {
      discoveryPromiseRef.current = AuthSession.fetchDiscoveryAsync(getIssuer())
        .then((discovery) => {
          discoveryRef.current = discovery;
          return discovery;
        })
        .finally(() => {
          discoveryPromiseRef.current = null;
        });
    }

    return discoveryPromiseRef.current;
  }, [configError]);

  useEffect(() => {
    if (configError) {
      discoveryRef.current = null;
      discoveryPromiseRef.current = null;
      return;
    }

    void resolveDiscovery().catch((error) => {
      console.warn('Failed to preload Auth0 discovery document.', error);
    });
  }, [configError, resolveDiscovery]);

  const preloadCurrentUserProfileForToken = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      setCurrentUserProfile(null);
      return null;
    }

    const queryKey = getCurrentUserProfileQueryKey(accessToken);
    const cachedProfile = queryClient.getQueryData<CurrentUserProfileData>(queryKey);
    if (cachedProfile) {
      setCurrentUserProfile(cachedProfile);
      return cachedProfile;
    }

    try {
      const profile = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchCurrentUserProfile(accessToken),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 14 * 24 * 60 * 60 * 1000,
      });
      setCurrentUserProfile(profile);
      return profile;
    } catch (error) {
      if (error instanceof Error && error.name === 'UnauthorizedError') {
        throw error;
      }

      if (isMissingCurrentUserProfile(error)) {
        queryClient.removeQueries({ queryKey, exact: true });
        setCurrentUserProfile(null);
        setHasCompletedOnboarding(false);
        await saveOnboardingState(false);
        return null;
      }

      throw error;
    }
  }, []);

  const preloadCurrentUserProfile = useCallback(async () => {
    return preloadCurrentUserProfileForToken(authState?.accessToken ?? null);
  }, [authState?.accessToken, preloadCurrentUserProfileForToken]);

  const updateCurrentUserProfileState = useCallback((profile: CurrentUserProfileData | null) => {
    setCurrentUserProfile(profile);
    if (profile) {
      queryClient.setQueryData([CURRENT_USER_PROFILE_QUERY_KEY_PREFIX, profile.id], profile);
    }
  }, []);

  const resolveValidTokenResponse = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      const forceRefresh = options?.forceRefresh ?? false;
      const tokenResponse = await loadTokenResponse();
      if (!tokenResponse) {
        return {
          tokenResponse: null,
          sessionMode: 'online',
        } satisfies ResolveValidTokenResponseResult;
      }

      if (!isOffline && !isTokenFresh(tokenResponse) && !tokenResponse.refreshToken) {
        logTokenResponseMetadata('expired cached token cannot refresh', tokenResponse);
        await clearTokenResponse();
        return {
          tokenResponse: null,
          sessionMode: 'online',
        } satisfies ResolveValidTokenResponseResult;
      }

      if (!forceRefresh && !tokenResponse.shouldRefresh()) {
        return {
          tokenResponse,
          sessionMode: 'online',
        } satisfies ResolveValidTokenResponseResult;
      }

      if (!tokenResponse.refreshToken || !auth0ClientId) {
        return {
          tokenResponse,
          sessionMode: isOffline ? 'offline_grace' : 'online',
        } satisfies ResolveValidTokenResponseResult;
      }

      try {
        const discovery = await resolveDiscovery();
        if (!discovery?.tokenEndpoint) {
          throw new Error('Could not load Auth0 discovery.');
        }

        const refreshedTokenResponse = await AuthSession.refreshAsync(
          {
            clientId: auth0ClientId,
            refreshToken: tokenResponse.refreshToken,
          },
          discovery
        );
        const mergedTokenResponse = mergeTokenResponse(tokenResponse, refreshedTokenResponse);
        await saveTokenResponse(mergedTokenResponse);
        logTokenResponseMetadata('refresh succeeded', mergedTokenResponse);
        return {
          tokenResponse: mergedTokenResponse,
          sessionMode: 'online',
        } satisfies ResolveValidTokenResponseResult;
      } catch (error) {
        if (isOffline || isNetworkRefreshError(error)) {
          return {
            tokenResponse,
            sessionMode: 'offline_grace',
          } satisfies ResolveValidTokenResponseResult;
        }

        throw error;
      }
    },
    [auth0ClientId, isOffline, resolveDiscovery]
  );

  const getValidAccessToken = useCallback(async () => {
    if (configError) {
      return null;
    }

    try {
      if (!refreshPromiseRef.current) {
        refreshPromiseRef.current = resolveValidTokenResponse().finally(() => {
          refreshPromiseRef.current = null;
        });
      }

      const resolved = await refreshPromiseRef.current;
      if (resolved.tokenResponse) {
        setAuthState(toAuthState(resolved.tokenResponse));
        setSessionMode(resolved.sessionMode);
        return resolved.tokenResponse.accessToken;
      }

      setAuthState(null);
      setSessionMode('online');
      return null;
    } catch (error) {
      const shouldInvalidateSession = isUnauthorizedError(error);

      if (shouldInvalidateSession) {
        await clearTokenResponse();
        setAuthState(null);
        setSessionMode('online');
        setCurrentUserProfile(null);
        return null;
      }

      if (isInvalidGrantRefreshError(error)) {
        console.warn('Auth0 refresh returned invalid_grant. Keeping cached session.', error);
        const cachedTokenResponse = await loadTokenResponse();
        if (cachedTokenResponse) {
          setAuthState(toAuthState(cachedTokenResponse));
          setSessionMode('offline_grace');
          return cachedTokenResponse.accessToken;
        }
        return null;
      }

      throw error;
    }
  }, [configError, resolveValidTokenResponse]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (configError) {
        setIsLoading(false);
        return;
      }

      const applySessionFromToken = (tokenResponse: AuthSession.TokenResponse | null, mode: SessionMode) => {
        if (!isMounted) {
          return;
        }

        if (!tokenResponse) {
          setAuthState(null);
          setSessionMode('online');
          setCurrentUserProfile(null);
          return;
        }

        setAuthState(toAuthState(tokenResponse));
        setSessionMode(mode);
      };

      const invalidateSession = async () => {
        await clearTokenResponse();
        if (!isMounted) {
          return;
        }

        setAuthState(null);
        setSessionMode('online');
        setCurrentUserProfile(null);
      };

      try {
        const storedOnboardingState = await loadOnboardingState();
        if (isMounted) {
          setHasCompletedOnboarding(storedOnboardingState);
        }

        const cachedTokenResponse = await loadTokenResponse();
        if (!cachedTokenResponse) {
          logTokenResponseMetadata('startup restore no cached token', null);
          applySessionFromToken(null, 'online');
          return;
        }

        if (!isOffline && !isTokenFresh(cachedTokenResponse) && !cachedTokenResponse.refreshToken) {
          logTokenResponseMetadata('startup found expired cached token without refresh token', cachedTokenResponse);
          await clearTokenResponse();
          applySessionFromToken(null, 'online');
          return;
        }

        logTokenResponseMetadata('startup restored cached token', cachedTokenResponse);
        applySessionFromToken(cachedTokenResponse, isOffline ? 'offline_grace' : 'online');
      } catch (error) {
        const shouldInvalidateSession = isUnauthorizedError(error);

        console.error('Failed to restore auth session', error);
        if (isMounted) {
          setAuthError(error instanceof Error ? error.message : 'Failed to restore auth session');
        }

        if (shouldInvalidateSession) {
          await invalidateSession();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }

      try {
        const resolved = await resolveValidTokenResponse();
        if (!resolved.tokenResponse) {
          applySessionFromToken(null, 'online');
          return;
        }

        applySessionFromToken(resolved.tokenResponse, resolved.sessionMode);

        if (!isMounted) {
          return;
        }

        if (resolved.sessionMode === 'offline_grace') {
          return;
        }

        await preloadCurrentUserProfileForToken(resolved.tokenResponse.accessToken);
        if (!isMounted) {
          return;
        }
      } catch (error) {
        const shouldKeepCachedSession =
          isUnauthorizedError(error) || isInvalidGrantRefreshError(error);

        if (shouldKeepCachedSession) {
          console.warn('Auth session refresh failed. Keeping cached session state.', error);
          if (isMounted) {
            setSessionMode('offline_grace');
          }
          return;
        }

        if (isOffline || isNetworkRefreshError(error)) {
          if (isMounted) {
            setSessionMode('offline_grace');
          }
          return;
        }

        console.warn('Failed to refresh startup auth session in background', error);
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [configError, isOffline, preloadCurrentUserProfileForToken, resolveValidTokenResponse]);

  useEffect(() => {
    if (Platform.OS === 'web' || typeof AppState.addEventListener !== 'function') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status !== 'active') {
        return;
      }

      void getValidAccessToken().catch((error) => {
        console.error('Failed to refresh auth token on foreground', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [getValidAccessToken]);

  const authenticate = useCallback(async (mode: 'login' | 'signup') => {
    if (configError) {
      return;
    }

    setAuthError(null);
    setIsLoading(true);

    try {
      const discovery = await resolveDiscovery();
      if (!discovery) {
        setAuthError('Could not load Auth0 discovery.');
        return;
      }

      const scopes = appConfig.auth0Scope.split(' ');
      const redirectUri = getRedirectUri('auth/callback');
      logAuthMetadata(`interactive ${mode} request`, {
        audience: appConfig.auth0Audience,
        platform: Platform.OS,
        scopes,
      });
      const request = new AuthSession.AuthRequest({
        clientId: auth0ClientId,
        scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
          audience: appConfig.auth0Audience,
          ...(mode === 'signup' ? { screen_hint: 'signup' } : {}),
        },
      });

      await request.makeAuthUrlAsync(discovery);
      console.log(`Auth0 ${mode} redirect URI:`, redirectUri);

      if (shouldUseWebRedirectAuth()) {
        if (!request.url || !request.codeVerifier || !request.state) {
          setAuthError(`Auth0 ${mode} request could not be prepared.`);
          return;
        }

        const pendingState: PendingWebAuthState = {
          codeVerifier: request.codeVerifier,
          redirectUri,
          state: request.state,
        };

        await setStoredValue(WEB_AUTH_PENDING_KEY, JSON.stringify(pendingState));

        if (typeof globalThis.location?.assign === 'function') {
          globalThis.location.assign(request.url);
          return;
        }

        throw new Error('This browser cannot perform redirect-based authentication.');
      }

      const result = await request.promptAsync(discovery);
      console.log(`Auth0 ${mode} prompt result type:`, result.type);

      if (result.type !== 'success' || !result.params.code) {
        if (result.type !== 'dismiss' && result.type !== 'cancel') {
          setAuthError(`Auth0 ${mode} did not return an authorization code.`);
        }
        return;
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: auth0ClientId,
          code: result.params.code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier ?? '',
          },
        },
        discovery
      );

      await saveTokenResponse(tokenResponse);
      logTokenResponseMetadata(`interactive ${mode} exchange succeeded`, tokenResponse);
      setCurrentUserProfile(null);
      setSessionMode('online');
      setAuthState({
        accessToken: tokenResponse.accessToken,
        idToken: tokenResponse.idToken,
        refreshToken: tokenResponse.refreshToken,
        issuedAt: tokenResponse.issuedAt,
        expiresIn: tokenResponse.expiresIn,
      });
      await preloadCurrentUserProfileForToken(tokenResponse.accessToken);
    } catch (error) {
      console.error(`Auth0 ${mode} failed`, error);
      setAuthError(error instanceof Error ? error.message : `Auth0 ${mode} failed`);
    } finally {
      setIsLoading(false);
    }
  }, [auth0ClientId, configError, preloadCurrentUserProfileForToken, resolveDiscovery]);

  const completeWebRedirectAuth = useCallback(async () => {
    if (Platform.OS !== 'web' || !auth0ClientId) {
      return false;
    }

    const pendingValue = await getStoredValue(WEB_AUTH_PENDING_KEY);
    if (!pendingValue) {
      return false;
    }

    const href = globalThis.location?.href;
    if (!href) {
      return false;
    }

    let pendingState: PendingWebAuthState;
    try {
      pendingState = JSON.parse(pendingValue) as PendingWebAuthState;
    } catch (error) {
      console.warn('Failed to parse pending web auth state. Clearing state.', error);
      await deleteStoredValue(WEB_AUTH_PENDING_KEY);
      return false;
    }

    const callbackUrl = new URL(href);
    const code = callbackUrl.searchParams.get('code');
    const state = callbackUrl.searchParams.get('state');
    const authErrorCode = callbackUrl.searchParams.get('error');
    const authErrorDescription = callbackUrl.searchParams.get('error_description');

    if (authErrorCode) {
      await deleteStoredValue(WEB_AUTH_PENDING_KEY);
      const message = authErrorDescription
        ? `${authErrorCode}: ${authErrorDescription}`
        : authErrorCode;
      setAuthError(message);
      return false;
    }

    if (!code || !state) {
      return false;
    }

    if (
      !pendingState.codeVerifier ||
      !pendingState.redirectUri ||
      !pendingState.state ||
      state !== pendingState.state
    ) {
      await deleteStoredValue(WEB_AUTH_PENDING_KEY);
      setAuthError('Auth0 returned an invalid authentication state.');
      return false;
    }

    setAuthError(null);
    setIsLoading(true);

    try {
      const discovery = await resolveDiscovery();
      if (!discovery) {
        setAuthError('Could not load Auth0 discovery.');
        return false;
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: auth0ClientId,
          code,
          redirectUri: pendingState.redirectUri,
          extraParams: {
            code_verifier: pendingState.codeVerifier,
          },
        },
        discovery
      );

      await saveTokenResponse(tokenResponse);
      await deleteStoredValue(WEB_AUTH_PENDING_KEY);
      logTokenResponseMetadata('web redirect exchange succeeded', tokenResponse);
      setCurrentUserProfile(null);
      setSessionMode('online');
      setAuthState(toAuthState(tokenResponse));
      await preloadCurrentUserProfileForToken(tokenResponse.accessToken);
      return true;
    } catch (error) {
      console.error('Auth0 web redirect completion failed', error);
      setAuthError(error instanceof Error ? error.message : 'Auth0 web redirect completion failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [auth0ClientId, preloadCurrentUserProfileForToken, resolveDiscovery]);

  const login = useCallback(async () => {
    await authenticate('login');
  }, [authenticate]);

  const signup = useCallback(async () => {
    await authenticate('signup');
  }, [authenticate]);

  const completeOnboarding = useCallback(async () => {
    await saveOnboardingState(true);
    setHasCompletedOnboarding(true);
  }, []);

  const clearLocalSession = useCallback(async () => {
    setAuthError(null);
    await clearTokenResponse();
    await deleteStoredValue(WEB_AUTH_PENDING_KEY);
    await clearPersistedQueryCache();
    queryClient.clear();
    setAuthState(null);
    setSessionMode('online');
    setCurrentUserProfile(null);
  }, []);

  const logout = useCallback(async () => {
    await clearLocalSession();
  }, [clearLocalSession]);

  const logoutEverywhere = useCallback(async () => {
    await clearLocalSession();
    try {
      if (!configError && auth0ClientId && appConfig.auth0Domain) {
        const returnTo = getRedirectUri(appConfig.auth0LogoutReturnPath);
        const logoutUrl =
          `${getIssuer()}/v2/logout?client_id=${encodeURIComponent(auth0ClientId ?? '')}` +
          `&returnTo=${encodeURIComponent(returnTo)}`;

        if (typeof WebBrowser.openAuthSessionAsync === 'function') {
          await WebBrowser.openAuthSessionAsync(logoutUrl, returnTo);
        } else if (typeof WebBrowser.openBrowserAsync === 'function') {
          await WebBrowser.openBrowserAsync(logoutUrl);
        } else if (Platform.OS === 'web' && typeof globalThis.location?.assign === 'function') {
          globalThis.location.assign(logoutUrl);
        }
      }
    } catch (error) {
      console.error('Auth0 logout failed', error);
    }
  }, [auth0ClientId, clearLocalSession, configError]);

  const resetApp = useCallback(async () => {
    await saveOnboardingState(false);
    setHasCompletedOnboarding(false);
    setCurrentUserProfile(null);
    await clearLocalSession();
  }, [clearLocalSession]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      accessToken: authState?.accessToken ?? null,
      idToken: authState?.idToken ?? null,
      refreshToken: authState?.refreshToken ?? null,
      issuedAt: authState?.issuedAt ?? null,
      expiresIn: authState?.expiresIn ?? null,
      sessionMode,
      isOffline,
      canPerformWrites: !!authState?.accessToken && !isOffline,
      currentUserProfile,
      hasCompletedOnboarding,
      isAuthenticated: !!authState?.accessToken,
      isLoading,
      authError,
      configError,
      completeOnboarding,
      login,
      signup,
      completeWebRedirectAuth,
      getValidAccessToken,
      logout,
      logoutEverywhere,
      resetApp,
      preloadCurrentUserProfile,
      setCurrentUserProfile: updateCurrentUserProfileState,
    }),
    [
      authError,
      authState?.accessToken,
      authState?.expiresIn,
      authState?.idToken,
      authState?.issuedAt,
      authState?.refreshToken,
      sessionMode,
      configError,
      completeOnboarding,
      completeWebRedirectAuth,
      currentUserProfile,
      getValidAccessToken,
      isOffline,
      login,
      hasCompletedOnboarding,
      isLoading,
      logout,
      logoutEverywhere,
      preloadCurrentUserProfile,
      resetApp,
      signup,
      updateCurrentUserProfileState,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export function useIdTokenClaims<T>() {
  const { idToken } = useAuth();
  return decodeJwt<T>(idToken ?? undefined);
}

type GenericIdTokenClaims = Record<string, unknown> & { sub?: string };

export function useAdminAccess() {
  const { currentUserProfile, isAuthenticated, isLoading } = useAuth();
  const claims = useIdTokenClaims<GenericIdTokenClaims>();
  const claimRoles = useMemo(() => extractRolesFromClaims(claims), [claims]);
  const profileRoles = currentUserProfile?.roles ?? [];
  const isAdminFromClaims = hasAdminRole(claimRoles);
  const isAdminFromProfile = hasAdminRole(profileRoles);
  const isAdmin = isAdminFromClaims || isAdminFromProfile;
  const source = isAdminFromClaims ? 'claims' : isAdminFromProfile ? 'profile' : 'none';
  const isResolved = !isAuthenticated || isAdminFromClaims || Boolean(currentUserProfile);

  return {
    isAdmin,
    source,
    isResolved: isResolved && !isLoading,
    claimRoles,
    profileRoles,
  } as const;
}
