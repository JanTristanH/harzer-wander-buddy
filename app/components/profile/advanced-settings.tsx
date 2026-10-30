import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MAP_STYLE_OPTIONS,
  setMapStylePreference,
  useMapStylePreference,
  type MapStyle,
} from '@/lib/map-style-preferences';

export function AdvancedSettings() {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mapStyle = useMapStylePreference();

  async function selectStyle(style: MapStyle) {
    setSaving(true);
    setError('');
    try {
      await setMapStylePreference(style);
    } catch {
      setError('Der Kartenstil konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.heading}>
        <Text style={styles.title}>Erweiterte Einstellungen</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#3d4a3d" />
      </Pressable>
      {expanded ? (
        <View style={styles.content}>
          <Text style={styles.label}>Kartenstil</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Kartenstil" style={styles.options}>
            {MAP_STYLE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: mapStyle === option.key, disabled: saving }}
                disabled={saving}
                onPress={() => void selectStyle(option.key)}
                style={[styles.option, mapStyle === option.key && styles.selected]}>
                <Text style={[styles.optionLabel, mapStyle === option.key && styles.selectedLabel]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {saving ? <Text accessibilityLiveRegion="polite">Wird gespeichert…</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: '#d7cfbb' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, minHeight: 48 },
  title: { color: '#3d4a3d', fontSize: 17, fontWeight: '700', flex: 1 },
  content: { gap: 12, paddingBottom: 16 },
  label: { color: '#5f6e5f', fontSize: 13, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 24, borderWidth: 1, borderColor: '#d7cfbb', backgroundColor: '#f2ebde', paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  selected: { backgroundColor: '#2e6b4b', borderColor: '#2e6b4b' },
  optionLabel: { color: '#3d4a3d', fontSize: 13, fontWeight: '700' },
  selectedLabel: { color: '#f5f3ee' },
  error: { color: '#a12b25' },
});
