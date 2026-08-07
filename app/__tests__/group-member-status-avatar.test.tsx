import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { GroupMemberStatusAvatar } from '@/components/group-member-status-avatar';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: null }),
}));

describe('GroupMemberStatusAvatar', () => {
  it('renders the profile image and visited state', () => {
    render(
      <GroupMemberStatusAvatar
        image="https://example.test/friend.jpg"
        index={0}
        name="Anna Adler"
        testID="friend-avatar"
        visited
      />
    );

    expect(screen.getByLabelText('Anna Adler: besucht')).toBeTruthy();
    expect(screen.getByTestId('friend-avatar-image').props.source).toMatchObject({
      uri: 'https://example.test/friend.jpg',
    });
  });

  it('keeps an initials fallback and open state when no image exists', () => {
    render(
      <GroupMemberStatusAvatar
        index={1}
        name="Ben Berg"
        testID="friend-avatar"
        visited={false}
      />
    );

    expect(screen.getByLabelText('Ben Berg: unbesucht')).toBeTruthy();
    expect(screen.getByTestId('friend-avatar-image')).toBeTruthy();
    expect(screen.getByText('BB')).toBeTruthy();
  });
});
