import {
  fetchFriendsOverview,
  fetchStampDetail,
  fetchStampboxes,
  stampForGroup,
  type StampedUser,
} from '@/lib/api';

jest.mock('@/lib/config', () => ({
  appConfig: {
    backendUrl: 'https://example.test',
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
  } as unknown as Response;
}

describe('group API contracts', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts normalized unique friend IDs to stampForGroup', async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ value: 'ok' })
    );
    global.fetch = fetchMock as typeof fetch;

    await stampForGroup('access-token', {
      stampId: ' stamp-id ',
      friendIds: [' friend-b ', 'friend-a', 'friend-b', ''],
      includeCurrentUser: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/odata/v4/api/stampForGroup');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      sStampId: 'stamp-id',
      bStampForUser: true,
      sGroupUserIds: 'friend-b,friend-a',
    });
  });

  it('combines the stamp mode and synthetic group filter and keeps structured users', async () => {
    const stampedUser: StampedUser = {
      ID: 'friend-id',
      name: 'Freundin',
      picture: 'https://example.test/friend.png',
    };
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          value: [
            {
              ID: 'stamp-id',
              number: '1',
              name: 'Stempel',
              groupSize: 2,
              totalGroupStampings: 1,
              stampedUsers: [stampedUser],
              stampedUserIds: ['friend-id'],
            },
          ],
        })
    );
    global.fetch = fetchMock as typeof fetch;

    const stamps = await fetchStampboxes(
      'access-token',
      'open',
      ['self-id', ' friend-id ', 'self-id']
    );

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const filter = requestUrl.searchParams.get('$filter');
    const select = requestUrl.searchParams.get('$select');
    expect(filter).toContain('hasVisited eq false');
    expect(filter).toContain("groupFilterStampings ne 'self-id,friend-id'");
    expect(filter?.startsWith("groupFilterStampings ne 'self-id,friend-id'")).toBe(true);
    expect(select?.split(',')).toEqual(expect.arrayContaining(['groupSize', 'stampedUsers']));
    expect(stamps[0]).toMatchObject({
      groupSize: 2,
      stampedUsers: [stampedUser],
    });
  });

  it('preserves permission metadata for accepted friends only', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/MyFriends?')) {
        return jsonResponse({
          value: [
            {
              ID: 'accepted-user',
              name: 'Akzeptiert',
              FriendshipID: 'friendship-id',
              status: 'accepted',
              isAllowedToStampForMe: true,
              isAllowedToStampForFriend: false,
            },
            {
              ID: 'pending-user',
              name: 'Ausstehend',
              FriendshipID: 'pending-friendship-id',
              status: 'pending',
              isAllowedToStampForMe: false,
              isAllowedToStampForFriend: true,
            },
          ],
        });
      }
      if (url.includes('/PendingFriendshipRequests?')) {
        return jsonResponse({ value: [] });
      }
      if (url.endsWith('/getUsersProgress')) {
        return jsonResponse({
          value: JSON.stringify([
            {
              userId: 'accepted-user',
              visitedCount: 12,
              completionPercent: 5,
            },
          ]),
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const overview = await fetchFriendsOverview('access-token', 'self-id');

    expect(overview.friends).toEqual([
      {
        id: 'accepted-user',
        name: 'Akzeptiert',
        picture: undefined,
        friendshipId: 'friendship-id',
        isAllowedToStampForMe: true,
        isAllowedToStampForFriend: false,
        visitedCount: 12,
        completionPercent: 5,
      },
    ]);
    expect(overview.outgoingRequests).toHaveLength(1);
  });

  it('loads the detail stamp with group fields while keeping my visits self-scoped', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/Stampboxes')) {
        return jsonResponse({
          value: [
            {
              ID: 'stamp-id',
              number: '1',
              name: 'Stempel',
              hasVisited: true,
              groupSize: 2,
              totalGroupStampings: 2,
              stampedUserIds: ['self-id', 'friend-id'],
              stampedUsers: [
                { ID: 'self-id', name: 'Ich' },
                { ID: 'friend-id', name: 'Freund' },
              ],
              Stampings: [
                {
                  ID: 'my-visit',
                  stamp_ID: 'stamp-id',
                  createdBy: 'self-id',
                  visitedAt: '2026-07-30T10:00:00.000Z',
                },
              ],
            },
          ],
        });
      }

      if (
        url.pathname.endsWith('/StampNotes') ||
        url.pathname.endsWith('/NeighborsStampStamp') ||
        url.pathname.endsWith('/NeighborsStampParking') ||
        url.pathname.endsWith('/MyFriends')
      ) {
        return jsonResponse({ value: [] });
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const detail = await fetchStampDetail(
      'access-token',
      'stamp-id',
      'self-id',
      ['friend-id']
    );

    const stampboxRequest = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname.endsWith('/Stampboxes'));
    expect(stampboxRequest?.searchParams.get('$filter')).toBe(
      "groupFilterStampings ne 'self-id,friend-id' and ID eq stamp-id"
    );
    expect(stampboxRequest?.searchParams.get('$select')?.split(',')).toEqual(
      expect.arrayContaining(['groupSize', 'totalGroupStampings', 'stampedUsers'])
    );
    expect(detail.stamp).toMatchObject({
      hasVisited: true,
      groupSize: 2,
      totalGroupStampings: 2,
    });
    expect(detail.myVisits.map((visit) => visit.ID)).toEqual(['my-visit']);
  });
});
