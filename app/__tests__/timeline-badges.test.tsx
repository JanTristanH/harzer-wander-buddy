import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Timeline from '@/app/profile/timeline/[userId]';
let mockTarget = 'self';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ userId: mockTarget }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: 'token' }),
  useIdTokenClaims: () => ({ sub: 'owner' }),
}));
jest.mock('@/lib/queries', () => ({
  useProfileOverviewQuery: () => ({ data: { name: 'Owner', stampings: [] } }),
  useUserProfileOverviewQuery: () => ({ data: { name: 'Other', stampings: [] } }),
}));
jest.mock('@/components/profile-view', () => ({
  ProfileErrorState: () => null,
  ProfileLoadingState: () => null,
}));
test('the timeline reached from the list hero links to the badge album even without visits', () => {
  mockTarget = 'self';
  render(<Timeline />);
  fireEvent.press(screen.getByText('Alle Abzeichen entdecken'));
  expect(mockPush).toHaveBeenCalledWith('/profile/badges');
});
test('a different user timeline does not offer the owners album action', () => {
  mockTarget = 'other';
  render(<Timeline />);
  expect(screen.queryByText('Alle Abzeichen entdecken')).toBeNull();
});
