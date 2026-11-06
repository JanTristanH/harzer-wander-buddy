import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FriendsList } from '@/components/friends-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClearableSearchInput } from '@/components/clearable-search-input';
import { AppColors, Fonts } from '@/constants/theme';
import { type useFriendSearch } from '@/lib/use-friend-search';

export function FriendSearchModal({
  search,
  hint,
}: {
  search: ReturnType<typeof useFriendSearch>;
  hint?: string;
}) {
  const {
    isSearchModalVisible,
    handleSearchModalShow,
    closeSearchModal,
    searchInputRef,
    setSearchQuery,
    searchQuery,
    isSearchLoading,
    searchError,
    searchResults,
    searchListItems,
  } = search;
  return (
    <Modal
      animationType="fade"
      onShow={handleSearchModalShow}
      transparent
      visible={isSearchModalVisible}
      onRequestClose={closeSearchModal}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSearchModal} />
        <SafeAreaView style={styles.modalSafeArea} pointerEvents="box-none">
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Freunde finden</Text>
              <Pressable
                accessibilityLabel="Suche schliessen"
                onPress={closeSearchModal}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
              >
                <Feather color={AppColors.text} name="x" size={16} />
              </Pressable>
            </View>

            <View style={styles.searchInputShell}>
              <View style={styles.searchInputIconWrap}>
                <Feather color={AppColors.textMuted} name="search" size={14} />
              </View>
              <ClearableSearchInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                ref={searchInputRef}
                onChangeText={setSearchQuery}
                placeholder="Name oder Nutzername suchen"
                placeholderTextColor={AppColors.textMuted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <ScrollView
              style={styles.searchResultsScroll}
              contentContainerStyle={styles.searchResultsColumn}
              keyboardShouldPersistTaps="handled"
            >
              {isSearchLoading ? (
                <View style={styles.searchStatusWrap}>
                  <ActivityIndicator color={AppColors.primary} size="small" />
                </View>
              ) : null}

              {!isSearchLoading && searchError ? (
                <Text style={styles.searchStatusText}>{searchError}</Text>
              ) : null}

              {!isSearchLoading && !searchError && searchQuery.trim().length < 2 ? (
                <Text style={styles.searchStatusText}>
                  Gib mindestens zwei Zeichen ein, um nach Freunden zu suchen.
                </Text>
              ) : null}

              {!isSearchLoading &&
              !searchError &&
              searchQuery.trim().length >= 2 &&
              searchResults.length === 0 ? (
                <Text style={styles.searchStatusText}>Keine passenden Nutzer gefunden.</Text>
              ) : null}

              {!isSearchLoading && !searchError && searchResults.length > 0 ? (
                <FriendsList items={searchListItems} />
              ) : null}
            </ScrollView>
            {hint ? <Text style={styles.searchStatusText}>{hint}</Text> : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  modalSafeArea: { flex: 1, paddingVertical: 16 },
  searchResultsScroll: { flexGrow: 0, flexShrink: 1 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(46,58,46,0.35)',
  },
  modalCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 22,
    marginHorizontal: 20,
    maxHeight: '100%',
    flexShrink: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  searchInputShell: {
    alignItems: 'center',
    backgroundColor: '#F6F2EA',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInputIconWrap: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  searchInput: {
    color: AppColors.text,
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    padding: 0,
  },
  searchResultsColumn: {
    gap: 10,
    minHeight: 120,
  },
  searchStatusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  searchStatusText: {
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.88 },
});
