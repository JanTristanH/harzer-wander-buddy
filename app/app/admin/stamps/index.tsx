import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminGuard } from '@/components/admin-guard';
import { SkeletonBlock } from '@/components/skeleton';
import { StampListItem } from '@/components/stamp-list-item';
import { useAdminStampsOverviewQuery } from '@/lib/queries';

type AdminValidToFilter = 'validToday' | 'all';

function normalizeSearchValue(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLocaleLowerCase();
}

export default function AdminStampListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [validToFilter, setValidToFilter] = useState<AdminValidToFilter>('validToday');
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { data, error, isFetching, isPending, refetch } = useAdminStampsOverviewQuery(validToFilter);
  const normalizedQuery = normalizeSearchValue(query);

  const filteredStamps = useMemo(() => {
    const stamps = data?.stamps ?? [];

    if (!normalizedQuery) {
      return stamps;
    }

    return stamps.filter((stamp) => {
      const text = [stamp.number, stamp.name, stamp.description]
        .map((entry) => normalizeSearchValue(entry))
        .filter(Boolean)
        .join(' ');
      return text.includes(normalizedQuery);
    });
  }, [data?.stamps, normalizedQuery]);

  const showBlockingError = !data && error;

  return (
    <AdminGuard>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color="#1e2a1e" name="arrow-left" size={16} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Admin: Stempelstellen</Text>
              <Text style={styles.subtitle}>Neue Stempelstellen anlegen und bestehende pflegen.</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/admin/stamps/new' as never)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Feather color="#f5f3ee" name="plus" size={15} />
            <Text style={styles.primaryButtonLabel}>Neue Stempelstelle</Text>
          </Pressable>

          <View style={styles.searchWrap}>
            <Feather color="#6b7a6b" name="search" size={14} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Nach Nummer, Titel oder Beschreibung suchen"
              placeholderTextColor="#6b7a6b"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setValidToFilter('validToday')}
              style={({ pressed }) => [
                styles.filterChip,
                validToFilter === 'validToday' && styles.filterChipActive,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.filterChipLabel,
                  validToFilter === 'validToday' && styles.filterChipLabelActive,
                ]}>
                Gueltig heute
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setValidToFilter('all')}
              style={({ pressed }) => [
                styles.filterChip,
                validToFilter === 'all' && styles.filterChipActive,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.filterChipLabel,
                  validToFilter === 'all' && styles.filterChipLabelActive,
                ]}>
                Alle
              </Text>
            </Pressable>
          </View>

          {showBlockingError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Liste konnte nicht geladen werden</Text>
              <Text style={styles.errorBody}>{error.message}</Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={filteredStamps}
              keyExtractor={(item) => item.ID}
              refreshControl={
                <RefreshControl
                  onRefresh={() => {
                    void (async () => {
                      setIsPullRefreshing(true);
                      try {
                        await refetch();
                      } finally {
                        setIsPullRefreshing(false);
                      }
                    })();
                  }}
                  refreshing={isPullRefreshing}
                  tintColor="#2e6b4b"
                />
              }
              renderItem={({ index, item }) => (
                <StampListItem
                  index={index}
                  item={item}
                  metaLabel={
                    typeof item.latitude === 'number' && typeof item.longitude === 'number'
                      ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
                      : 'Keine Location'
                  }
                  onPress={() => router.push(`/admin/stamps/${item.ID}` as never)}
                />
              )}
              ListEmptyComponent={
                isPending ? (
                  <View style={styles.skeletonWrap}>
                    <SkeletonBlock height={100} radius={18} width="100%" />
                    <SkeletonBlock height={100} radius={18} width="100%" />
                    <SkeletonBlock height={100} radius={18} width="100%" />
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Keine Stempelstellen gefunden</Text>
                    <Text style={styles.emptyBody}>
                      {normalizedQuery
                        ? `Keine Treffer fuer "${query.trim()}".`
                        : validToFilter === 'validToday'
                          ? 'Heute ist kein Eintrag gueltig.'
                          : 'Lege die erste Stempelstelle an.'}
                    </Text>
                  </View>
                )
              }
            />
          )}

          {isFetching && !isPending ? <Text style={styles.refreshHint}>Aktualisiere im Hintergrund...</Text> : null}
        </View>
      </SafeAreaView>
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#f0e9dd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#1e2a1e',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  subtitle: {
    color: '#657464',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonLabel: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  searchWrap: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#e7e2d8',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#2e6b4b',
  },
  filterChipLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  filterChipLabelActive: {
    color: '#f5f3ee',
  },
  listContent: {
    paddingBottom: 180,
    gap: 10,
  },
  pressed: {
    opacity: 0.84,
  },
  refreshHint: {
    color: '#657464',
    fontSize: 12,
    lineHeight: 16,
  },
  errorCard: {
    borderRadius: 16,
    backgroundColor: '#f8ebe8',
    borderWidth: 1,
    borderColor: '#e3c8c2',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  errorTitle: {
    color: '#6d2f2a',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorBody: {
    color: '#8a4a42',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  emptyTitle: {
    color: '#1e2a1e',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  emptyBody: {
    color: '#657464',
    fontSize: 13,
    lineHeight: 18,
  },
  skeletonWrap: {
    gap: 10,
    marginTop: 6,
  },
});
