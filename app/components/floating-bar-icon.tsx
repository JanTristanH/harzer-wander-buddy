import { FontAwesome5, Ionicons } from '@expo/vector-icons';

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
    active: 'navigate',
    inactive: 'navigate-outline',
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
  if (name === 'tours') {
    return (
      <FontAwesome5
        color={color}
        name="route"
        size={size}
        solid
        style={!focused ? { opacity: 0.72 } : undefined}
      />
    );
  }

  const iconName = focused ? ICONS[name].active : ICONS[name].inactive;

  return <Ionicons color={color} name={iconName} size={size} />;
}
