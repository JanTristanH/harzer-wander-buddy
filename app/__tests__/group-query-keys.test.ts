import { QueryClient } from '@tanstack/react-query';

import {
  canonicalGroupSignature,
  canonicalGroupUserIds,
  getReusableQueryData,
  queryKeys,
} from '@/lib/queries';

describe('group-aware query keys', () => {
  it('normalizes, deduplicates, sorts, and always includes the current user', () => {
    expect(
      canonicalGroupUserIds(' self-id ', ['friend-b', ' friend-a ', 'self-id', 'friend-b'])
    ).toEqual(['friend-a', 'friend-b', 'self-id']);
    expect(
      canonicalGroupSignature('self-id', ['friend-b', 'friend-a'])
    ).toBe('friend-a,friend-b,self-id');
  });

  it('keeps the self-only signature stable for omitted, empty, and explicit self groups', () => {
    expect(queryKeys.mapData('self-id')).toEqual(queryKeys.mapData('self-id', []));
    expect(queryKeys.mapData('self-id')).toEqual(
      queryKeys.mapData('self-id', ['self-id', ' self-id '])
    );
    expect(queryKeys.stampsOverview('self-id')).toEqual(
      queryKeys.stampsOverview('self-id', ['self-id'])
    );
  });

  it('uses the same key for equivalent groups and separates different groups', () => {
    const first = queryKeys.stampDetail(
      'self-id',
      'stamp-id',
      ['friend-b', 'friend-a']
    );
    const equivalent = queryKeys.stampDetail(
      'self-id',
      'stamp-id',
      ['friend-a', 'friend-b', 'friend-a']
    );
    const different = queryKeys.stampDetail('self-id', 'stamp-id', ['friend-a']);

    expect(first).toEqual(equivalent);
    expect(first).not.toEqual(different);
  });

  it('includes the group signature in tour overview and detail keys', () => {
    expect(queryKeys.toursOverview('self-id', ['friend-id'])).toContain(
      'friend-id,self-id'
    );
    expect(queryKeys.tourDetail('self-id', 'tour-id', ['friend-id'])).toContain(
      'friend-id,self-id'
    );
  });

  it('does not reuse invalidated list data for a subsequent map refresh', async () => {
    const queryClient = new QueryClient();
    const preferredKey = queryKeys.stampsOverviewByFilter(
      'self-id',
      'validToday',
      ['friend-id']
    );
    const fallbackKey = queryKeys.stampsOverview('self-id', ['friend-id']);
    const preferredData = { source: 'preferred' };
    const fallbackData = { source: 'fallback' };

    queryClient.setQueryData(preferredKey, preferredData);
    queryClient.setQueryData(fallbackKey, fallbackData);

    expect(
      getReusableQueryData(queryClient, [preferredKey, fallbackKey])
    ).toBe(preferredData);

    await queryClient.invalidateQueries({
      queryKey: preferredKey,
      refetchType: 'none',
    });

    expect(
      getReusableQueryData(queryClient, [preferredKey, fallbackKey])
    ).toBeUndefined();

    queryClient.clear();
  });
});
