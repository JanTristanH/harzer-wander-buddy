import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { AuthGuard } from '@/components/auth-guard';
import { BadgeButton, BadgePage, badgeStyles as s } from '@/components/badge-ui';

export default function CustomizeProfileScreen() {
  const router = useRouter();
  return (
    <AuthGuard>
      <BadgePage title="Profil anpassen">
        <View style={s.card}>
          <Text style={s.heading}>Name & Profilbild</Text>
          <Text style={s.text}>So sehen dich deine Wanderfreunde.</Text>
          <BadgeButton onPress={() => router.push('/profile/edit')}>
            Name & Bild bearbeiten
          </BadgeButton>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Deine Auszeichnungen</Text>
          <Text style={s.text}>Wähle deinen Titel, Avatarrahmen und bis zu drei Abzeichen.</Text>
          <BadgeButton secondary onPress={() => router.push('/profile/badges/customize')}>
            Abzeichen, Titel & Rahmen auswählen
          </BadgeButton>
          <BadgeButton secondary onPress={() => router.push('/profile/badges')}>
            Alle Abzeichen entdecken
          </BadgeButton>
        </View>
      </BadgePage>
    </AuthGuard>
  );
}
