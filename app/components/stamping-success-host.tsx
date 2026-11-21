import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { fetchStampingFeedback } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { subscribeStampingSuccess, type StampingFeedback } from '@/lib/stamping-feedback';
import { StampingSuccessCard } from './stamping-success-card';

function isBackground() { return AppState.currentState === 'background'; }

export function StampingSuccessHost() {
  const auth = useAuth();
  const claimOwner = useIdTokenClaims<{ sub?: string }>()?.sub;
  const owner = auth.isAuthenticated ? claimOwner : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const live = useRef({ auth, owner });
  live.current = { auth, owner };
  const [card, setCard] = useState<{ owner: string; feedback: StampingFeedback | null; friends: number; saved: number; run: number } | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    const seen = new Set<string>();
    setCard(null);
    const unsubscribe = subscribeStampingSuccess(event => {
      if (!owner || event.owner !== owner) return;
      const ids = [...new Set(event.visitIds)].filter(id => !seen.has(id));
      const groupKey = event.eventId ? `group:${event.eventId}` : '';
      const friends = groupKey && !seen.has(groupKey) ? event.friendVisitCount ?? 0 : 0;
      if (!ids.length && !friends) return;
      ids.forEach(id => seen.add(id));
      if (groupKey) seen.add(groupKey);
      while (seen.size > 5000) seen.delete(seen.values().next().value!);
      queue.current = queue.current.catch(() => undefined).then(async () => {
        if (!active || live.current.owner !== owner || isBackground()) return;
        let token: string | null | undefined;
        try { token = await live.current.auth.getValidAccessToken(); } catch { return; }
        if (!token || !active || live.current.owner !== owner) return;
        let feedback: StampingFeedback | null = null;
        try {
          if (ids.length) feedback = await fetchStampingFeedback(token, ids);
        } catch {
          // Feedback failure must never turn a saved visit into a failed write or
          // encourage another POST. Existing local/status UI remains available.
        }
        if (!active || live.current.owner !== owner || isBackground()) return;
        if (feedback && !feedback.visitCount && !friends) return;
        void queryClient.invalidateQueries({ queryKey: ['badgeAlbum', owner] });
        setCard(previous => ({ owner, feedback, friends, saved: ids.length, run: (previous?.run ?? 0) + 1 }));
      });
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') setCard(null);
    });
    return () => { active = false; unsubscribe(); subscription.remove(); };
  }, [owner, queryClient]);

  useEffect(() => {
    if (!card) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (active && !enabled) timer = setTimeout(() => setCard(null), card.feedback?.newBadges.length ? 14000 : 9000);
    });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [card]);
  if (!card || !auth.isAuthenticated || card.owner !== owner) return null;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, zIndex: 1000, elevation: 20 }}>
    <StampingSuccessCard feedback={card.feedback} friendVisitCount={card.friends} savedVisitCount={card.saved}
      onClose={() => setCard(null)} onAlbum={() => { setCard(null); router.push('/profile/badges' as never); }} />
  </View>;
}
