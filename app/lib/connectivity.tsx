import NetInfo, { type NetInfoState, useNetInfo } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import React, { createContext, useContext, useMemo } from 'react';

type ConnectivityContextValue = {
  isOnline: boolean;
  isOffline: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

let hasConfiguredOnlineManager = false;

function isStateOnline(state: NetInfoState | null | undefined) {
  if (!state) {
    return true;
  }

  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function configureQueryOnlineManager() {
  if (hasConfiguredOnlineManager) {
    return;
  }

  onlineManager.setEventListener((setOnline) => {
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
