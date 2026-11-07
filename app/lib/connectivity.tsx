import NetInfo, { type NetInfoState, useNetInfo } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import React, { createContext, useContext, useMemo } from 'react';

type ConnectivityContextValue = {
  isReady: boolean;
  isOnline: boolean;
  isOffline: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

let hasConfiguredOnlineManager = false;

function isStateOnline(state: NetInfoState | null | undefined) {
  if (!state) {
    return false;
  }

  // A cold start has null connection fields. Do not start requests or discard
  // cached credentials until a connection has actually been observed.
  return state.isConnected === true && state.isInternetReachable === true;
}

export function configureQueryOnlineManager() {
  if (hasConfiguredOnlineManager) {
    return;
  }

  onlineManager.setEventListener((setOnline) => {
    setOnline(false);
    return NetInfo.addEventListener((state) => {
      setOnline(isStateOnline(state));
    });
  });

  hasConfiguredOnlineManager = true;
}

export async function isDeviceOnline() {
  const state = await NetInfo.fetch();
  return isStateOnline(state);
}

export function ConnectivityProvider({ children }: React.PropsWithChildren) {
  const netInfo = useNetInfo();

  const value = useMemo<ConnectivityContextValue>(() => {
    const isOnline = isStateOnline(netInfo);
    return {
      isReady: netInfo.isConnected === false || (netInfo.isConnected === true && netInfo.isInternetReachable !== null),
      isOnline,
      isOffline: !isOnline,
    };
  }, [netInfo]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used inside ConnectivityProvider');
  }

  return context;
}
