import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { installPreviewErrorHandler, isPreviewBuild, previewBuildDetails, recordPreviewEvent } from '@/lib/preview-diagnostics';

export function PreviewDiagnosticsBridge() {
  const route = useSegments().join('/');
  useEffect(() => {
    if (!isPreviewBuild) return;
    void recordPreviewEvent('app.started', JSON.stringify(previewBuildDetails()));
    const removeHandler = installPreviewErrorHandler();
    const subscription = AppState.addEventListener('change', state => { void recordPreviewEvent('app.state', state); });
    return () => { removeHandler(); subscription.remove(); };
  }, []);
  useEffect(() => {
    // Segments are route templates, e.g. profile/[userId], not personal URLs.
    void recordPreviewEvent('navigation', route);
  }, [route]);
  return null;
}
