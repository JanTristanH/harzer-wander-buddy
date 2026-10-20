import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { TourGpxExport } from '../../../app/components/tour-gpx-export';
createRoot(document.getElementById('root')!).render(<View style={{ padding: 24, gap: 24, backgroundColor: '#faf9f4', flex: 1 }}>
  <Text style={{ fontSize: 14, color: '#596657' }}>MEINE TOUR</Text>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <Text style={{ fontSize: 22, fontWeight: '700', color: '#1e2a1e' }}>Bäche und Berge</Text>
    <TourGpxExport name="Bäche und Berge" path={[{ rank: 1, tour_ID: 'tour', travelTime_ID: 'leg', travelTime: {
      ID: 'leg', positionString: '10.6;51.8;0;10.61;51.81;0', travelMode: 'pedestrian',
      durationSeconds: 1800, distanceMeters: 2100, elevationGain: 80, elevationLoss: 10,
    } }]} />
  </View>
  <Text style={{ fontSize: 15, lineHeight: 23 }}>Exportiere den gespeicherten Wegverlauf als GPX-Datei für dein GPS-Gerät oder deine Wander-App.</Text>
  <Text style={{ fontSize: 12, color: '#596657', marginTop: 30 }}>Komponentenvorschau mit Beispieltour</Text>
</View>);
