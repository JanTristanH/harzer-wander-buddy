import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';

const clamp = (value: number) => Math.max(1, Math.min(5, value));
/** Full photo, independent of the avatar crop. Pinch to zoom and drag to inspect. */
export function ProfileImageViewer({ uri, children }: { uri?: string; children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [visible, setVisible] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const current = useRef(transform);
  current.current = transform;
  const lastTap = useRef(0);
  const origin = useRef({ scale: 1, x: 0, y: 0, distance: 0 });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        origin.current = {
          ...current.current,
          distance:
            touches.length > 1
              ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
              : 0,
        };
      },
      onPanResponderRelease: (_, gesture) => {
        if (origin.current.distance > 0) {
          lastTap.current = 0;
          return;
        }
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) return;
        const now = Date.now();
        if (now - lastTap.current < 300) {
          setTransform((t) => ({ scale: t.scale > 1 ? 1 : 2, x: 0, y: 0 }));
          lastTap.current = 0;
        } else lastTap.current = now;
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        if (touches.length > 1) {
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          if (!origin.current.distance) origin.current = { ...current.current, distance };
          setTransform({
            ...current.current,
            scale: clamp((origin.current.scale * distance) / Math.max(1, origin.current.distance)),
          });
        } else if (current.current.scale > 1) {
          setTransform({
            ...current.current,
            x: origin.current.x + gesture.dx,
            y: origin.current.y + gesture.dy,
          });
        }
      },
    })
  ).current;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profilbild groß ansehen"
        disabled={!uri}
        onPress={() => {
          setTransform({ scale: 1, x: 0, y: 0 });
          setVisible(true);
        }}
      >
        {children}
      </Pressable>
      <Modal visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.page}>
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bild schließen"
              onPress={() => setVisible(false)}
              style={styles.button}
            >
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>
          <View testID="profile-image-gestures" style={styles.imageArea} {...responder.panHandlers}>
            {uri ? (
              <Image
                testID="full-profile-image"
                source={buildAuthenticatedImageSource(uri, accessToken)}
                contentFit="contain"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    transform: [
                      { translateX: transform.x },
                      { translateY: transform.y },
                      { scale: transform.scale },
                    ],
                  },
                ]}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 8 },
  button: { padding: 12, minHeight: 44, backgroundColor: '#333', borderRadius: 12 },
  imageArea: { flex: 1, overflow: 'hidden' },
});
