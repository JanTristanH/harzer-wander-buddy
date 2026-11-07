import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as NativeImage,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeButton, badgeStyles as s } from '@/components/badge-ui';
import type { UploadableImage } from '@/lib/image-upload';
import {
  photoCropLayout,
  profilePhotoCrop,
  type PhotoDimensions,
  type PhotoPosition,
} from '@/lib/profile-photo-crop';

export function ProfilePhotoEditor({
  image,
  onCancel,
  onApply,
}: {
  image: UploadableImage | null;
  onCancel: () => void;
  onApply: (image: UploadableImage) => void;
}) {
  const { width } = useWindowDimensions();
  const side = Math.min(360, width - 48);
  const [dimensions, setDimensions] = useState<PhotoDimensions | null>(null);
  const [position, setPosition] = useState<PhotoPosition>({ x: 0, y: 0, zoom: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(position);
  current.current = position;
  const origin = useRef({ x: 0, y: 0, zoom: 1, distance: 0 });
  useEffect(() => {
    setDimensions(null);
    setPosition({ x: 0, y: 0, zoom: 1 });
    setError('');
    let cancelled = false;
    if (image)
      NativeImage.getSize(
        image.uri,
        (width, height) => {
          if (!cancelled) setDimensions({ width, height });
        },
        () => {
          if (!cancelled) setError('Bild konnte nicht geladen werden.');
        }
      );
    return () => {
      cancelled = true;
    };
  }, [image]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !saving,
        onMoveShouldSetPanResponder: () => !saving,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          origin.current = {
            ...current.current,
            distance:
              touches.length > 1
                ? Math.hypot(
                    touches[0].pageX - touches[1].pageX,
                    touches[0].pageY - touches[1].pageY
                  )
                : 0,
          };
        },
        onPanResponderMove: (event, gesture) => {
          if (!dimensions) return;
          const touches = event.nativeEvent.touches;
          let next = {
            ...current.current,
            x: origin.current.x + gesture.dx,
            y: origin.current.y + gesture.dy,
          };
          if (touches.length > 1) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            if (!origin.current.distance) origin.current = { ...current.current, distance };
            next = {
              ...current.current,
              zoom: (origin.current.zoom * distance) / Math.max(1, origin.current.distance),
            };
          }
          const layout = photoCropLayout(dimensions, side, next);
          setPosition({ x: layout.x, y: layout.y, zoom: layout.zoom });
        },
      }),
    [dimensions, side, saving]
  );
  const layout = dimensions ? photoCropLayout(dimensions, side, position) : null;
  async function apply() {
    if (!image || !dimensions || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await manipulateAsync(
        image.uri,
        [{ crop: profilePhotoCrop(dimensions, side, position) }],
        { format: SaveFormat.JPEG, compress: 0.95 }
      );
      onApply({
        uri: result.uri,
        fileName: image.fileName.replace(/\.[^.]+$/, '') + '.jpg',
        mimeType: 'image/jpeg',
      });
    } catch {
      setError('Der Bildausschnitt konnte nicht übernommen werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      visible={!!image}
      animationType="fade"
      onRequestClose={() => {
        if (!saving) onCancel();
      }}
    >
      <SafeAreaView style={s.page}>
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            gap: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.heading}>Bildausschnitt bearbeiten</Text>
          <Text style={[s.text, { textAlign: 'center' }]}>
            Verschiebe das Bild und zoome, bis der Ausschnitt passt.
          </Text>
          <View
            testID="photo-crop-area"
            style={{
              width: side,
              height: side,
              overflow: 'hidden',
              backgroundColor: '#e8e7df',
              borderRadius: 12,
            }}
            {...responder.panHandlers}
          >
            {image && layout ? (
              <Image
                source={{ uri: image.uri }}
                contentFit="fill"
                style={{
                  position: 'absolute',
                  width: layout.width,
                  height: layout.height,
                  left: (side - layout.width) / 2 + layout.x,
                  top: (side - layout.height) / 2 + layout.y,
                }}
              />
            ) : null}
          </View>
          <View style={[s.row, { justifyContent: 'center' }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Weniger zoomen"
              disabled={saving}
              onPress={() => setPosition((p) => ({ ...p, zoom: Math.max(1, p.zoom - 0.25) }))}
              style={s.chip}
            >
              <Text style={s.text}>−</Text>
            </Pressable>
            <Text style={s.text}>{Math.round(position.zoom * 100)} %</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mehr zoomen"
              disabled={saving}
              onPress={() => setPosition((p) => ({ ...p, zoom: Math.min(4, p.zoom + 0.25) }))}
              style={s.chip}
            >
              <Text style={s.text}>+</Text>
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={s.text}>
              {error}
            </Text>
          ) : null}
          <BadgeButton disabled={saving || !dimensions} onPress={() => void apply()}>
            {saving ? 'Wird übernommen …' : 'Ausschnitt übernehmen'}
          </BadgeButton>
          <BadgeButton secondary disabled={saving} onPress={onCancel}>
            Abbrechen
          </BadgeButton>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
