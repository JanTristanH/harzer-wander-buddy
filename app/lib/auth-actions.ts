import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';

const DEFAULT_SIGN_IN_BODY =
  'Diese Aktion ist nur mit einem Konto verfuegbar. Moechtest du dich anmelden?';

export function useRequireSignInAction() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (message = DEFAULT_SIGN_IN_BODY) => {
    if (isAuthenticated) {
      return true;
    }

    Alert.alert('Anmelden erforderlich', message, [
      {
        text: 'Abbrechen',
        style: 'cancel',
      },
      {
        text: 'Anmelden',
        onPress: () => router.push('/login' as never),
      },
    ]);

    return false;
  };
}
