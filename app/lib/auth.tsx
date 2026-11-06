import type { Provider, Session } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { hasAdminRole } from '@/lib/admin-access';
import { fetchCurrentUserProfile, updateCurrentUserOnboardingCompleted, type CurrentUserProfileData } from '@/lib/api';
import { clearBasicAuthSession, loadBasicAuthSession, saveBasicAuthSession } from '@/lib/basic-auth-session';
import { appConfig, getMissingConfig } from '@/lib/config';
import { useConnectivity } from '@/lib/connectivity';
import { clearPersistedQueryCache } from '@/lib/query-persistence';
import { queryClient } from '@/lib/query-client';
import { isStaticWebsite, openLiveAppLogin } from '@/lib/static-website';
import { authStorage, clearLegacyAuthStorage } from '@/lib/auth-storage';
import { clearOfflineCaches } from '@/lib/offline-cache-registry';
import { getSupabase, supabaseStorageKey } from '@/lib/supabase';
if (typeof WebBrowser.maybeCompleteAuthSession === 'function') WebBrowser.maybeCompleteAuthSession();
type SessionMode = 'online' | 'offline_grace';
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
  login: (username?: string, password?: string) => Promise<void>;
  signup: (email?: string, password?: string) => Promise<void>;
  resetPassword?: (email: string) => Promise<void>;
  updatePassword?: (password: string) => Promise<void>;
  loginWithProvider?: (provider: string) => Promise<void>;
  authNotice?: string | null;
  passwordRecovery?: boolean;
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
export function AuthProvider({ children }: React.PropsWithChildren) {
  if (isStaticWebsite) return <StaticWebsiteAuthProvider>{children}</StaticWebsiteAuthProvider>;
  return appConfig.authMode === 'basic'
    ? <BasicAuthProvider>{children}</BasicAuthProvider>
    : <SsoAuthProvider>{children}</SsoAuthProvider>;
}

function StaticWebsiteAuthProvider({ children }: React.PropsWithChildren) {
  const login = async () => { openLiveAppLogin(); };
  const noop = async () => {};
  const value: AuthContextValue = {
    accessToken: null, idToken: null, refreshToken: null, issuedAt: null, expiresIn: null,
    sessionMode: 'online', isOffline: false, canPerformWrites: false,
    currentUserProfile: null, hasCompletedOnboarding: true,
    isAuthenticated: false, isLoading: false, authError: null, configError: null,
    login, signup: login, completeWebRedirectAuth: async () => false,
    getValidAccessToken: async () => null, completeOnboarding: noop,
    logout: noop, logoutEverywhere: noop, resetApp: noop,
    preloadCurrentUserProfile: async () => null, setCurrentUserProfile: () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function BasicAuthProvider({ children }: React.PropsWithChildren) {
  const { isOffline } = useConnectivity();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web');
  const [authError, setAuthError] = useState<string | null>(null);
  const sessionRevision = useRef(0);
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const session = await loadBasicAuthSession();
        if (active && sessionRevision.current === 0 && session) {
          setAccessToken(session.token);
          setCurrentUserProfile(session.profile);
        }
      } catch {
        if (active && sessionRevision.current === 0) setAuthError('Gespeicherte Anmeldung konnte nicht geladen werden. Bitte erneut anmelden.');
      } finally {
        if (active && sessionRevision.current === 0) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);
  const updateCurrentUserProfileState = useCallback((profile: CurrentUserProfileData | null) => {
    setCurrentUserProfile((currentProfile) =>
      profile && currentProfile?.id === profile.id && typeof profile.onboardingCompleted !== 'boolean'
        ? { ...profile, onboardingCompleted: currentProfile.onboardingCompleted }
        : profile
    );
  }, []);
  const preloadCurrentUserProfile = useCallback(async () => {
    if (!accessToken) return null;
    const revision = sessionRevision.current;
    const profile = await fetchCurrentUserProfile(accessToken);
    if (revision !== sessionRevision.current) return null;
    await saveBasicAuthSession({ token: accessToken, profile });
    if (revision !== sessionRevision.current) return null;
    setCurrentUserProfile(profile);
    return profile;
  }, [accessToken]);
  const logout = useCallback(async () => {
    sessionRevision.current += 1;
    setIsLoading(false);
    setAccessToken(null);
    setCurrentUserProfile(null);
    setAuthError(null);
    queryClient.clear();
    await clearBasicAuthSession();
    await clearOfflineCaches();
    await clearPersistedQueryCache();
  }, []);
  const login = useCallback(async (username = '', password = '') => {
    const revision = ++sessionRevision.current;
    setIsLoading(true);
    setAuthError(null);
    try {
      const token = btoa(`${username}:${password}`);
      const profile = await fetchCurrentUserProfile(token);
      if (revision !== sessionRevision.current) return;
      queryClient.clear();
      await clearPersistedQueryCache();
      if (revision !== sessionRevision.current) return;
      await saveBasicAuthSession({ token, profile });
      if (revision !== sessionRevision.current) return;
      setCurrentUserProfile(profile);
      setAccessToken(token);
    } catch (error) {
      if (revision !== sessionRevision.current) return;
      setAuthError(error instanceof Error && error.name === 'UnauthorizedError'
        ? 'Nutzername oder Passwort ist falsch.' : 'Anmeldung fehlgeschlagen. Bitte Backend und Zugangsdaten pruefen.');
    } finally {
      if (revision === sessionRevision.current) setIsLoading(false);
    }
  }, []);
  const completeOnboarding = useCallback(async () => {
    if (!accessToken) return;
    await updateCurrentUserOnboardingCompleted(accessToken, true);
    await preloadCurrentUserProfile();
  }, [accessToken, preloadCurrentUserProfile]);
  const signup = useCallback(async () => {
    setAuthError('Lokale Testkonten werden im CAP-Profil konfiguriert.');
  }, []);
  const completeWebRedirectAuth = useCallback(async () => false, []);
  const getValidAccessToken = useCallback(async () => accessToken, [accessToken]);
  const value: AuthContextValue = {
    accessToken, idToken: null, refreshToken: null, issuedAt: null, expiresIn: null,
    sessionMode: 'online', isOffline, canPerformWrites: !!accessToken && !isOffline,
    currentUserProfile, hasCompletedOnboarding: currentUserProfile?.onboardingCompleted ?? false,
    isAuthenticated: !!accessToken, isLoading, authError, configError: null,
    login, signup, completeWebRedirectAuth, getValidAccessToken,
    completeOnboarding, logout, logoutEverywhere: logout, resetApp: logout,
    preloadCurrentUserProfile, setCurrentUserProfile: updateCurrentUserProfileState,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SsoAuthProvider({ children }: React.PropsWithChildren) {
  const { isOffline } = useConnectivity();
  const [session, setSession] = useState<Session | null>(null);
  const [currentUserProfile, setProfile] = useState<CurrentUserProfileData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [authError, setError] = useState<string | null>(null);
  const [authNotice, setNotice] = useState<string | null>(null);
  const [passwordRecovery, setRecovery] = useState(false);
  const live = useRef<Session | null>(null);
  const offline = useRef(isOffline); offline.current = isOffline;
  const signedOut = useRef(false);
  const exchanges = useRef(new Map<string, Promise<boolean>>());
  const revision = useRef(0);
  const missing = getMissingConfig();
  const configError = missing.length ? `Anmeldung konfigurieren: ${missing.join(', ')}` : null;
  const redirectUri = Platform.OS === 'web'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${Constants.expoConfig?.experiments?.baseUrl || ''}/auth/callback`
    : AuthSession.makeRedirectUri({ scheme: 'harzerwanderbuddyapp', path: 'auth/callback' });
  const profileKey = (id: string) => `hwb-supabase-profile-${appConfig.supabaseUrl.replace(/[^a-zA-Z0-9.-]/g, '-')}-${id}`;
  const clearCaches = useCallback(async () => {
    await queryClient.cancelQueries(); queryClient.clear(); await clearPersistedQueryCache();
  }, []);
  const applySession = useCallback(async (next: Session | null) => {
    if (next && signedOut.current) return;
    const turn = ++revision.current;
    const owner = next ? `${appConfig.supabaseUrl}|${next.user.id}` : '';
    const previous = await authStorage.getItem('hwb-supabase-cache-owner');
    if (turn !== revision.current) return;
    if (previous !== owner) {
      setSession(null); setProfile(null);
      await clearCaches();
      await authStorage.setItem('hwb-supabase-cache-owner', owner);
    }
    if (turn !== revision.current) return;
    live.current = next; setSession(next);
    if (!next) { setProfile(null); setLoading(false); return; }
    const stored = await authStorage.getItem(profileKey(next.user.id));
    if (turn !== revision.current) return;
    setProfile(stored ? JSON.parse(stored) : null);
    if (offline.current) { setLoading(false); return; }
    try {
      const profile = await fetchCurrentUserProfile(next.access_token);
      if (turn !== revision.current) return;
      await authStorage.setItem(profileKey(next.user.id), JSON.stringify(profile));
      if (turn === revision.current) setProfile(profile);
    } catch (error) {
      if (turn === revision.current && error instanceof Error && error.name === 'UnauthorizedError') {
        live.current = null; setSession(null); setProfile(null); await clearCaches();
        await authStorage.removeItem(profileKey(next.user.id));
        await getSupabase().auth.signOut({ scope: 'local' });
      }
    } finally { if (turn === revision.current) setLoading(false); }
  }, [clearCaches]);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch { setError('Anmeldung fehlgeschlagen. Bitte Verbindung und Eingaben prüfen und erneut versuchen.'); }
    finally { actionPending.current = false; setBusy(false); }
  }, []);
  const callback = useCallback(async (url: string) => {
    try {
      const target = new URL(url);
      const expected = new URL(redirectUri);
      if (target.protocol !== expected.protocol || target.host !== expected.host || target.pathname !== expected.pathname) return false;
      if (target.searchParams.has('error')) { setError('Anmeldung wurde abgebrochen oder der Link ist abgelaufen.'); return false; }
      const code = target.searchParams.get('code');
      if (!code) return false;
      const existing = exchanges.current.get(code);
      if (existing) return await existing;
      const exchange = (async () => {
      signedOut.current = false;
      const { data, error } = await getSupabase().auth.exchangeCodeForSession(code);
      if (Platform.OS === 'web') window.history.replaceState({}, '', target.pathname);
      if (error) { setError('Der Anmeldelink ist abgelaufen oder gehört zu einem anderen Gerät. Bitte neu anfordern.'); return false; }
      await applySession(data.session); return true;
      })();
      exchanges.current.set(code, exchange);
      return await exchange;
    } catch { setError('Anmeldelink konnte nicht verarbeitet werden. Bitte erneut anfordern.'); return false; }
  }, [redirectUri, applySession]);
  useEffect(() => {
    if (configError) { void clearCaches(); setLoading(false); return; }
    const supabase = getSupabase();
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      // Leave the SDK's auth lock before making async auth calls.
      setTimeout(() => { if (active && !(event === 'INITIAL_SESSION' && !next && offline.current)) void applySession(next).catch(() => setError('Sitzung konnte nicht geladen werden.')); }, 0);
    });
    void (async () => {
      // Read-only offline restoration: never use this unverified local session for server authorization.
      await clearLegacyAuthStorage();
      const raw = await authStorage.getItem(supabaseStorageKey);
      if (active && raw && offline.current) {
        const cached = JSON.parse(raw) as Session;
        if (cached?.user?.id && cached.access_token && cached.refresh_token) await applySession(cached);
      }
      const { data } = await supabase.auth.getSession();
      if (active && !(offline.current && !data.session && live.current)) await applySession(data.session);
    })().catch(() => { if (active) { setError('Sitzung konnte nicht geladen werden.'); setLoading(false); } });
    const links = Linking.addEventListener('url', ({ url }) => { void callback(url); });
    if (Platform.OS !== 'web') void Linking.getInitialURL().then(url => { if (url) void callback(url); }).catch(() => setError('Anmeldelink konnte nicht gelesen werden.'));
    const refresh = (state: string) => { if (state === 'active' && !offline.current) supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);
    return () => { active = false; subscription.unsubscribe(); links.remove(); appState.remove(); if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh(); };
  }, [configError, applySession, callback, clearCaches]);
  useEffect(() => {
    if (configError || Platform.OS === 'web') return;
    const auth = getSupabase().auth;
    if (!isOffline && AppState.currentState === 'active') auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  }, [isOffline, configError]);
  const getValidAccessToken = useCallback(async () => {
    if (isOffline || !live.current) return null;
    const owner = live.current.user.id;
    const turn = revision.current;
    const { data, error } = await getSupabase().auth.getSession();
    if (turn !== revision.current || live.current?.user.id !== owner || data.session?.user.id !== owner) return null;
    if (error || !data.session || (data.session.expires_at || 0) <= Date.now() / 1000) return null;
    return data.session.access_token;
  }, [isOffline]);
  const preloadCurrentUserProfile = useCallback(async () => {
    const token = await getValidAccessToken(); if (!token) return null;
    const turn = revision.current;
    const profile = await fetchCurrentUserProfile(token);
    if (turn !== revision.current) return null;
    setProfile(profile);
    if (live.current) await authStorage.setItem(profileKey(live.current.user.id), JSON.stringify(profile));
    return profile;
  }, [getValidAccessToken]);
  const logout = useCallback(async () => {
    const old = live.current;
    signedOut.current = true;
    live.current = null; ++revision.current; setLoading(false); setSession(null); setProfile(null); setRecovery(false);
    await clearCaches();
    if (old) await authStorage.removeItem(profileKey(old.user.id));
    await clearOfflineCaches();
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(key => key.startsWith('hwb-offline-notes-v1:') || key.startsWith('hwb-offline-visits-v1:')));
    const { error } = await getSupabase().auth.signOut({ scope: 'local' });
    await authStorage.removeItem(supabaseStorageKey);
    if (error) setError('Abmeldung beim Anmeldedienst fehlgeschlagen. Bitte erneut versuchen.');
  }, [clearCaches]);
  const value: AuthContextValue = {
    accessToken: session?.access_token ?? null, idToken: null, refreshToken: session?.refresh_token ?? null,
    issuedAt: null, expiresIn: session?.expires_in ?? null, sessionMode: isOffline ? 'offline_grace' : 'online',
    isOffline, canPerformWrites: !!session && !isOffline && (session.expires_at || 0) > Date.now() / 1000,
    currentUserProfile, hasCompletedOnboarding: currentUserProfile?.onboardingCompleted ?? false,
    isAuthenticated: !!session, isLoading: isLoading || busy, authError, authNotice, configError, passwordRecovery,
    login: (email = '', password = '') => run(async () => {
      signedOut.current = false;
      const { error } = await getSupabase().auth.signInWithPassword({ email, password }); if (error) throw error;
    }),
    signup: (email = '', password = '') => run(async () => {
      signedOut.current = false;
      const { error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectUri } });
      if (error) throw error; setNotice('Bitte bestätige deine E-Mail-Adresse über den zugesandten Link auf diesem Gerät.');
    }),
    resetPassword: email => run(async () => {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: redirectUri });
      if (error) throw error; setNotice('Falls ein Konto existiert, erhältst du einen Link zum Zurücksetzen auf diesem Gerät.');
    }),
    updatePassword: password => run(async () => {
      const { error } = await getSupabase().auth.updateUser({ password }); if (error) throw error;
      setRecovery(false); setNotice('Passwort aktualisiert.');
    }),
    loginWithProvider: provider => run(async () => {
      if (!appConfig.supabaseOAuthProviders.split(',').includes(provider)) throw new Error('Provider disabled');
      const { data, error } = await getSupabase().auth.signInWithOAuth({ provider: provider as Provider,
        options: { redirectTo: redirectUri, skipBrowserRedirect: Platform.OS !== 'web' } });
      if (error) throw error;
      if (Platform.OS !== 'web' && data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success') await callback(result.url);
      }
    }),
    completeWebRedirectAuth: () => Platform.OS === 'web' ? callback(window.location.href) : Promise.resolve(false),
    getValidAccessToken, preloadCurrentUserProfile,
    completeOnboarding: async () => { const token = await getValidAccessToken(); if (!token) throw new Error('Bitte anmelden.'); await updateCurrentUserOnboardingCompleted(token, true); await preloadCurrentUserProfile(); },
    setCurrentUserProfile: profile => {
      const merged = profile && profile.id === currentUserProfile?.id && typeof profile.onboardingCompleted !== 'boolean'
        ? { ...profile, onboardingCompleted: currentUserProfile.onboardingCompleted } : profile;
      setProfile(merged);
      if (live.current && merged) void authStorage.setItem(profileKey(live.current.user.id), JSON.stringify(merged))
        .catch(() => setError('Profil konnte nicht lokal gespeichert werden.'));
    }, logout,
    resetApp: async () => {
      const token = await getValidAccessToken();
      if (token) await updateCurrentUserOnboardingCompleted(token, false);
      await logout();
    },
    logoutEverywhere: async () => { const { error } = await getSupabase().auth.signOut({ scope: 'global' }); if (error) { setError('Globale Abmeldung fehlgeschlagen.'); return; } await logout(); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export function useIdTokenClaims<T>() {
  const { currentUserProfile } = useAuth();
  return currentUserProfile ? { sub: currentUserProfile.id, name: currentUserProfile.name,
    picture: currentUserProfile.picture } as T : null;
}
export function useAdminAccess() {
  const { currentUserProfile, isAuthenticated, isLoading } = useAuth();
  const profileRoles = currentUserProfile?.roles ?? [];
  return { isAdmin: hasAdminRole(profileRoles), source: profileRoles.length ? 'profile' : 'none',
    isResolved: !isLoading && (!isAuthenticated || !!currentUserProfile), claimRoles: [], profileRoles } as const;
}
