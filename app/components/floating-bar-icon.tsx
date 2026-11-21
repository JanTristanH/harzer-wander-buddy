import { Ionicons } from '@expo/vector-icons';

type FloatingBarIconName = 'index' | 'map' | 'tours' | 'friends' | 'profile';

const ICONS: Record<FloatingBarIconName, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: {
    active: 'list',
    inactive: 'list-outline',
  },
  map: {
    active: 'map',
    inactive: 'map-outline',
  },
  tours: {
    active: 'trail-sign',
    inactive: 'trail-sign-outline',
  },
  friends: {
    active: 'people',
    inactive: 'people-outline',
  },
  profile: {
    active: 'person',
    inactive: 'person-outline',
  },
};

export function FloatingBarIcon({
  name,
  focused,
  color,
  size = 26,
}: {
  name: FloatingBarIconName;
  focused: boolean;
  color: string;
  size?: number;
}) {
  const iconName = focused ? ICONS[name].active : ICONS[name].inactive;

  return <Ionicons color={color} name={iconName} size={size} />;
}
