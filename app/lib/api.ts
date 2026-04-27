import { normalizeRoleTokens } from '@/lib/admin-access';
import { appConfig } from '@/lib/config';
import { prepareProfileImageForUpload, type UploadableImage } from '@/lib/image-upload';
import buildODataQuery, { type QueryOptions } from 'odata-query';

export type Stampbox = {
  ID: string;
  number: string;
  orderBy?: string;
  name: string;
  description?: string;
  heroImageUrl?: string;
  image?: string;
  imageCaption?: string;
  validFrom?: string;
  validTo?: string;
  latitude?: number;
  longitude?: number;
  hasVisited?: boolean;
  totalGroupStampings?: number;
  stampedUsers?: string | string[];
  stampedUserIds?: string | string[];
};

export type AdminStampboxMutationInput = {
  name: string;
  description?: string;
  heroImageUrl?: string;
  imageCaption?: string;
  validFrom?: string;
  validTo?: string;
  latitude: number;
  longitude: number;
  number?: string;
  orderBy?: string;
};

export type AdminParkingSpotMutationInput = {
  name: string;
  description?: string;
  image?: string;
  latitude: number;
  longitude: number;
};

export type StampboxFetchMode =
  | 'default'
  | 'validToday'
  | 'all'
  | 'visited'
  | 'open'
  | 'relocated';

type ODataCollection<T> = {
  value?: T[];
};

type LegacyQueryEntry = [string, string | number | boolean | undefined];
type ODataQuery = Partial<QueryOptions<unknown>>;
type QueryInput = LegacyQueryEntry[] | ODataQuery;

type NeighborStampRow = {
  ID: string;
  NeighborsID: string;
  NeighborsNumber?: string;
  distanceKm?: number;
  neighborStamp?: Pick<Stampbox, 'ID' | 'number' | 'name' | 'heroImageUrl' | 'image' | 'imageCaption'>;
};

type NeighborParkingRow = {
  ID: string;
  NeighborsID: string;
  distanceKm?: number;
  neighborParking?: Pick<ParkingSpot, 'ID' | 'name'>;
};

type TravelTimeRow = {
  ID: string;
  fromPoi?: string;
  toPoi?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  travelMode?: string;
  elevationGain?: number;
  elevationLoss?: number;
};

type TourPathRow = {
  tour_ID?: string;
  travelTime_ID?: string;
  rank?: number | string;
  travelTime?: TravelTimeRow;
};

type TourRow = {
  ID: string;
  name?: string;
  distance?: number | string;
  duration?: number | string;
  stampCount?: number | string;
  newStampCountForUser?: number | string;
  idListTravelTimes?: string;
  totalElevationGain?: number | string;
  totalElevationLoss?: number | string;
  createdBy?: string;
  creator?: {
    ID?: string;
    name?: string;
    picture?: string;
  };
  createdAt?: string;
  groupFilterStampings?: string;
  AverageGroupStampings?: number | string;
};

type PointOfInterestRow = {
  ID: string;
  name?: string;
  poiType?: string;
  stampNumber?: string;
  orderBy?: string;
  latitude?: number | string;
  longitude?: number | string;
  heroImageUrl?: string;
  imageCaption?: string;
  description?: string;
};

export type ParkingSpot = {
  ID: string;
  name?: string;
  description?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
};

type Stamping = {
  ID: string;
  visitedAt?: string;
  createdAt?: string;
  createdBy?: string;
  stamp_ID?: string;
  stamp?: Pick<Stampbox, 'ID' | 'number' | 'name'>;
};

export type VisitStamping = Stamping;

export type StampNote = {
  ID: string;
  stamp_ID?: string;
  note: string;
  createdBy?: string;
  createdAt?: string;
  modifiedAt?: string;
};

type MyFriend = {
  ID: string;
  name?: string;
  picture?: string;
  FriendshipID?: string;
  status?: 'pending' | 'accepted';
  isAllowedToStampForMe?: boolean;
  isAllowedToStampForFriend?: boolean;
};

type User = {
  ID: string;
  name?: string;
  picture?: string;
  isFriend?: boolean;
  roles?: string | string[];
  friends?: User[];
  Friends?: User[];
};

type Attachment = {
  ID: string;
  url?: string;
  filename?: string;
  mimeType?: string;
};

type StampFriendVisitRow = {
  friendId: string;
  name?: string;
  picture?: string;
  stampingId?: string;
  visitedAt?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
};

type UserProgressRow = {
  id?: string;
  userId?: string;
  ID?: string;
  visitedCount?: number | string | null;
  completionPercent?: number | string | null;
  stampCount?: number | string | null;
  totalGroupStampings?: number | string | null;
};

type PendingFriendshipRequest = {
  ID: string;
  fromUser_ID?: string;
  toUser_ID?: string;
  outgoingFriendship_ID?: string;
  fromUser?: User;
  toUser?: User;
};

type FriendshipRecord = {
  ID: string;
  fromUser_ID?: string;
  toUser_ID?: string;
  toUser?: User;
};

export type ProfileOverviewData = {
  name: string;
  picture?: string;
  visitedCount: number;
  totalCount: number;
  openCount: number;
  completionPercent: number;
  friendCount: number;
  collectorSinceYear: number | null;
  latestVisits: ProfileVisitEntry[];
  stampings: ProfileVisitEntry[];
  featuredFriend: {
    id: string;
    name: string;
    picture?: string;
    visitedCount: number | null;
    completionPercent: number | null;
  } | null;
  friends: {
    id: string;
    name: string;
    picture?: string;
    visitedCount: number;
    completionPercent: number;
  }[];
  stamps: Stampbox[];
  achievements: {
    id: string;
    label: string;
    value: string;
  }[];
};

export type ProfileVisitEntry = {
  id: string;
  stampId: string;
  stampNumber?: string;
  stampName: string;
  visitedAt?: string;
  heroImageUrl?: string;
};

export type LatestVisitedStamp = {
  stampId: string;
  stampNumber?: string;
  stampName: string;
  visitedAt?: string;
};

export type FriendsOverviewData = {
  currentUserId: string;
  friendCount: number;
  incomingRequestCount: number;
  outgoingRequestCount: number;
  friends: {
    id: string;
    name: string;
    picture?: string;
    visitedCount: number;
    completionPercent: number;
  }[];
  incomingRequests: {
    id: string;
    pendingRequestId: string;
    userId: string;
    name: string;
    picture?: string;
  }[];
  outgoingRequests: {
    id: string;
    friendshipId: string;
    userId: string;
    name: string;
    picture?: string;
  }[];
};

export type SearchUserResult = {
  id: string;
  name: string;
  picture?: string;
  isFriend: boolean;
  visitedCount: number;
  completionPercent: number;
};

export type CurrentUserProfileData = {
  id: string;
  name: string;
  picture?: string;
  roles?: string[];
};

export type FriendshipRelationshipState =
  | 'self'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request'
  | 'not_connected';

export type UserProfileOverviewData = {
  userId: string;
  name: string;
  picture?: string;
  relationship: FriendshipRelationshipState;
  friendshipId: string | null;
  pendingRequestId: string | null;
  isAllowedToStampForMe: boolean;
  visitedCount: number;
  completionPercent: number;
  sharedVisitedCount: number;
  collectorSinceYear: number | null;
  latestVisits: ProfileVisitEntry[];
  stampings: ProfileVisitEntry[];
  friends: {
    id: string;
    name: string;
    picture?: string;
    visitedCount: number;
    completionPercent: number;
  }[];
  achievements: {
    id: string;
    label: string;
    value: string;
  }[];
  stampBuckets: {
    shared: number;
    friendOnly: number;
    meOnly: number;
    neither: number;
  };
  stampComparisons: {
    stamp: Stampbox;
    meVisited: boolean;
    userVisited: boolean;
  }[];
};

export type StampDetailData = {
  stamp: Stampbox;
  nearbyStamps: {
    ID: string;
    number?: string;
    name: string;
    heroImageUrl?: string;
    imageCaption?: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    elevationGainMeters: number | null;
    elevationLossMeters: number | null;
  }[];
  nearbyParking: {
    ID: string;
    name: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    elevationGainMeters: number | null;
    elevationLossMeters: number | null;
  }[];
  friendVisits: {
    id: string;
    name: string;
    picture?: string;
    createdAt?: string;
  }[];
  myVisits: VisitStamping[];
  myNote: StampNote | null;
};

export type ParkingDetailData = {
  parking: ParkingSpot;
  nearbyStamps: {
    ID: string;
    number?: string;
    name: string;
    heroImageUrl?: string;
    imageCaption?: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    elevationGainMeters: number | null;
    elevationLossMeters: number | null;
  }[];
  nearbyParking: {
    ID: string;
    name: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    elevationGainMeters: number | null;
    elevationLossMeters: number | null;
  }[];
};

export type MapStamp = Stampbox & {
  kind: 'visited-stamp' | 'open-stamp';
  visitedAt?: string;
};

export type MapParkingSpot = ParkingSpot & {
  kind: 'parking';
};

export type MapData = {
  stamps: MapStamp[];
  parkingSpots: MapParkingSpot[];
};

export type Tour = {
  ID: string;
  name: string;
  distance: number | null;
  duration: number | null;
  stampCount: number | null;
  newStampCountForUser: number | null;
  idListTravelTimes: string;
  totalElevationGain: number | null;
  totalElevationLoss: number | null;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  groupFilterStampings?: string;
  averageGroupStampings: number | null;
};

export type TourPathEntry = {
  travelTime_ID: string;
  tour_ID: string;
  rank: number;
  travelTime?: {
    ID: string;
    fromPoi?: string;
    toPoi?: string;
    durationSeconds: number | null;
    distanceMeters: number | null;
    travelMode?: string;
    elevationGain: number | null;
    elevationLoss: number | null;
  };
};

export type RouteToStampFromPositionData = {
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
};

export type TourDetailResponse = {
  stampCount: number | null;
  newStampCountForUser: number | null;
  distance: number | null;
  duration: number | null;
  id: string;
  groupSize: number | null;
  averageGroupStampings: number | null;
  path: TourPathEntry[];
};

export type TourUpdateResponse = {
  ID: string;
  distance: number | null;
  duration: number | null;
  stampCount: number | null;
  newStampCountForUser: number | null;
  idListTravelTimes: string;
  totalElevationGain: number | null;
  totalElevationLoss: number | null;
  path: TourPathEntry[];
};

export type HikingRouteResult = {
  id: string;
  stampCount: number | null;
  distance: number | null;
  duration: number | null;
  path: TourPathEntry[];
};

export type HikingRouteCalculationResponse = {
  results: HikingRouteResult[];
};

export type PointOfInterest = {
  ID: string;
  name: string;
  poiType: string;
  stampNumber?: string;
  orderBy?: string;
  latitude?: number;
  longitude?: number;
  heroImageUrl?: string;
  imageCaption?: string;
  description?: string;
};

export type RouteMetrics = {
  distanceKm: number | null;
  durationMinutes: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
};

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  provider: 'google';
};

function buildStringEqualsFilter(field: string, value: string) {
  return `${field} eq '${escapeODataString(value)}'`;
}

function buildStringNotEqualsFilter(field: string, value: string) {
  return `${field} ne '${escapeODataString(value)}'`;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function buildLegacyQuery(query: LegacyQueryEntry[]) {
  const parts = query
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function buildQuery(query?: QueryInput) {
  if (!query) {
    return '';
  }

  if (Array.isArray(query)) {
    return buildLegacyQuery(query);
  }

  return buildODataQuery(query);
}

function buildUrl(path: string, query?: QueryInput) {
  return `${normalizeBaseUrl(appConfig.backendUrl)}/odata/v4/api/${path}${buildQuery(query)}`;
}

function buildV2Url(path: string) {
  return `${normalizeBaseUrl(appConfig.backendUrl)}/odata/v2/api/${path}`;
}

function buildStringKeyPath(entitySet: string, id: string) {
  return `${entitySet}('${escapeODataString(id)}')`;
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

export class HttpStatusError extends Error {
  status: number;
  body: string;

  constructor(status: number, message: string, body = '') {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
    this.body = body;
  }
}

function parsePotentialJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function unwrapODataEnvelope(payload: unknown, functionName?: string): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    const parsed = parsePotentialJson(payload);
    if (parsed === payload) {
      return payload;
    }

    return unwrapODataEnvelope(parsed, functionName);
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;

  if (functionName && functionName in record) {
    return unwrapODataEnvelope(record[functionName], functionName);
  }

  if ('oData' in record) {
    return unwrapODataEnvelope(record.oData, functionName);
  }

  if ('d' in record) {
    return unwrapODataEnvelope(record.d, functionName);
  }

  const keys = Object.keys(record);
  if (keys.length === 1 && keys[0] === 'value') {
    return unwrapODataEnvelope(record.value, functionName);
  }

  return payload;
}

function parseODataFunctionResult<T>(payload: unknown, functionName: string): T {
  const unwrapped = unwrapODataEnvelope(payload, functionName);

  if (typeof unwrapped === 'string') {
    const parsed = parsePotentialJson(unwrapped);
    return (parsed as T) ?? (unwrapped as T);
  }

  return unwrapped as T;
}

function unwrapNumericODataResult(payload: unknown) {
  const direct = toRoundedNumberOrNull(payload);
  if (direct !== null) {
    return direct;
  }

  if (payload && typeof payload === 'object' && 'value' in payload) {
    return toRoundedNumberOrNull((payload as { value?: unknown }).value);
  }

  return null;
}

async function readErrorBody(response: Response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function fetchOData<T>(accessToken: string, url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    const error = new Error('Unauthorized');
    error.name = 'UnauthorizedError';
    throw error;
  }

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new HttpStatusError(
      response.status,
      errorBody || `Request failed with status ${response.status}`,
      errorBody
    );
  }

  return (await response.json()) as T;
}

async function mutateOData<T>(
  accessToken: string,
  url: string,
  init: RequestInit & { body?: string }
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    const error = new Error('Unauthorized');
    error.name = 'UnauthorizedError';
    throw error;
  }

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new HttpStatusError(
      response.status,
      errorBody || `Request failed with status ${response.status}`,
      errorBody
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function parseActionStringResult(payload: unknown) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    typeof (payload as { value?: unknown }).value === 'string'
  ) {
    return (payload as { value: string }).value;
  }

  return '';
}

async function fetchCollection<T>(
  accessToken: string,
  entitySet: string,
  query?: QueryInput
) {
  const payload = await fetchOData<ODataCollection<T>>(accessToken, buildUrl(entitySet, query));
  return payload.value ?? [];
}

async function fetchEntityById<T>(
  accessToken: string,
  entitySet: string,
  id: string,
  query?: LegacyQueryEntry[]
) {
  const fallbacks = [`ID eq ${id}`];

  for (const filter of fallbacks) {
    try {
      const rows = await fetchCollection<T>(accessToken, entitySet, [
        ...(query ?? []),
        ['$filter', filter],
        ['$top', 1],
      ]);

      if (rows.length > 0) {
        return rows[0];
      }
    } catch {
      continue;
    }
  }

  throw new Error(`${entitySet} ${id} not found`);
}

async function fetchStringEntityById<T>(
  accessToken: string,
  entitySet: string,
  field: string,
  value: string,
  query?: LegacyQueryEntry[]
) {
  const rows = await fetchCollection<T>(accessToken, entitySet, [
    ...(query ?? []),
    ['$filter', `${field} eq '${escapeODataString(value)}'`],
    ['$top', 1],
  ]);

  if (rows.length > 0) {
    return rows[0];
  }

  throw new Error(`${entitySet} ${value} not found`);
}

async function fetchCurrentUserRecord(accessToken: string) {
  const payload = await fetchOData<unknown>(
    accessToken,
    buildUrl('getCurrentUser()', {
      select: ['ID', 'name', 'picture', 'isFriend', 'roles'],
    })
  );

  const unwrapped = unwrapODataEnvelope(payload, 'getCurrentUser');
  const rootRecord =
    unwrapped && typeof unwrapped === 'object'
      ? (unwrapped as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const nestedRecord =
    rootRecord.d && typeof rootRecord.d === 'object'
      ? (rootRecord.d as Record<string, unknown>)
      : rootRecord;

  const id = safeTrim(nestedRecord.ID) || safeTrim(nestedRecord.id) || safeTrim(nestedRecord.sub);
  if (!id) {
    throw new Error('Current user record missing ID');
  }

  const rawRoles = nestedRecord.roles ?? nestedRecord._roles;

  return {
    ID: id,
    name: safeTrim(nestedRecord.name) || safeTrim(nestedRecord.nickname) || undefined,
    picture: safeTrim(nestedRecord.picture) || undefined,
    isFriend: typeof nestedRecord.isFriend === 'boolean' ? nestedRecord.isFriend : undefined,
    roles:
      Array.isArray(rawRoles) || typeof rawRoles === 'string'
        ? (rawRoles as string | string[])
        : undefined,
  } satisfies User;
}

function normalizeIdList(ids: string[]) {
  return [...new Set(ids.map((id) => safeTrim(id)).filter(Boolean))];
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toRoundedNumberOrNull(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function normalizeTravelTime(value?: TravelTimeRow) {
  if (!value?.ID) {
    return undefined;
  }

  return {
    ID: value.ID,
    fromPoi: safeTrim(value.fromPoi) || undefined,
    toPoi: safeTrim(value.toPoi) || undefined,
    durationSeconds: toRoundedNumberOrNull(value.durationSeconds),
    distanceMeters: toRoundedNumberOrNull(value.distanceMeters),
    travelMode: safeTrim(value.travelMode) || undefined,
    elevationGain: toFiniteNumber(value.elevationGain),
    elevationLoss: toFiniteNumber(value.elevationLoss),
  } satisfies TourPathEntry['travelTime'];
}

function normalizeTourPathEntry(value: TourPathRow) {
  return {
    travelTime_ID: safeTrim(value.travelTime_ID),
    tour_ID: safeTrim(value.tour_ID),
    rank: toRoundedNumberOrNull(value.rank) ?? 0,
    travelTime: normalizeTravelTime(value.travelTime),
  } satisfies TourPathEntry;
}

function isDriveTravelMode(travelMode?: string) {
  const normalizedMode = safeNormalizedText(travelMode);
  if (!normalizedMode) {
    return false;
  }

  return (
    normalizedMode.includes('drive') ||
    normalizedMode.includes('car') ||
    normalizedMode.includes('motor') ||
    normalizedMode.includes('vehicle') ||
    normalizedMode.includes('auto')
  );
}

function aggregateTourMetricsFromPath(path: TourPathEntry[]) {
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let hasDistanceData = false;
  let hasDurationData = false;

  for (const entry of path) {
    const travelTime = entry.travelTime;
    if (!travelTime) {
      continue;
    }

    if (typeof travelTime.distanceMeters === 'number' && Number.isFinite(travelTime.distanceMeters)) {
      hasDistanceData = true;
      if (!isDriveTravelMode(travelTime.travelMode)) {
        totalDistanceMeters += travelTime.distanceMeters;
      }
    }

    if (typeof travelTime.durationSeconds === 'number' && Number.isFinite(travelTime.durationSeconds)) {
      hasDurationData = true;
      totalDurationSeconds += travelTime.durationSeconds;
    }
  }

  return {
    distance: hasDistanceData ? Math.max(0, Math.round(totalDistanceMeters)) : null,
    duration: hasDurationData ? Math.max(0, Math.round(totalDurationSeconds)) : null,
  };
}

function normalizeTourRow(value: TourRow) {
  return {
    ID: value.ID,
    name: safeTrim(value.name) || 'Unbenannte Tour',
    distance: toFiniteNumber(value.distance),
    duration: toFiniteNumber(value.duration),
    stampCount: toRoundedNumberOrNull(value.stampCount),
    newStampCountForUser: toRoundedNumberOrNull(value.newStampCountForUser),
    idListTravelTimes: safeTrim(value.idListTravelTimes),
    totalElevationGain: toFiniteNumber(value.totalElevationGain),
    totalElevationLoss: toFiniteNumber(value.totalElevationLoss),
    createdBy: safeTrim(value.createdBy) || undefined,
    createdByName: safeTrim(value.creator?.name) || undefined,
    createdAt: safeTrim(value.createdAt) || undefined,
    groupFilterStampings: safeTrim(value.groupFilterStampings) || undefined,
    averageGroupStampings: toRoundedNumberOrNull(value.AverageGroupStampings),
  } satisfies Tour;
}

function normalizePointOfInterestRow(value: PointOfInterestRow) {
  return {
    ID: value.ID,
    name: safeTrim(value.name) || value.ID,
    poiType: safeTrim(value.poiType) || 'unknown',
    stampNumber: safeTrim(value.stampNumber) || undefined,
    orderBy: safeTrim(value.orderBy) || undefined,
    latitude: toFiniteNumber(value.latitude) ?? undefined,
    longitude: toFiniteNumber(value.longitude) ?? undefined,
    heroImageUrl: safeTrim(value.heroImageUrl) || undefined,
    imageCaption: safeTrim(value.imageCaption) || undefined,
    description: safeTrim(value.description) || undefined,
  } satisfies PointOfInterest;
}

function normalizePlaceSearchResultRow(value: unknown): PlaceSearchResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const placeId = safeTrim(row.placeId);
  const name = safeTrim(row.name);
  const formattedAddress = safeTrim(row.formattedAddress);
  const latitude = toFiniteNumber(row.latitude);
  const longitude = toFiniteNumber(row.longitude);

  if (!placeId || !name || latitude === null || longitude === null) {
    return null;
  }

  return {
    placeId,
    name,
    formattedAddress,
    latitude,
    longitude,
    provider: 'google',
  } satisfies PlaceSearchResult;
}

function computeCompletionPercent(visitedCount: number, totalCount: number) {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((visitedCount / totalCount) * 100)));
}

function normalizeOptionalTotalCount(totalCount?: number | null) {
  return typeof totalCount === 'number' && Number.isFinite(totalCount) && totalCount > 0 ? totalCount : null;
}

async function fetchTotalStampCount(accessToken: string) {
  const rows = await fetchCollection<Stampbox>(accessToken, 'Stampboxes', {
    select: ['ID'],
    top: 500,
  });
  return rows.length;
}

function parseActionArrayResult<T>(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    Array.isArray((payload as { value?: unknown }).value)
  ) {
    return (payload as { value: T[] }).value;
  }

  const rawValue = parseActionStringResult(payload);
  if (!rawValue) {
    return [] as T[];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [] as T[];
  }
}

async function fetchUsersProgressFromAction(
  accessToken: string,
  userIds: string[],
  totalCount?: number | null
) {
  const uniqueUserIds = normalizeIdList(userIds);
  if (uniqueUserIds.length === 0) {
    return new Map<string, { visitedCount: number; completionPercent: number }>();
  }

  const actionResponse = await mutateOData<unknown>(accessToken, buildUrl('getUsersProgress'), {
    method: 'POST',
    body: JSON.stringify({
      sGroupUserIds: uniqueUserIds.join(','),
    }),
  });
  const rows = parseActionArrayResult<UserProgressRow>(actionResponse);
  const progressByUserId = new Map<string, { visitedCount: number; completionPercent: number }>();
  const normalizedTotalCount = normalizeOptionalTotalCount(totalCount);

  for (const row of rows) {
    const userId = safeTrim(row.userId || row.id || row.ID);
    if (!userId) {
      continue;
    }

    const visitedCountRaw =
      toFiniteNumber(row.visitedCount) ??
      toFiniteNumber(row.stampCount) ??
      toFiniteNumber(row.totalGroupStampings) ??
      0;
    const visitedCount = Math.max(0, Math.round(visitedCountRaw));
    const explicitCompletion = toFiniteNumber(row.completionPercent);

    progressByUserId.set(userId, {
      visitedCount,
      completionPercent:
        explicitCompletion !== null
          ? Math.max(0, Math.min(100, Math.round(explicitCompletion)))
          : normalizedTotalCount !== null
            ? computeCompletionPercent(visitedCount, normalizedTotalCount)
            : 0,
    });
  }

  return progressByUserId;
}

async function fetchSingleUserProgress(accessToken: string, userId: string, totalCount: number) {
  const stampboxes = await fetchComparisonStampboxes(accessToken, [userId]);
  const visitedCount = stampboxes.filter((stamp) => Number(stamp.totalGroupStampings || 0) > 0).length;

  return {
    visitedCount,
    completionPercent: computeCompletionPercent(visitedCount, totalCount),
  };
}

async function fetchUsersProgress(
  accessToken: string,
  userIds: string[],
  totalCount?: number | null
) {
  const uniqueUserIds = normalizeIdList(userIds);
  if (uniqueUserIds.length === 0) {
    return new Map<string, { visitedCount: number; completionPercent: number }>();
  }

  const progressByUserId = new Map<string, { visitedCount: number; completionPercent: number }>();
  let effectiveTotalCount = normalizeOptionalTotalCount(totalCount);

  try {
    const actionProgress = await fetchUsersProgressFromAction(accessToken, uniqueUserIds, effectiveTotalCount);
    for (const [userId, progress] of actionProgress.entries()) {
      progressByUserId.set(userId, progress);
    }
  } catch {
    // Backend action is optional; fall back to existing per-user reads.
  }

  const unresolvedUserIds = uniqueUserIds.filter((userId) => !progressByUserId.has(userId));
  if (unresolvedUserIds.length > 0) {
    if (effectiveTotalCount === null) {
      effectiveTotalCount = await fetchTotalStampCount(accessToken);
    }

    const fallbackEntries = await Promise.all(
      unresolvedUserIds.map(async (userId) => [
        userId,
        await fetchSingleUserProgress(accessToken, userId, effectiveTotalCount || 0),
      ] as const)
    );

    for (const [userId, progress] of fallbackEntries) {
      progressByUserId.set(userId, progress);
    }
  }

  return progressByUserId;
}

async function buildFriendProgress(
  accessToken: string,
  friends: {
    ID: string;
    name?: string;
    picture?: string;
  }[],
  totalCount?: number
) {
  const progressByUserId = await fetchUsersProgress(
    accessToken,
    friends.map((friend) => friend.ID),
    totalCount
  );
  const friendProgress = friends.map((friend) => ({
    id: friend.ID,
    name: friend.name || 'Freund',
    picture: friend.picture,
    ...(progressByUserId.get(friend.ID) ?? { visitedCount: 0, completionPercent: 0 }),
  }));

  return friendProgress.sort(
    (left, right) => right.visitedCount - left.visitedCount || left.name.localeCompare(right.name)
  );
}

async function attachUserProgress<T extends { id: string }>(
  accessToken: string,
  users: T[]
) {
  if (users.length === 0) {
    return [] as (T & { visitedCount: number; completionPercent: number })[];
  }

  const progressByUserId = await fetchUsersProgress(
    accessToken,
    users.map((user) => user.id)
  );

  return users.map((user) => ({
    ...user,
    ...(progressByUserId.get(user.id) ?? { visitedCount: 0, completionPercent: 0 }),
  }));
}

async function fetchUserFriends(accessToken: string, userId: string) {
  const rows = await fetchCollection<FriendshipRecord>(accessToken, 'Friendships', {
    select: ['ID', 'toUser_ID'],
    filter: buildStringEqualsFilter('fromUser_ID', userId),
    expand: {
      toUser: {
        select: ['ID', 'name', 'picture'],
      },
    },
    top: 250,
  });

  return rows
    .map((row) => row.toUser)
    .filter((friend): friend is User => Boolean(friend?.ID));
}

async function fetchComparisonStampboxes(accessToken: string, groupUserIds: string[]) {
  const groupFilter = [...new Set(groupUserIds.filter(Boolean))].join(',');
  if (!groupFilter) {
    return [] as Stampbox[];
  }

  const rows = await fetchCollection<Stampbox>(accessToken, 'Stampboxes', {
    select: [
      'ID',
      'number',
      'orderBy',
      'name',
      'description',
      'heroImageUrl',
      'image',
      'imageCaption',
      'latitude',
      'longitude',
      'hasVisited',
      'totalGroupStampings',
      'stampedUsers',
      'stampedUserIds',
      'groupFilterStampings',
    ],
    skip: 0,
    top: 250,
    orderBy: 'orderBy asc',
    filter: buildStringNotEqualsFilter('groupFilterStampings', groupFilter),
  });

  return rows.slice().sort((left, right) => {
    const leftKey = left.orderBy || left.number || '';
    const rightKey = right.orderBy || right.number || '';
    return leftKey.localeCompare(rightKey, undefined, { numeric: true });
  });
}

async function fetchGuidFilteredCollection<T>(
  accessToken: string,
  entitySet: string,
  field: string,
  id: string,
  query?: QueryInput
) {
  const filters = [`${field} eq ${id}`];

  for (const filter of filters) {
    try {
      if (!query) {
        return await fetchCollection<T>(accessToken, entitySet, {
          filter,
        });
      }

      if (Array.isArray(query)) {
        return await fetchCollection<T>(accessToken, entitySet, [...query, ['$filter', filter]]);
      }

      const existingFilter = query.filter;
      const mergedFilter =
        typeof existingFilter === 'string' && existingFilter.trim().length > 0
          ? `(${existingFilter}) and (${filter})`
          : filter;

      return await fetchCollection<T>(accessToken, entitySet, {
        ...query,
        filter: mergedFilter,
      });
    } catch {
      continue;
    }
  }

  return [];
}

async function fetchLatestStampingsForStampAndUsers(
  accessToken: string,
  stampId: string,
  userIds: string[]
) {
  const uniqueUserIds = normalizeIdList(userIds);
  const latestStampings = new Map<string, Stamping>();
  if (uniqueUserIds.length === 0) {
    return latestStampings;
  }

  const createdByFilter = uniqueUserIds
    .map((userId) => `createdBy eq '${escapeODataString(userId)}'`)
    .join(' or ');
  const stampFilters = [`stamp_ID eq ${stampId}`];

  for (const stampFilter of stampFilters) {
    try {
      const rows = await fetchCollection<Stamping>(accessToken, 'Stampings', {
        select: ['ID', 'visitedAt', 'createdAt', 'createdBy', 'stamp_ID'],
        filter: `${stampFilter} and (${createdByFilter})`,
        orderBy: 'visitedAt desc,createdAt desc',
        top: Math.max(20, uniqueUserIds.length * 6),
      });

      for (const row of rows) {
        const createdBy = safeTrim(row.createdBy);
        if (!createdBy || latestStampings.has(createdBy)) {
          continue;
        }

        latestStampings.set(createdBy, row);
      }

      if (latestStampings.size > 0) {
        return latestStampings;
      }
    } catch {
      continue;
    }
  }

  return latestStampings;
}

async function fetchStampFriendVisits(
  accessToken: string,
  stampId: string,
  friendIds: string[]
) {
  if (friendIds.length === 0) {
    return [] as StampFriendVisitRow[];
  }

  const actionResponse = await mutateOData<unknown>(accessToken, buildUrl('getStampFriendVisits'), {
    method: 'POST',
    body: JSON.stringify({
      sStampId: stampId,
      sGroupUserIds: [...new Set(friendIds.filter(Boolean))].join(','),
    }),
  });
  const rawValue = parseActionStringResult(actionResponse);
  if (!rawValue) {
    return [] as StampFriendVisitRow[];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as StampFriendVisitRow[]) : [];
  } catch {
    return [] as StampFriendVisitRow[];
  }
}

async function enrichLatestVisitsWithFriendVisitDates(
  accessToken: string,
  targetUserId: string,
  latestVisits: UserProfileOverviewData['latestVisits']
) {
  const unresolvedVisits = latestVisits.filter(
    (visit) => !safeTrim(visit.visitedAt) && safeTrim(visit.stampId)
  );
  if (unresolvedVisits.length === 0) {
    return latestVisits;
  }

  const targetUserIdTrimmed = safeTrim(targetUserId);
  const unresolvedStampIds = [...new Set(unresolvedVisits.map((visit) => safeTrim(visit.stampId)))].filter(
    Boolean
  ) as string[];
  const resolvedTimestampByStampId = new Map<string, string>();

  await Promise.all(
    unresolvedStampIds.map(async (stampId) => {
      try {
        const friendVisits = await fetchStampFriendVisits(accessToken, stampId, [targetUserIdTrimmed]);
        const matchingFriendVisit = friendVisits.find(
          (friendVisit) => safeTrim(friendVisit.friendId) === targetUserIdTrimmed
        );
        const timestamp =
          safeTrim(matchingFriendVisit?.visitedAt) ||
          safeTrim(matchingFriendVisit?.createdAt) ||
          safeTrim(matchingFriendVisit?.timestamp);

        if (timestamp) {
          resolvedTimestampByStampId.set(stampId, timestamp);
        }
      } catch {
        // Keep fallback behavior when the friend-visit endpoint is unavailable.
      }
    })
  );

  if (resolvedTimestampByStampId.size === 0) {
    return latestVisits;
  }

  return latestVisits
    .map((visit) => {
      if (safeTrim(visit.visitedAt)) {
        return visit;
      }

      const stampId = safeTrim(visit.stampId);
      if (!stampId) {
        return visit;
      }

      const resolvedTimestamp = resolvedTimestampByStampId.get(stampId);
      if (!resolvedTimestamp) {
        return visit;
      }

      return {
        ...visit,
        visitedAt: resolvedTimestamp,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.visitedAt || 0).getTime() - new Date(left.visitedAt || 0).getTime()
    );
}

function estimateMinutes(distanceKm: number | null) {
  if (distanceKm === null) {
    return null;
  }

  return Math.max(1, Math.round((distanceKm / 4) * 60));
}

function createFallbackRouteMetrics(distanceKm: number | null) {
  return {
    distanceKm,
    durationMinutes: estimateMinutes(distanceKm),
    elevationGainMeters: null,
    elevationLossMeters: null,
  } satisfies RouteMetrics;
}

function selectPreferredRoute(routeRows: TravelTimeRow[]) {
  return (
    routeRows.find((row) => {
      const travelMode = safeNormalizedText(row.travelMode);
      return (
        travelMode.includes('walk') ||
        travelMode.includes('foot') ||
        travelMode.includes('hike') ||
        travelMode.includes('pedestrian')
      );
    }) ?? routeRows[0]
  );
}

function resolveRouteMetrics(routeRows: TravelTimeRow[], fallbackDistanceKm: number | null) {
  if (routeRows.length === 0) {
    return createFallbackRouteMetrics(fallbackDistanceKm);
  }

  const preferredRoute = selectPreferredRoute(routeRows);
  const distanceKm =
    typeof preferredRoute.distanceMeters === 'number' && Number.isFinite(preferredRoute.distanceMeters)
      ? preferredRoute.distanceMeters / 1000
      : fallbackDistanceKm;
  const durationMinutes =
    typeof preferredRoute.durationSeconds === 'number' && Number.isFinite(preferredRoute.durationSeconds)
      ? Math.max(1, Math.round(preferredRoute.durationSeconds / 60))
      : estimateMinutes(distanceKm);

  return {
    distanceKm,
    durationMinutes,
    elevationGainMeters:
      typeof preferredRoute.elevationGain === 'number' && Number.isFinite(preferredRoute.elevationGain)
        ? preferredRoute.elevationGain
        : null,
    elevationLossMeters:
      typeof preferredRoute.elevationLoss === 'number' && Number.isFinite(preferredRoute.elevationLoss)
        ? preferredRoute.elevationLoss
        : null,
  } satisfies RouteMetrics;
}

async function fetchRouteMetricsByTargets(
  accessToken: string,
  fromPoiId: string,
  targets: { toPoiId: string; fallbackDistanceKm?: number | null }[]
) {
  const normalizedTargets = normalizeIdList(targets.map((target) => target.toPoiId));
  const fallbackDistanceByToPoi = new Map(
    targets.map((target) => [
      safeNormalizedText(target.toPoiId),
      typeof target.fallbackDistanceKm === 'number' && Number.isFinite(target.fallbackDistanceKm)
        ? target.fallbackDistanceKm
        : null,
    ])
  );
  const metricsByToPoi = new Map<string, RouteMetrics>();

  if (normalizedTargets.length === 0) {
    return metricsByToPoi;
  }

  const routeFilters = [
    `fromPoi eq ${fromPoiId} and (${normalizedTargets.map((toPoiId) => `toPoi eq ${toPoiId}`).join(' or ')})`,
  ];

  let routeRows: TravelTimeRow[] = [];
  for (const filter of routeFilters) {
    try {
      routeRows = await fetchCollection<TravelTimeRow>(accessToken, 'TravelTimes', {
        select: ['ID', 'toPoi', 'durationSeconds', 'distanceMeters', 'travelMode', 'elevationGain', 'elevationLoss'],
        filter,
        top: Math.max(20, normalizedTargets.length * 10),
      });
      if (routeRows.length > 0) {
        break;
      }
    } catch {
      continue;
    }
  }

  const rowsByToPoi = new Map<string, TravelTimeRow[]>();
  for (const row of routeRows) {
    const toPoiKey = safeNormalizedText(row.toPoi);
    if (!toPoiKey) {
      continue;
    }

    const list = rowsByToPoi.get(toPoiKey);
    if (list) {
      list.push(row);
    } else {
      rowsByToPoi.set(toPoiKey, [row]);
    }
  }

  for (const toPoiId of normalizedTargets) {
    const normalizedToPoiId = safeNormalizedText(toPoiId);
    metricsByToPoi.set(
      normalizedToPoiId,
      resolveRouteMetrics(rowsByToPoi.get(normalizedToPoiId) ?? [], fallbackDistanceByToPoi.get(normalizedToPoiId) ?? null)
    );
  }

  return metricsByToPoi;
}

export async function fetchRouteMetrics(
  accessToken: string,
  fromPoiId: string,
  toPoiId: string,
  fallbackDistanceKm: number | null = null
) {
  const normalizedToPoiId = safeNormalizedText(toPoiId);
  const fallback =
    typeof fallbackDistanceKm === 'number' && Number.isFinite(fallbackDistanceKm) ? fallbackDistanceKm : null;
  const metricsByToPoi = await fetchRouteMetricsByTargets(accessToken, fromPoiId, [
    { toPoiId, fallbackDistanceKm: fallback },
  ]);

  return metricsByToPoi.get(normalizedToPoiId) ?? createFallbackRouteMetrics(fallback);
}

function getVisitTimestamp(stamping: Stamping) {
  return stamping.visitedAt || stamping.createdAt;
}

function safeTrim(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNormalizedText(value: unknown) {
  return safeTrim(value).toLowerCase();
}

function decodeUriComponentSafely(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeFriendToken(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return safeNormalizedText(decodeUriComponentSafely(trimmed));
  }

  if (typeof value === 'number') {
    return safeNormalizedText(String(value));
  }

  return '';
}

function normalizeFriendFieldParts(value: unknown) {
  if (value === null || value === undefined) {
    return [] as unknown[];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [] as unknown[];
    }

    const parsed = parsePotentialJson(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      return [parsed];
    }

    return trimmed.split(/[;,]/);
  }

  return [value];
}

function tokenizeFriendField(value?: unknown) {
  if (!value) {
    return [];
  }

  const parts = normalizeFriendFieldParts(value);
  const tokens = new Set<string>();

  for (const part of parts) {
    if (part && typeof part === 'object') {
      const objectPart = part as Record<string, unknown>;
      const idToken = normalizeFriendToken(objectPart.ID ?? objectPart.id);
      const nameToken = normalizeFriendToken(objectPart.name ?? objectPart.Name);
      if (idToken) {
        tokens.add(idToken);
      }
      if (nameToken) {
        tokens.add(nameToken);
      }
      continue;
    }

    const token = normalizeFriendToken(part);
    if (token) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

function stampContainsUserId(stamp: Stampbox, userId: string) {
  const normalizedUserId = normalizeFriendToken(userId);
  if (!normalizedUserId) {
    return false;
  }

  return tokenizeFriendField(stamp.stampedUserIds).includes(normalizedUserId);
}

function stampContainsUserName(stamp: Stampbox, name?: string) {
  const normalizedName = normalizeFriendToken(name);
  if (!normalizedName) {
    return false;
  }

  return tokenizeFriendField(stamp.stampedUsers).includes(normalizedName);
}

function stampContainsUser(stamp: Stampbox, user: { ID: string; name?: string }) {
  return stampContainsUserId(stamp, user.ID) || stampContainsUserName(stamp, user.name);
}

type StampboxWithExpandedData = Stampbox & {
  Stampings?: Stamping[];
  StampNotes?: StampNote[];
};

function normalizeStampNote(value?: Partial<StampNote> | null): StampNote | null {
  if (!value?.ID) {
    return null;
  }

  return {
    ID: value.ID,
    stamp_ID: value.stamp_ID,
    note: typeof value.note === 'string' ? value.note : '',
    createdBy: safeTrim(value.createdBy) || undefined,
    createdAt: value.createdAt,
    modifiedAt: value.modifiedAt,
  };
}

function normalizeUserToken(value?: string) {
  return safeTrim(value).toLowerCase();
}

function pickCurrentUserStampNote(notes: StampNote[], currentUserId?: string) {
  if (notes.length === 0) {
    return null;
  }

  const sortedNotes = notes.slice().sort((left, right) => {
    const leftModifiedAt = left.modifiedAt ? Date.parse(left.modifiedAt) : Number.NaN;
    const rightModifiedAt = right.modifiedAt ? Date.parse(right.modifiedAt) : Number.NaN;
    const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
    const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;

    const leftTime = Number.isFinite(leftModifiedAt)
      ? leftModifiedAt
      : Number.isFinite(leftCreatedAt)
        ? leftCreatedAt
        : 0;
    const rightTime = Number.isFinite(rightModifiedAt)
      ? rightModifiedAt
      : Number.isFinite(rightCreatedAt)
        ? rightCreatedAt
        : 0;

    return rightTime - leftTime;
  });

  const normalizedCurrentUserId = normalizeUserToken(currentUserId);
  if (!normalizedCurrentUserId) {
    return normalizeStampNote(sortedNotes[0]);
  }

  const matchingNote = sortedNotes.find(
    (note) => normalizeUserToken(note.createdBy) === normalizedCurrentUserId
  );
  return normalizeStampNote(matchingNote ?? null);
}

async function fetchStampWithRecentStampings(
  accessToken: string,
  stampId: string,
  currentUserId?: string
) {
  try {
    const [rows, stampNotes] = await Promise.all([
      fetchGuidFilteredCollection<StampboxWithExpandedData>(
        accessToken,
        'Stampboxes',
        'ID',
        stampId,
        [
          [
            '$select',
            'ID,number,orderBy,name,description,heroImageUrl,image,imageCaption,validFrom,validTo,latitude,longitude,hasVisited,totalGroupStampings,stampedUsers,stampedUserIds',
          ],
          [
            '$expand',
            'Stampings($select=ID,visitedAt,createdAt,createdBy,stamp_ID)',
          ],
          ['$top', 1],
        ]
      ),
      fetchGuidFilteredCollection<StampNote>(accessToken, 'StampNotes', 'stamp_ID', stampId, {
        select: ['ID', 'stamp_ID', 'note', 'createdBy', 'createdAt', 'modifiedAt'],
        orderBy: 'modifiedAt desc,createdAt desc',
        top: 50,
      }),
    ]);

    if (rows.length > 0) {
      const { Stampings: expandedStampings, ...stamp } = rows[0];
      const sortedStampings = (Array.isArray(expandedStampings) ? expandedStampings : []).sort((left, right) => {
        const leftVisitedAt = left.visitedAt ? Date.parse(left.visitedAt) : Number.NaN;
        const rightVisitedAt = right.visitedAt ? Date.parse(right.visitedAt) : Number.NaN;
        const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
        const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;

        const leftTime = Number.isFinite(leftVisitedAt)
          ? leftVisitedAt
          : Number.isFinite(leftCreatedAt)
            ? leftCreatedAt
            : 0;
        const rightTime = Number.isFinite(rightVisitedAt)
          ? rightVisitedAt
          : Number.isFinite(rightCreatedAt)
            ? rightCreatedAt
            : 0;

        return rightTime - leftTime;
      });
      return {
        stamp: stamp as Stampbox,
        stampings: sortedStampings.slice(0, 200),
        myNote: pickCurrentUserStampNote(stampNotes, currentUserId),
      };
    }
  } catch {
    // Fallback below for services that do not support this expand shape.
  }

  const [stamp, stampings, stampNotes] = await Promise.all([
    fetchEntityById<Stampbox>(accessToken, 'Stampboxes', stampId, [
      [
        '$select',
        'ID,number,orderBy,name,description,heroImageUrl,image,imageCaption,validFrom,validTo,latitude,longitude,hasVisited,totalGroupStampings,stampedUsers,stampedUserIds',
      ],
    ]),
    fetchGuidFilteredCollection<Stamping>(accessToken, 'Stampings', 'stamp_ID', stampId, [
      ['$select', 'ID,visitedAt,createdAt,createdBy,stamp_ID'],
      ['$orderby', 'visitedAt desc,createdAt desc'],
      ['$top', 200],
    ]),
    fetchGuidFilteredCollection<StampNote>(accessToken, 'StampNotes', 'stamp_ID', stampId, {
      select: ['ID', 'stamp_ID', 'note', 'createdBy', 'createdAt', 'modifiedAt'],
      orderBy: 'modifiedAt desc,createdAt desc',
      top: 50,
    }),
  ]);

  return { stamp, stampings, myNote: pickCurrentUserStampNote(stampNotes, currentUserId) };
}

async function fetchGuidEntitiesByIds<T>(
  accessToken: string,
  entitySet: string,
  idField: string,
  ids: string[],
  query?: ODataQuery
) {
  const normalizedIds = normalizeIdList(ids);
  if (normalizedIds.length === 0) {
    return [] as T[];
  }

  const configuredTop = typeof query?.top === 'number' ? query.top : 0;
  const effectiveTop = Math.max(configuredTop, Math.max(20, normalizedIds.length * 5));
  const filters = [normalizedIds.map((id) => `${idField} eq ${id}`).join(' or ')];

  for (const filter of filters) {
    try {
      return await fetchCollection<T>(accessToken, entitySet, {
        ...(query ?? {}),
        top: effectiveTop,
        filter,
      });
    } catch {
      continue;
    }
  }

  return [] as T[];
}

export async function fetchStampboxes(accessToken: string, mode: StampboxFetchMode = 'default') {
  const nowIso = new Date().toISOString();
  const year2000Iso = '2000-01-01T00:00:00Z';
  const now = new Date();
  const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const validTodayClause = `(validFrom eq null or validFrom le ${nowIso}) and (validTo eq null or validTo ge ${nowIso})`;
  const filter =
    mode === 'validToday'
      ? validTodayClause
      : mode === 'all'
        ? `(validTo eq null or validTo gt ${year2000Iso} or validTo lt ${year2000Iso})`
        : mode === 'visited'
          ? `(hasVisited eq true) and ${validTodayClause}`
          : mode === 'open'
            ? `((hasVisited eq false or hasVisited eq null) and ${validTodayClause})`
            : mode === 'relocated'
              ? `(validTo ne null and validTo lt ${startOfTodayIso})`
        : undefined;

  const rows = await fetchCollection<Stampbox>(accessToken, 'Stampboxes', {
    select: [
      'ID',
      'number',
      'orderBy',
      'name',
      'description',
      'heroImageUrl',
      'image',
      'imageCaption',
      'validFrom',
      'validTo',
      'latitude',
      'longitude',
      'hasVisited',
      'totalGroupStampings',
      'stampedUsers',
      'stampedUserIds',
    ],
    orderBy: 'orderBy asc',
    top: 500,
    ...(filter ? { filter } : {}),
  });

  return rows.slice().sort((left, right) => {
    const leftKey = left.orderBy || left.number || '';
    const rightKey = right.orderBy || right.number || '';
    return leftKey.localeCompare(rightKey, undefined, { numeric: true });
  });
}

export async function fetchMapData(
  accessToken: string,
  currentUserId?: string,
  prefetchedStamps?: Stampbox[],
  prefetchedLatestVisited?: LatestVisitedStamp | null,
  stampboxFetchMode: StampboxFetchMode = 'default'
) {
  const [stamps, parkingSpots, latestVisited] = await Promise.all([
    prefetchedStamps ? Promise.resolve(prefetchedStamps) : fetchStampboxes(accessToken, stampboxFetchMode),
    fetchCollection<ParkingSpot>(accessToken, 'ParkingSpots', {
      select: ['ID', 'name', 'description', 'image', 'latitude', 'longitude'],
      top: 500,
    }),
    prefetchedLatestVisited !== undefined
      ? Promise.resolve(prefetchedLatestVisited)
      : currentUserId
        ? fetchLatestVisitedStamp(accessToken, currentUserId)
        : Promise.resolve(null),
  ]);

  const latestVisitByStampId = new Map<string, string>();
  if (latestVisited?.stampId && latestVisited.visitedAt) {
    latestVisitByStampId.set(latestVisited.stampId, latestVisited.visitedAt);
  }

  return {
    stamps: stamps.map((stamp) => {
      const visitedAt = latestVisitByStampId.get(stamp.ID);
      const hasVisited = Boolean(stamp.hasVisited || visitedAt);

      return {
        ...stamp,
        hasVisited,
        visitedAt,
        kind: hasVisited ? ('visited-stamp' as const) : ('open-stamp' as const),
      };
    }),
    parkingSpots: parkingSpots.map((parkingSpot) => ({
      ...parkingSpot,
      kind: 'parking' as const,
    })),
  } satisfies MapData;
}

function normalizeTourDetailResponse(rawValue: unknown) {
  const value = (rawValue && typeof rawValue === 'object' ? rawValue : {}) as Record<string, unknown>;
  const path = Array.isArray(value.path) ? value.path : [];
  const normalizedPath = path
    .map((entry) => normalizeTourPathEntry(entry as TourPathRow))
    .filter((entry) => entry.tour_ID || entry.travelTime_ID);
  const aggregatedMetrics = aggregateTourMetricsFromPath(normalizedPath);

  return {
    stampCount: toRoundedNumberOrNull(value.stampCount),
    newStampCountForUser: toRoundedNumberOrNull(value.newStampCountForUser),
    distance: aggregatedMetrics.distance ?? toFiniteNumber(value.distance),
    duration: aggregatedMetrics.duration ?? toFiniteNumber(value.duration),
    id: safeTrim(value.id),
    groupSize: toRoundedNumberOrNull(value.groupSize),
    averageGroupStampings: toRoundedNumberOrNull(value.averageGroupStampings ?? value.AverageGroupStampings),
    path: normalizedPath,
  } satisfies TourDetailResponse;
}

function normalizeTourUpdateResponse(rawValue: unknown) {
  const value = (rawValue && typeof rawValue === 'object' ? rawValue : {}) as Record<string, unknown>;
  const path = Array.isArray(value.path) ? value.path : [];
  const normalizedPath = path
    .map((entry) => normalizeTourPathEntry(entry as TourPathRow))
    .filter((entry) => entry.tour_ID || entry.travelTime_ID);
  const aggregatedMetrics = aggregateTourMetricsFromPath(normalizedPath);

  return {
    ID: safeTrim(value.ID),
    distance: aggregatedMetrics.distance ?? toFiniteNumber(value.distance),
    duration: aggregatedMetrics.duration ?? toFiniteNumber(value.duration),
    stampCount: toRoundedNumberOrNull(value.stampCount),
    newStampCountForUser: toRoundedNumberOrNull(value.newStampCountForUser),
    idListTravelTimes: safeTrim(value.idListTravelTimes),
    totalElevationGain: toFiniteNumber(value.totalElevationGain),
    totalElevationLoss: toFiniteNumber(value.totalElevationLoss),
    path: normalizedPath,
  } satisfies TourUpdateResponse;
}

function normalizeHikingRouteCalculationResponse(rawValue: unknown) {
  const value = (rawValue && typeof rawValue === 'object' ? rawValue : {}) as Record<string, unknown>;
  const rawResults = Array.isArray(value.results) ? value.results : [];

  return {
    results: rawResults
      .map((rawResult) => {
        const result =
          rawResult && typeof rawResult === 'object' ? (rawResult as Record<string, unknown>) : {};
        const rawPath = Array.isArray(result.path) ? result.path : [];
        const normalizedPath = rawPath
          .map((entry) => normalizeTourPathEntry(entry as TourPathRow))
          .filter((entry) => entry.tour_ID || entry.travelTime_ID);
        const aggregatedMetrics = aggregateTourMetricsFromPath(normalizedPath);

        return {
          id: safeTrim(result.id),
          stampCount: toRoundedNumberOrNull(result.stampCount),
          distance: aggregatedMetrics.distance ?? toFiniteNumber(result.distance),
          duration: aggregatedMetrics.duration ?? toFiniteNumber(result.duration),
          path: normalizedPath,
        } satisfies HikingRouteResult;
      })
      .filter((result) => Boolean(result.id)),
  } satisfies HikingRouteCalculationResponse;
}

export async function fetchTours(accessToken: string, groupUserIds: string[] = []) {
  const groupFilter = normalizeIdList(groupUserIds).join(',');
  const rows = await fetchCollection<TourRow>(accessToken, 'Tours', {
    select: [
      'ID',
      'name',
      'distance',
      'duration',
      'stampCount',
      'newStampCountForUser',
      'idListTravelTimes',
      'totalElevationGain',
      'totalElevationLoss',
      'createdBy',
      'createdAt',
      'groupFilterStampings',
      'AverageGroupStampings',
    ],
    expand: {
      creator: {
        select: ['ID', 'name', 'picture'],
      },
    },
    orderBy: 'createdAt desc',
    top: 250,
    ...(groupFilter ? { filter: buildStringNotEqualsFilter('groupFilterStampings', groupFilter) } : {}),
  });

  return rows.map((row) => normalizeTourRow(row));
}

export async function fetchTourById(accessToken: string, tourId: string, groupUserIds: string[] = []) {
  const normalizedTourId = safeTrim(tourId);
  if (!normalizedTourId) {
    throw new Error('Tour ID is required');
  }

  const groupFilter = normalizeIdList(groupUserIds).join(',');
  const filters = [`ID eq ${normalizedTourId}`];

  for (const idFilter of filters) {
    const filter = groupFilter
      ? `${idFilter} and groupFilterStampings ne '${escapeODataString(groupFilter)}'`
      : idFilter;

    try {
      const rows = await fetchCollection<TourRow>(accessToken, 'Tours', {
        select: [
          'ID',
          'name',
          'distance',
          'duration',
          'stampCount',
          'newStampCountForUser',
          'idListTravelTimes',
          'totalElevationGain',
          'totalElevationLoss',
          'createdBy',
          'createdAt',
          'groupFilterStampings',
          'AverageGroupStampings',
        ],
        expand: {
          creator: {
            select: ['ID', 'name', 'picture'],
          },
        },
        top: 1,
        filter,
      });

      if (rows.length > 0) {
        return normalizeTourRow(rows[0]);
      }
    } catch {
      continue;
    }
  }

  throw new HttpStatusError(404, 'Tour not found');
}

export async function createTour(
  accessToken: string,
  payload: {
    name: string;
    idListTravelTimes?: string;
    groupFilterStampings?: string;
  }
) {
  const response = await mutateOData<unknown>(accessToken, buildUrl('Tours'), {
    method: 'POST',
    body: JSON.stringify({
      name: safeTrim(payload.name) || 'Neue Tour',
      idListTravelTimes: safeTrim(payload.idListTravelTimes),
      ...(safeTrim(payload.groupFilterStampings)
        ? { groupFilterStampings: safeTrim(payload.groupFilterStampings) }
        : {}),
    }),
  });

  const parsed = unwrapODataEnvelope(response);
  if (!parsed || typeof parsed !== 'object' || !('ID' in parsed)) {
    throw new Error('Unexpected create tour response payload');
  }

  return normalizeTourRow(parsed as TourRow);
}

export async function deleteTour(accessToken: string, tourId: string) {
  const normalizedTourId = safeTrim(tourId);
  if (!normalizedTourId) {
    throw new Error('Tour ID is required');
  }

  const paths = [
    `Tours(${normalizedTourId})`,
    `Tours(guid'${escapeODataString(normalizedTourId)}')`,
    buildStringKeyPath('Tours', normalizedTourId),
  ];

  for (const path of paths) {
    try {
      return await mutateOData<null>(accessToken, buildUrl(path), {
        method: 'DELETE',
      });
    } catch (error) {
      if (error instanceof HttpStatusError && (error.status === 400 || error.status === 404)) {
        continue;
      }

      throw error;
    }
  }

  throw new HttpStatusError(404, 'Tour not found');
}

export async function updateTourName(accessToken: string, payload: { tourId: string; name: string }) {
  const normalizedTourId = safeTrim(payload.tourId);
  const normalizedName = safeTrim(payload.name);

  if (!normalizedTourId) {
    throw new Error('Tour ID is required');
  }

  if (!normalizedName) {
    throw new Error('Tour name is required');
  }

  const paths = [
    `Tours(${normalizedTourId})`,
    `Tours(guid'${escapeODataString(normalizedTourId)}')`,
    buildStringKeyPath('Tours', normalizedTourId),
  ];

  for (const path of paths) {
    try {
      return await mutateOData<null>(accessToken, buildUrl(path), {
        method: 'PATCH',
        body: JSON.stringify({
          name: normalizedName,
        }),
      });
    } catch (error) {
      if (error instanceof HttpStatusError && (error.status === 400 || error.status === 404)) {
        continue;
      }

      throw error;
    }
  }

  throw new HttpStatusError(404, 'Tour not found');
}

export async function fetchTourPath(accessToken: string, tourId: string) {
  const normalizedTourId = safeTrim(tourId);
  if (!normalizedTourId) {
    return [] as TourPathEntry[];
  }

  const filters = [`tour_ID eq ${normalizedTourId}`];

  for (const filter of filters) {
    try {
      const rows = await fetchCollection<TourPathRow>(accessToken, 'Tour2TravelTime', [
        ['$filter', filter],
        ['$expand', 'travelTime'],
        ['$orderby', 'rank asc'],
        ['$top', 600],
      ]);

      return rows
        .map((row) => normalizeTourPathEntry(row))
        .sort((left, right) => left.rank - right.rank);
    } catch {
      continue;
    }
  }

  return [] as TourPathEntry[];
}

export async function fetchTransientTourByIdListTravelTimes(
  accessToken: string,
  idListTravelTimes: string
) {
  const value = safeTrim(idListTravelTimes);
  const payload = await fetchOData<unknown>(
    accessToken,
    buildUrl('getTourByIdListTravelTimes', [
      ['idListTravelTimes', `'${escapeODataString(value)}'`],
    ])
  );
  const parsed = parseODataFunctionResult<unknown>(payload, 'getTourByIdListTravelTimes');
  return normalizeTourDetailResponse(parsed);
}

export async function updateTourByPOIList(
  accessToken: string,
  payload: {
    TourID: string;
    POIList: string;
  }
) {
  const response = await mutateOData<unknown>(accessToken, buildUrl('updateTourByPOIList'), {
    method: 'POST',
    body: JSON.stringify({
      TourID: safeTrim(payload.TourID),
      POIList: safeTrim(payload.POIList),
    }),
  });

  const parsed = parseODataFunctionResult<unknown>(response, 'updateTourByPOIList');
  return normalizeTourUpdateResponse(parsed);
}

export async function fetchAllPointsOfInterest(accessToken: string) {
  const rows = await fetchCollection<PointOfInterestRow>(accessToken, 'AllPointsOfInterest', {
    select: [
      'ID',
      'name',
      'poiType',
      'stampNumber',
      'orderBy',
      'latitude',
      'longitude',
      'heroImageUrl',
      'imageCaption',
      'description',
    ],
    orderBy: 'orderBy asc',
    top: 1000,
  });

  return rows.map((row) => normalizePointOfInterestRow(row));
}

export async function calculateHikingRoute(
  accessToken: string,
  payload: {
    maxDepth: number;
    maxDuration: number;
    maxDistance: number;
    minStampCount: number;
    allowDriveInRoute: boolean;
    latitudeStart: string;
    longitudeStart: string;
    groupFilterStampings?: string;
  }
) {
  const response = await fetchOData<unknown>(
    accessToken,
    buildUrl('calculateHikingRoute', [
      ['maxDepth', payload.maxDepth],
      ['maxDuration', payload.maxDuration],
      ['maxDistance', payload.maxDistance],
      ['minStampCount', payload.minStampCount],
      ['allowDriveInRoute', payload.allowDriveInRoute],
      ['latitudeStart', payload.latitudeStart],
      ['longitudeStart', payload.longitudeStart],
      ['groupFilterStampings', payload.groupFilterStampings],
    ])
  );

  const parsed = parseODataFunctionResult<unknown>(response, 'calculateHikingRoute');
  return normalizeHikingRouteCalculationResponse(parsed);
}

export async function fetchLatestVisitedStamp(accessToken: string, currentUserId?: string) {
  if (!currentUserId) {
    return null;
  }

  const latestStamping = await fetchCollection<Stamping>(accessToken, 'Stampings', {
    select: ['ID', 'visitedAt', 'createdAt', 'createdBy', 'stamp_ID'],
    filter: buildStringEqualsFilter('createdBy', currentUserId),
    orderBy: 'visitedAt desc,createdAt desc',
    top: 1,
    expand: {
      stamp: {
        select: ['ID', 'number', 'name'],
      },
    },
  });

  const latestVisit = latestStamping[0];
  const expandedStamp = latestVisit?.stamp;
  const stampId = expandedStamp?.ID || latestVisit?.stamp_ID;
  if (!stampId) {
    return null;
  }

  const stamp =
    expandedStamp ??
    (await fetchEntityById<Stampbox>(accessToken, 'Stampboxes', stampId, [['$select', 'ID,number,name']]));

  return {
    stampId: stamp.ID,
    stampNumber: stamp.number,
    stampName: stamp.name || 'Stempelstelle',
    visitedAt: getVisitTimestamp(latestVisit),
  } satisfies LatestVisitedStamp;
}

export async function fetchCurrentUserProfile(accessToken: string) {
  const currentUser = await fetchCurrentUserRecord(accessToken);

  return {
    id: currentUser.ID,
    name: currentUser.name || currentUser.ID,
    picture: currentUser.picture,
    roles: normalizeRoleTokens(currentUser.roles),
  } satisfies CurrentUserProfileData;
}

function assertValidLatitudeLongitude(latitude: number, longitude: number) {
  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }
}

function normalizeAdminStampboxCreatePayload(payload: AdminStampboxMutationInput) {
  const name = safeTrim(payload.name);
  const description = safeTrim(payload.description);
  const heroImageUrl = safeTrim(payload.heroImageUrl);
  const imageCaption = safeTrim(payload.imageCaption);
  debugger
  const validFrom = safeTrim(payload.validFrom);
  const validTo = safeTrim(payload.validTo);
  const number = safeTrim(payload.number);
  const orderBy = safeTrim(payload.orderBy);
  const latitude = toFiniteNumber(payload.latitude);
  const longitude = toFiniteNumber(payload.longitude);

  if (!name) {
    throw new Error('Stampbox name is required.');
  }

  if (latitude === null || longitude === null) {
    throw new Error('Latitude and longitude are required.');
  }

  assertValidLatitudeLongitude(latitude, longitude);

  return {
    name,
    description: description || undefined,
    heroImageUrl: heroImageUrl || undefined,
    imageCaption: imageCaption || undefined,
    validFrom: validFrom || new Date("2000-01-01T00:00:00.000Z").toISOString(),
    validTo: validTo || new Date("2037-12-31T23:00:01.000Z").toISOString(),
    latitude,
    longitude,
    number: number || undefined,
    orderBy: orderBy || undefined,
  };
}

function normalizeAdminStampboxUpdatePayload(payload: Partial<AdminStampboxMutationInput>) {
  const updatePayload: Partial<AdminStampboxMutationInput> = {};
  debugger

  if ('name' in payload) {
    const name = safeTrim(payload.name);
    if (!name) {
      throw new Error('Stampbox name cannot be empty.');
    }
    updatePayload.name = name;
  }

  if ('description' in payload) {
    updatePayload.description = safeTrim(payload.description);
  }

  if ('heroImageUrl' in payload) {
    updatePayload.heroImageUrl = safeTrim(payload.heroImageUrl);
  }

  if ('imageCaption' in payload) {
    updatePayload.imageCaption = safeTrim(payload.imageCaption);
  }

  if ('validFrom' in payload) {
    updatePayload.validFrom = safeTrim(payload.validFrom);
  }

  if ('validTo' in payload) {
    updatePayload.validTo = safeTrim(payload.validTo);
  }

  if ('number' in payload) {
    updatePayload.number = safeTrim(payload.number);
  }

  if ('orderBy' in payload) {
    updatePayload.orderBy = safeTrim(payload.orderBy);
  }

  const hasLatitude = 'latitude' in payload;
  const hasLongitude = 'longitude' in payload;

  if (hasLatitude || hasLongitude) {
    const latitude = hasLatitude ? toFiniteNumber(payload.latitude) : null;
    const longitude = hasLongitude ? toFiniteNumber(payload.longitude) : null;

    if (latitude === null || longitude === null) {
      throw new Error('Latitude and longitude must both be valid numbers when updating location.');
    }

    assertValidLatitudeLongitude(latitude, longitude);
    updatePayload.latitude = latitude;
    updatePayload.longitude = longitude;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No stampbox fields to update.');
  }

  return updatePayload;
}

function normalizeAdminParkingSpotCreatePayload(payload: AdminParkingSpotMutationInput) {
  const name = safeTrim(payload.name);
  const description = safeTrim(payload.description);
  const image = safeTrim(payload.image);
  const latitude = toFiniteNumber(payload.latitude);
  const longitude = toFiniteNumber(payload.longitude);

  if (!name) {
    throw new Error('Parking spot name is required.');
  }

  if (latitude === null || longitude === null) {
    throw new Error('Latitude and longitude are required.');
  }

  assertValidLatitudeLongitude(latitude, longitude);

  return {
    name,
    description: description || undefined,
    image: image || undefined,
    latitude,
    longitude,
  };
}

function normalizeAdminParkingSpotUpdatePayload(payload: Partial<AdminParkingSpotMutationInput>) {
  const updatePayload: Partial<AdminParkingSpotMutationInput> = {};

  if ('name' in payload) {
    const name = safeTrim(payload.name);
    if (!name) {
      throw new Error('Parking spot name cannot be empty.');
    }
    updatePayload.name = name;
  }

  if ('description' in payload) {
    updatePayload.description = safeTrim(payload.description);
  }

  if ('image' in payload) {
    updatePayload.image = safeTrim(payload.image);
  }

  const hasLatitude = 'latitude' in payload;
  const hasLongitude = 'longitude' in payload;

  if (hasLatitude || hasLongitude) {
    const latitude = hasLatitude ? toFiniteNumber(payload.latitude) : null;
    const longitude = hasLongitude ? toFiniteNumber(payload.longitude) : null;

    if (latitude === null || longitude === null) {
      throw new Error('Latitude and longitude must both be valid numbers when updating location.');
    }

    assertValidLatitudeLongitude(latitude, longitude);
    updatePayload.latitude = latitude;
    updatePayload.longitude = longitude;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No parking spot fields to update.');
  }

  return updatePayload;
}

export async function fetchStampDetail(accessToken: string, stampId: string, currentUserId?: string) {
  const [{ stamp, stampings, myNote }, neighborStampRows, neighborParkingRows, friendships] = await Promise.all([
    fetchStampWithRecentStampings(accessToken, stampId, currentUserId),
    fetchGuidFilteredCollection<NeighborStampRow>(accessToken, 'NeighborsStampStamp', 'ID', stampId, {
      orderBy: 'distanceKm asc',
      top: 3,
      expand: {
        neighborStamp: {
          select: ['ID', 'number', 'name', 'heroImageUrl', 'image', 'imageCaption'],
        },
      },
    }),
    fetchGuidFilteredCollection<NeighborParkingRow>(accessToken, 'NeighborsStampParking', 'ID', stampId, {
      orderBy: 'distanceKm asc',
      top: 3,
      expand: {
        neighborParking: {
          select: ['ID', 'name'],
        },
      },
    }),
    fetchCollection<MyFriend>(accessToken, 'MyFriends', {
      select: ['ID', 'name', 'picture', 'status'],
    }),
  ]);
  const friends = friendships.filter((friend) => friend.status === 'accepted');

  const expandedStampById = new Map(
    neighborStampRows
      .map((neighbor) => neighbor.neighborStamp)
      .filter(
        (neighborStamp): neighborStamp is NonNullable<NeighborStampRow['neighborStamp']> =>
          Boolean(neighborStamp?.ID)
      )
      .map((neighborStamp) => [safeNormalizedText(neighborStamp.ID), neighborStamp])
  );
  const expandedParkingById = new Map(
    neighborParkingRows
      .map((neighbor) => neighbor.neighborParking)
      .filter(
        (neighborParking): neighborParking is NonNullable<NeighborParkingRow['neighborParking']> =>
          Boolean(neighborParking?.ID)
      )
      .map((neighborParking) => [safeNormalizedText(neighborParking.ID), neighborParking])
  );
  const missingNeighborStampIds = neighborStampRows
    .map((neighbor) => neighbor.NeighborsID)
    .filter((neighborId) => !expandedStampById.has(safeNormalizedText(neighborId)));
  const missingNeighborParkingIds = neighborParkingRows
    .map((neighbor) => neighbor.NeighborsID)
    .filter((neighborId) => !expandedParkingById.has(safeNormalizedText(neighborId)));

  const [missingRelatedStamps, missingRelatedParkingSpots, routeMetricsByNeighbor] =
    await Promise.all([
      fetchGuidEntitiesByIds<Stampbox>(
        accessToken,
        'Stampboxes',
        'ID',
        missingNeighborStampIds,
        {
          select: ['ID', 'number', 'name', 'heroImageUrl', 'image', 'imageCaption'],
        }
      ),
      fetchGuidEntitiesByIds<ParkingSpot>(
        accessToken,
        'ParkingSpots',
        'ID',
        missingNeighborParkingIds,
        {
          select: ['ID', 'name'],
        }
      ),
      fetchRouteMetricsByTargets(
        accessToken,
        stampId,
        [...neighborStampRows, ...neighborParkingRows].map((neighbor) => ({
          toPoiId: neighbor.NeighborsID,
          fallbackDistanceKm: typeof neighbor.distanceKm === 'number' ? neighbor.distanceKm : null,
        }))
      ),
    ]);
  const relatedStampById = new Map([...expandedStampById.entries()]);
  for (const relatedStamp of missingRelatedStamps) {
    relatedStampById.set(safeNormalizedText(relatedStamp.ID), relatedStamp);
  }
  const relatedParkingById = new Map([...expandedParkingById.entries()]);
  for (const relatedParkingSpot of missingRelatedParkingSpots) {
    relatedParkingById.set(safeNormalizedText(relatedParkingSpot.ID), relatedParkingSpot);
  }

  const nearbyStamps = neighborStampRows
    .map((neighbor) => {
      const neighborKey = safeNormalizedText(neighbor.NeighborsID);
      const relatedStamp = relatedStampById.get(neighborKey);
      const routeMetrics =
        routeMetricsByNeighbor.get(neighborKey) ??
        createFallbackRouteMetrics(
          typeof neighbor.distanceKm === 'number' && Number.isFinite(neighbor.distanceKm)
            ? neighbor.distanceKm
            : null
        );

      return {
        ID: relatedStamp?.ID || neighbor.NeighborsID,
        number: relatedStamp?.number || neighbor.NeighborsNumber,
        name: relatedStamp?.name || `${neighbor.NeighborsNumber || ''}`.trim(),
        heroImageUrl: relatedStamp?.heroImageUrl || relatedStamp?.image,
        imageCaption: relatedStamp?.imageCaption,
        distanceKm: routeMetrics.distanceKm,
        durationMinutes: routeMetrics.durationMinutes,
        elevationGainMeters: routeMetrics.elevationGainMeters,
        elevationLossMeters: routeMetrics.elevationLossMeters,
      };
    })
    .filter((item) => item.ID !== stamp.ID);

  const nearbyParking = neighborParkingRows.map((neighbor) => {
    const neighborKey = safeNormalizedText(neighbor.NeighborsID);
    const relatedParking = relatedParkingById.get(neighborKey);
    const routeMetrics =
      routeMetricsByNeighbor.get(neighborKey) ??
      createFallbackRouteMetrics(
        typeof neighbor.distanceKm === 'number' && Number.isFinite(neighbor.distanceKm)
          ? neighbor.distanceKm
          : null
      );

    return {
      ID: relatedParking?.ID || neighbor.NeighborsID,
      name: relatedParking?.name || 'Parkplatz',
      distanceKm: routeMetrics.distanceKm,
      durationMinutes: routeMetrics.durationMinutes,
      elevationGainMeters: routeMetrics.elevationGainMeters,
      elevationLossMeters: routeMetrics.elevationLossMeters,
    };
  });

  const friendMap = new Map(friends.map((friend) => [friend.ID, friend]));
  const myVisits = stampings.filter((stamping) => stamping.createdBy === currentUserId);
  const latestFriendStampings = new Map<string, Stamping>();

  for (const stamping of stampings) {
    if (!stamping.createdBy || stamping.createdBy === currentUserId || !friendMap.has(stamping.createdBy)) {
      continue;
    }

    const current = latestFriendStampings.get(stamping.createdBy);
    const nextTimestamp = getVisitTimestamp(stamping);
    const currentTimestamp = current ? getVisitTimestamp(current) : undefined;

    if (
      !current ||
      new Date(nextTimestamp || 0).getTime() > new Date(currentTimestamp || 0).getTime()
    ) {
      latestFriendStampings.set(stamping.createdBy, stamping);
    }
  }

  const friendIds = friends.map((friend) => friend.ID);
  const endpointFriendVisits = await fetchStampFriendVisits(accessToken, stampId, friendIds).catch(() => []);

  for (const visit of endpointFriendVisits) {
    if (!visit?.friendId || !friendMap.has(visit.friendId)) {
      continue;
    }

    const incomingStamping = {
      ID: visit.stampingId || `group-${stampId}-${visit.friendId}`,
      createdBy: visit.friendId,
      stamp_ID: stampId,
      visitedAt: visit.visitedAt || undefined,
      createdAt: visit.createdAt || visit.timestamp || undefined,
    } satisfies Stamping;

    const current = latestFriendStampings.get(visit.friendId);
    const nextTimestamp = getVisitTimestamp(incomingStamping);
    const currentTimestamp = current ? getVisitTimestamp(current) : undefined;
    if (
      !current ||
      new Date(nextTimestamp || 0).getTime() > new Date(currentTimestamp || 0).getTime()
    ) {
      latestFriendStampings.set(visit.friendId, incomingStamping);
    }
  }

  const unresolvedFriendIds = friendIds.filter((friendId) => !latestFriendStampings.has(friendId));
  if (unresolvedFriendIds.length > 0) {
    const fallbackStampings = await fetchLatestStampingsForStampAndUsers(
      accessToken,
      stampId,
      unresolvedFriendIds
    );
    for (const [friendId, stamping] of fallbackStampings.entries()) {
      latestFriendStampings.set(friendId, stamping);
    }
  }

  const friendVisits = Array.from(latestFriendStampings.entries())
    .map(([friendId, stamping]) => {
      const friend = friendMap.get(friendId);

      return {
        id: stamping.ID,
        name: friend?.name || friendId || 'Freund',
        picture: friend?.picture,
        createdAt: getVisitTimestamp(stamping),
      };
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    );

  return {
    stamp,
    nearbyStamps,
    nearbyParking,
    friendVisits,
    myVisits,
    myNote,
  } satisfies StampDetailData;
}

export async function fetchParkingDetail(accessToken: string, parkingId: string) {
  const parking = await fetchEntityById<ParkingSpot>(accessToken, 'ParkingSpots', parkingId, [
    ['$select', 'ID,name,description,image,latitude,longitude'],
  ]);

  const [neighborStampRows, neighborParkingRows] = await Promise.all([
    fetchGuidFilteredCollection<NeighborStampRow>(accessToken, 'NeighborsParkingStamp', 'ID', parkingId, {
      orderBy: 'distanceKm asc',
      top: 3,
      expand: {
        neighborStamp: {
          select: ['ID', 'number', 'name', 'heroImageUrl', 'image', 'imageCaption'],
        },
      },
    }),
    fetchGuidFilteredCollection<NeighborParkingRow>(
      accessToken,
      'NeighborsParkingParking',
      'ID',
      parkingId,
      {
        orderBy: 'distanceKm asc',
        top: 3,
        expand: {
          neighborParking: {
            select: ['ID', 'name'],
          },
        },
      }
    ),
  ]);

  const expandedStampById = new Map(
    neighborStampRows
      .map((neighbor) => neighbor.neighborStamp)
      .filter(
        (neighborStamp): neighborStamp is NonNullable<NeighborStampRow['neighborStamp']> =>
          Boolean(neighborStamp?.ID)
      )
      .map((neighborStamp) => [safeNormalizedText(neighborStamp.ID), neighborStamp])
  );
  const expandedParkingById = new Map(
    neighborParkingRows
      .map((neighbor) => neighbor.neighborParking)
      .filter(
        (neighborParking): neighborParking is NonNullable<NeighborParkingRow['neighborParking']> =>
          Boolean(neighborParking?.ID)
      )
      .map((neighborParking) => [safeNormalizedText(neighborParking.ID), neighborParking])
  );
  const missingNeighborStampIds = neighborStampRows
    .map((neighbor) => neighbor.NeighborsID)
    .filter((neighborId) => !expandedStampById.has(safeNormalizedText(neighborId)));
  const missingNeighborParkingIds = neighborParkingRows
    .map((neighbor) => neighbor.NeighborsID)
    .filter((neighborId) => !expandedParkingById.has(safeNormalizedText(neighborId)));

  const [missingRelatedStamps, missingRelatedParkingSpots, routeMetricsByNeighbor] =
    await Promise.all([
      fetchGuidEntitiesByIds<Stampbox>(
        accessToken,
        'Stampboxes',
        'ID',
        missingNeighborStampIds,
        {
          select: ['ID', 'number', 'name', 'heroImageUrl', 'image', 'imageCaption'],
        }
      ),
      fetchGuidEntitiesByIds<ParkingSpot>(
        accessToken,
        'ParkingSpots',
        'ID',
        missingNeighborParkingIds,
        {
          select: ['ID', 'name'],
        }
      ),
      fetchRouteMetricsByTargets(
        accessToken,
        parkingId,
        [...neighborStampRows, ...neighborParkingRows].map((neighbor) => ({
          toPoiId: neighbor.NeighborsID,
          fallbackDistanceKm: typeof neighbor.distanceKm === 'number' ? neighbor.distanceKm : null,
        }))
      ),
    ]);
  const relatedStampById = new Map([...expandedStampById.entries()]);
  for (const relatedStamp of missingRelatedStamps) {
    relatedStampById.set(safeNormalizedText(relatedStamp.ID), relatedStamp);
  }
  const relatedParkingById = new Map([...expandedParkingById.entries()]);
  for (const relatedParkingSpot of missingRelatedParkingSpots) {
    relatedParkingById.set(safeNormalizedText(relatedParkingSpot.ID), relatedParkingSpot);
  }

  const nearbyStamps = neighborStampRows.map((neighbor) => {
    const neighborKey = safeNormalizedText(neighbor.NeighborsID);
    const relatedStamp = relatedStampById.get(neighborKey);
    const routeMetrics =
      routeMetricsByNeighbor.get(neighborKey) ??
      createFallbackRouteMetrics(
        typeof neighbor.distanceKm === 'number' && Number.isFinite(neighbor.distanceKm)
          ? neighbor.distanceKm
          : null
      );

    return {
      ID: relatedStamp?.ID || neighbor.NeighborsID,
      number: relatedStamp?.number || neighbor.NeighborsNumber,
      name:
        relatedStamp?.name ||
        (neighbor.NeighborsNumber ? `Stempel ${neighbor.NeighborsNumber}` : 'Stempelstelle'),
      heroImageUrl: relatedStamp?.heroImageUrl || relatedStamp?.image,
      imageCaption: relatedStamp?.imageCaption,
      distanceKm: routeMetrics.distanceKm,
      durationMinutes: routeMetrics.durationMinutes,
      elevationGainMeters: routeMetrics.elevationGainMeters,
      elevationLossMeters: routeMetrics.elevationLossMeters,
    };
  });

  const nearbyParking = neighborParkingRows
    .map((neighbor) => {
      const neighborKey = safeNormalizedText(neighbor.NeighborsID);
      const relatedParking = relatedParkingById.get(neighborKey);
      const routeMetrics =
        routeMetricsByNeighbor.get(neighborKey) ??
        createFallbackRouteMetrics(
          typeof neighbor.distanceKm === 'number' && Number.isFinite(neighbor.distanceKm)
            ? neighbor.distanceKm
            : null
        );

      return {
        ID: relatedParking?.ID || neighbor.NeighborsID,
        name: relatedParking?.name || 'Parkplatz',
        distanceKm: routeMetrics.distanceKm,
        durationMinutes: routeMetrics.durationMinutes,
        elevationGainMeters: routeMetrics.elevationGainMeters,
        elevationLossMeters: routeMetrics.elevationLossMeters,
      };
    })
    .filter((item) => item.ID !== parking.ID);

  return {
    parking,
    nearbyStamps,
    nearbyParking,
  } satisfies ParkingDetailData;
}

export async function fetchRouteToStampFromPosition(
  accessToken: string,
  payload: {
    stampId: string;
    latitude: number;
    longitude: number;
  }
) {
  const response = await mutateOData<unknown>(accessToken, buildUrl('getRouteToStampFromPosition'), {
    method: 'POST',
    body: JSON.stringify({
      stampId: safeTrim(payload.stampId),
      latitude: payload.latitude,
      longitude: payload.longitude,
    }),
  });

  const parsed = parseODataFunctionResult<unknown>(response, 'getRouteToStampFromPosition');
  const result = parsed as Partial<RouteToStampFromPositionData> | null;

  return {
    distanceMeters: Number(result?.distanceMeters) || 0,
    durationSeconds: Number(result?.durationSeconds) || 0,
    elevationGainMeters: Number(result?.elevationGainMeters) || 0,
    elevationLossMeters: Number(result?.elevationLossMeters) || 0,
  } satisfies RouteToStampFromPositionData;
}

export async function fetchProfileOverview(
  accessToken: string,
  currentUserId?: string,
  prefetchedCurrentUser?: {
    id: string;
    name?: string;
    picture?: string;
  } | null,
  prefetchedStamps?: Stampbox[]
) {
  const resolvedCurrentUserId = safeTrim(currentUserId || prefetchedCurrentUser?.id);
  const [currentUser, stamps, stampings, friendships] = await Promise.all([
    prefetchedCurrentUser?.id
      ? Promise.resolve({
          ID: prefetchedCurrentUser.id,
          name: prefetchedCurrentUser.name,
          picture: prefetchedCurrentUser.picture,
        } satisfies User)
      : fetchCurrentUserRecord(accessToken),
    prefetchedStamps ? Promise.resolve(prefetchedStamps) : fetchStampboxes(accessToken),
    resolvedCurrentUserId
      ? fetchCollection<Stamping>(accessToken, 'Stampings', {
          select: ['ID', 'visitedAt', 'createdAt', 'createdBy', 'stamp_ID'],
          filter: buildStringEqualsFilter('createdBy', resolvedCurrentUserId),
          orderBy: 'visitedAt desc,createdAt desc',
          top: 250,
        })
      : Promise.resolve([] as Stamping[]),
    fetchCollection<MyFriend>(accessToken, 'MyFriends', {
      select: ['ID', 'name', 'picture', 'status'],
    }),
  ]);
  const friends = friendships.filter((friend) => friend.status === 'accepted');

  const stampMap = new Map(stamps.map((stamp) => [stamp.ID, stamp]));
  const myStampings = stampings;
  const sortedVisits = myStampings
    .slice()
    .sort((left, right) => {
      const leftTime = getVisitTimestamp(left);
      const rightTime = getVisitTimestamp(right);
      return new Date(rightTime || 0).getTime() - new Date(leftTime || 0).getTime();
    });
  const timelineVisits = sortedVisits.slice(0, 250).map((visit) => {
    const stamp = visit.stamp_ID ? stampMap.get(visit.stamp_ID) : undefined;
    return {
      id: visit.ID,
      stampId: visit.stamp_ID || '',
      stampNumber: stamp?.number,
      stampName: stamp?.name || 'Stempelstelle',
      visitedAt: getVisitTimestamp(visit),
      heroImageUrl: stamp?.heroImageUrl || stamp?.image,
    };
  });
  const latestVisits = timelineVisits.slice(0, 3);

  const earliestVisit = sortedVisits[sortedVisits.length - 1];
  const visitedCount = stamps.filter((stamp) => stamp.hasVisited).length;
  const totalCount = stamps.length;
  const openCount = Math.max(0, totalCount - visitedCount);
  const completionPercent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;
  const mappedFriends = await buildFriendProgress(accessToken, friends, totalCount);
  const featuredFriend = mappedFriends[0]
    ? {
        id: mappedFriends[0].id,
        name: mappedFriends[0].name,
        picture: mappedFriends[0].picture,
        visitedCount: mappedFriends[0].visitedCount,
        completionPercent: mappedFriends[0].completionPercent,
      }
    : null;
  return {
    name: currentUser.name || currentUser.ID,
    picture: currentUser.picture,
    visitedCount,
    totalCount,
    openCount,
    completionPercent,
    friendCount: friends.length,
    collectorSinceYear: earliestVisit ? new Date(getVisitTimestamp(earliestVisit) || '').getFullYear() : null,
    latestVisits,
    stampings: timelineVisits,
    featuredFriend,
    friends: mappedFriends,
    stamps,
    achievements: [
      {
        id: 'forest-runner',
        label: 'Waldlaeufer',
        value: `${visitedCount} Stempel`,
      },
      {
        id: 'early-starter',
        label: 'Fruehstarter',
        value: `${myStampings.length} Besuche`,
      },
    ],
  } satisfies ProfileOverviewData;
}

export async function fetchUserProfileOverview(accessToken: string, targetUserId: string) {
  const [targetUser, currentUser] = await Promise.all([
    fetchStringEntityById<User>(accessToken, 'Users', 'ID', targetUserId, [['$select', 'ID,name,picture,isFriend']]),
    fetchOData<User>(accessToken, buildUrl('getCurrentUser()')),
  ]);

  const [stamps, comparisonStamps, targetStampings, friendships, pendingRequests, visibleFriends] =
    await Promise.all([
      fetchStampboxes(accessToken),
      fetchComparisonStampboxes(accessToken, [currentUser.ID, targetUserId]),
      fetchCollection<Stamping>(accessToken, 'Stampings', {
        select: ['ID', 'visitedAt', 'createdAt', 'createdBy', 'stamp_ID'],
        filter: buildStringEqualsFilter('createdBy', targetUserId),
        orderBy: 'visitedAt desc,createdAt desc',
        top: 250,
      }),
      fetchCollection<MyFriend>(accessToken, 'MyFriends', {
        select: [
          'ID',
          'name',
          'picture',
          'FriendshipID',
          'status',
          'isAllowedToStampForMe',
          'isAllowedToStampForFriend',
        ],
      }),
      fetchCollection<PendingFriendshipRequest>(accessToken, 'PendingFriendshipRequests', {
        select: ['ID', 'fromUser_ID', 'toUser_ID', 'outgoingFriendship_ID'],
        expand: {
          fromUser: { select: ['ID', 'name', 'picture'] },
          toUser: { select: ['ID', 'name', 'picture'] },
        },
      }),
      fetchUserFriends(accessToken, targetUserId),
    ]);

  if (currentUser.ID === targetUser.ID) {
    return {
      userId: targetUser.ID,
      name: targetUser.name || targetUser.ID,
      picture: targetUser.picture,
      relationship: 'self',
      friendshipId: null,
      pendingRequestId: null,
      isAllowedToStampForMe: false,
      visitedCount: 0,
      completionPercent: 0,
      sharedVisitedCount: 0,
      collectorSinceYear: null,
      latestVisits: [],
      stampings: [],
      friends: [],
      achievements: [],
      stampBuckets: { shared: 0, friendOnly: 0, meOnly: 0, neither: 0 },
      stampComparisons: [],
    } satisfies UserProfileOverviewData;
  }

  const friendMatch = friendships.find(
    (friend) => friend.ID === targetUser.ID && friend.status === 'accepted'
  );
  const outgoingPendingMatch = friendships.find(
    (friend) => friend.ID === targetUser.ID && friend.status === 'pending'
  );
  const incomingPendingMatch = pendingRequests.find(
    (request) => request.fromUser_ID === currentUser.ID && request.toUser_ID === targetUser.ID
  );
  const relationship: FriendshipRelationshipState = friendMatch
    ? 'friend'
    : incomingPendingMatch
      ? 'incoming_request'
      : outgoingPendingMatch
        ? 'outgoing_request'
        : 'not_connected';

  const friendshipId = friendMatch?.FriendshipID || outgoingPendingMatch?.FriendshipID || null;
  const pendingRequestId = incomingPendingMatch?.ID || null;

  const targetVisitedCount = stamps.reduce(
    (count, stamp) => count + (stampContainsUser(stamp, targetUser) ? 1 : 0),
    0
  );
  const sharedVisitedCount = stamps.reduce(
    (count, stamp) => count + (Boolean(stamp.hasVisited) && stampContainsUser(stamp, targetUser) ? 1 : 0),
    0
  );
  const totalCount = stamps.length;
  const sortedTargetStampings = targetStampings
    .slice()
    .sort(
      (left, right) =>
        new Date(getVisitTimestamp(right) || 0).getTime() -
        new Date(getVisitTimestamp(left) || 0).getTime()
    );
  const stampings = sortedTargetStampings.slice(0, 250).map((visit) => {
    const stamp = visit.stamp_ID ? stamps.find((item) => item.ID === visit.stamp_ID) : undefined;
    return {
      id: visit.ID,
      stampId: visit.stamp_ID || '',
      stampNumber: stamp?.number,
      stampName: stamp?.name || 'Stempelstelle',
      visitedAt: getVisitTimestamp(visit),
      heroImageUrl: stamp?.heroImageUrl || stamp?.image,
    };
  });
  const latestVisitsFromStampings = stampings.slice(0, 3);
  const fallbackLatestVisits =
    latestVisitsFromStampings.length > 0
      ? latestVisitsFromStampings
      : comparisonStamps
          .filter((stamp) => stampContainsUser(stamp, targetUser))
          .slice(0, 3)
          .map((stamp) => ({
            id: `fallback-${stamp.ID}`,
            stampId: stamp.ID,
            stampNumber: stamp.number,
            stampName: stamp.name || 'Stempelstelle',
            visitedAt: undefined,
            heroImageUrl: stamp.heroImageUrl || stamp.image,
          }));
  const latestVisits = await enrichLatestVisitsWithFriendVisitDates(
    accessToken,
    targetUser.ID,
    fallbackLatestVisits
  );

  const earliestVisit = sortedTargetStampings[sortedTargetStampings.length - 1];
  const mappedVisibleFriends = await buildFriendProgress(
    accessToken,
    visibleFriends.map((friend) => ({
      ID: friend.ID,
      name: friend.name,
      picture: friend.picture,
    })),
    totalCount
  );
  const stampComparisons = comparisonStamps.map((stamp) => ({
    stamp,
    meVisited: !!stamp.hasVisited,
    userVisited: stampContainsUser(stamp, targetUser),
  }));

  return {
    userId: targetUser.ID,
    name: targetUser.name || targetUser.ID,
    picture: targetUser.picture,
    relationship,
    friendshipId,
    pendingRequestId,
    isAllowedToStampForMe: !!friendMatch?.isAllowedToStampForMe,
    visitedCount: targetVisitedCount,
    completionPercent: totalCount > 0 ? Math.round((targetVisitedCount / totalCount) * 100) : 0,
    sharedVisitedCount,
    collectorSinceYear: earliestVisit ? new Date(getVisitTimestamp(earliestVisit) || '').getFullYear() : null,
    latestVisits,
    stampings,
    friends: mappedVisibleFriends,
    achievements: [
      {
        id: 'forest-runner',
        label: 'Waldlaeufer',
        value: `${targetVisitedCount} Stempel`,
      },
      {
        id: 'shared-hikes',
        label: 'Gemeinsam',
        value: `${sharedVisitedCount} zusammen`,
      },
    ],
    stampBuckets: {
      shared: stampComparisons.filter((item) => item.meVisited && item.userVisited).length,
      friendOnly: stampComparisons.filter((item) => !item.meVisited && item.userVisited).length,
      meOnly: stampComparisons.filter((item) => item.meVisited && !item.userVisited).length,
      neither: stampComparisons.filter((item) => !item.meVisited && !item.userVisited).length,
    },
    stampComparisons,
  } satisfies UserProfileOverviewData;
}

export async function fetchFriendsOverview(accessToken: string, currentUserId?: string) {
  const [friendships, pendingRequests] = await Promise.all([
    fetchCollection<MyFriend>(accessToken, 'MyFriends', {
      select: [
        'ID',
        'name',
        'picture',
        'FriendshipID',
        'status',
        'isAllowedToStampForMe',
        'isAllowedToStampForFriend',
      ],
    }),
    fetchCollection<PendingFriendshipRequest>(accessToken, 'PendingFriendshipRequests', {
      select: ['ID', 'fromUser_ID', 'toUser_ID', 'outgoingFriendship_ID'],
      expand: {
        fromUser: { select: ['ID', 'name', 'picture'] },
        toUser: { select: ['ID', 'name', 'picture'] },
      },
    }),
  ]);

  const acceptedFriendships = friendships.filter((friend) => friend.status === 'accepted');
  const pendingSentFriendships = friendships.filter((friend) => friend.status === 'pending');
  const mappedFriends = await buildFriendProgress(accessToken, acceptedFriendships);

  const resolvedCurrentUserId = currentUserId || (await fetchCurrentUserRecord(accessToken)).ID;
  const incomingRequests = pendingRequests
    .filter((request) => request.fromUser_ID === resolvedCurrentUserId)
    .map((request) => ({
      id: request.ID,
      pendingRequestId: request.ID,
      userId: request.toUser_ID || request.toUser?.ID || request.ID,
      name: request.toUser?.name || 'Unbekannter Nutzer',
      picture: request.toUser?.picture,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const outgoingRequests = pendingSentFriendships
    .map((friendship) => ({
      id: friendship.FriendshipID || friendship.ID,
      friendshipId: friendship.FriendshipID || friendship.ID,
      userId: friendship.ID,
      name: friendship.name || friendship.ID,
      picture: friendship.picture,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    currentUserId: resolvedCurrentUserId,
    friendCount: mappedFriends.length,
    incomingRequestCount: incomingRequests.length,
    outgoingRequestCount: outgoingRequests.length,
    friends: mappedFriends,
    incomingRequests,
    outgoingRequests,
  } satisfies FriendsOverviewData;
}

export async function acceptPendingFriendshipRequest(accessToken: string, pendingRequestId: string) {
  return mutateOData<string>(accessToken, buildUrl('acceptPendingFriendshipRequest'), {
    method: 'POST',
    body: JSON.stringify({
      FriendshipID: pendingRequestId,
    }),
  });
}

export async function searchPlacesByName(
  accessToken: string,
  payload: {
    query: string;
    latitude?: number;
    longitude?: number;
    limit?: number;
  }
) {
  const query = payload.query.trim();
  if (!query) {
    return [] as PlaceSearchResult[];
  }

  const response = await mutateOData<unknown>(accessToken, buildUrl('searchPlacesByName'), {
    method: 'POST',
    body: JSON.stringify({
      query,
      latitude: payload.latitude,
      longitude: payload.longitude,
      limit: payload.limit,
    }),
  });
  const parsed = parseODataFunctionResult<{ value: PlaceSearchResult[] }>(response, 'searchPlacesByName').value;
  if (!Array.isArray(parsed)) {
    return [] as PlaceSearchResult[];
  }

  return parsed
    .map((row) => normalizePlaceSearchResultRow(row))
    .filter((row): row is PlaceSearchResult => Boolean(row));
}

export async function searchUsers(accessToken: string, rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) {
    return [] as SearchUserResult[];
  }

  const normalizedQuery = query.toLowerCase();
  const escapedNormalizedQuery = escapeODataString(normalizedQuery);
  const escapedQuery = escapeODataString(query);
  const filters = [
    `contains(tolower(name),'${escapedNormalizedQuery}') or startswith(tolower(name),'${escapedNormalizedQuery}') or contains(tolower(ID),'${escapedNormalizedQuery}')`,
    `contains(name,'${escapedQuery}') or startswith(name,'${escapedQuery}')`,
  ];

  for (const filter of filters) {
    try {
      const users = await fetchCollection<User>(accessToken, 'Users', {
        select: ['ID', 'name', 'picture', 'isFriend'],
        filter,
        top: 12,
      });

      if (users.length === 0) {
        continue;
      }

      return attachUserProgress(
        accessToken,
        users.map((user) => ({
          id: user.ID,
          name: user.name || user.ID,
          picture: user.picture,
          isFriend: !!user.isFriend,
        }))
      );
    } catch {
      continue;
    }
  }

  const users = await fetchCollection<User>(accessToken, 'Users', {
    select: ['ID', 'name', 'picture', 'isFriend'],
    top: 50,
  });

  return attachUserProgress(
    accessToken,
    users
      .filter((user) => {
        const name = (user.name || '').toLowerCase();
        const id = user.ID.toLowerCase();
        return name.includes(normalizedQuery) || id.includes(normalizedQuery);
      })
      .slice(0, 12)
      .map((user) => ({
        id: user.ID,
        name: user.name || user.ID,
        picture: user.picture,
        isFriend: !!user.isFriend,
      }))
  );
}

export async function createStampbox(accessToken: string, payload: AdminStampboxMutationInput) {
  const normalizedPayload = normalizeAdminStampboxCreatePayload(payload);

  return mutateOData<Stampbox>(accessToken, buildUrl('Stampboxes'), {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  });
}

export async function updateStampbox(
  accessToken: string,
  stampId: string,
  payload: Partial<AdminStampboxMutationInput>
) {
  const normalizedStampId = safeTrim(stampId);
  if (!normalizedStampId) {
    throw new Error('Stampbox ID is required.');
  }

  const normalizedPayload = normalizeAdminStampboxUpdatePayload(payload);

  return mutateOData<Stampbox>(accessToken, buildUrl(`Stampboxes(${normalizedStampId})`), {
    method: 'PATCH',
    body: JSON.stringify(normalizedPayload),
  });
}

export async function createParkingSpot(accessToken: string, payload: AdminParkingSpotMutationInput) {
  const normalizedPayload = normalizeAdminParkingSpotCreatePayload(payload);

  return mutateOData<ParkingSpot>(accessToken, buildUrl('ParkingSpots'), {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  });
}

export async function updateParkingSpot(
  accessToken: string,
  parkingSpotId: string,
  payload: Partial<AdminParkingSpotMutationInput>
) {
  const normalizedParkingSpotId = safeTrim(parkingSpotId);
  if (!normalizedParkingSpotId) {
    throw new Error('Parking spot ID is required.');
  }

  const normalizedPayload = normalizeAdminParkingSpotUpdatePayload(payload);

  return mutateOData<ParkingSpot>(accessToken, buildUrl(`ParkingSpots(${normalizedParkingSpotId})`), {
    method: 'PATCH',
    body: JSON.stringify(normalizedPayload),
  });
}

export async function deleteSpotWithRoutes(accessToken: string, spotId: string) {
  const normalizedSpotId = safeTrim(spotId);
  if (!normalizedSpotId) {
    throw new Error('Spot ID is required.');
  }

  const payload = await mutateOData<unknown>(accessToken, buildUrl('DeleteSpotWithRoutes'), {
    method: 'POST',
    body: JSON.stringify({
      SpotId: normalizedSpotId,
    }),
  });

  return parseActionStringResult(payload);
}

export async function getMissingTravelTimesCount(accessToken: string, n?: number) {
  const payload = await fetchOData<unknown>(
    accessToken,
    buildUrl('getMissingTravelTimesCount', typeof n === 'number' ? [['n', n]] : undefined)
  );

  const parsed = parseODataFunctionResult<unknown>(payload, 'getMissingTravelTimesCount');
  return unwrapNumericODataResult(parsed) ?? 0;
}

export async function calculateTravelTimesNNearestNeighbors(accessToken: string, n?: number) {
  const payload = await fetchOData<unknown>(
    accessToken,
    buildUrl('calculateTravelTimesNNearestNeighbors', typeof n === 'number' ? [['n', n]] : undefined)
  );

  const parsed = parseODataFunctionResult<unknown>(payload, 'calculateTravelTimesNNearestNeighbors');
  return unwrapNumericODataResult(parsed) ?? 0;
}

export async function addElevationToAllTravelTimes(accessToken: string) {
  const payload = await fetchOData<unknown>(accessToken, buildUrl('addElevationToAllTravelTimes'));
  const parsed = parseODataFunctionResult<unknown>(payload, 'addElevationToAllTravelTimes');
  return parseActionStringResult(parsed);
}

export async function createFriendRequest(accessToken: string, userId: string) {
  return mutateOData<string>(accessToken, buildUrl('Friendships'), {
    method: 'POST',
    body: JSON.stringify({
      toUser_ID: userId,
    }),
  });
}

export async function updateCurrentUserProfile(
  accessToken: string,
  updates: {
    name?: string;
    picture?: string;
  }
) {
  const currentUser = await fetchCurrentUserRecord(accessToken);

  return mutateOData<User>(accessToken, buildUrl(buildStringKeyPath('Users', currentUser.ID)), {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function uploadAttachment(
  accessToken: string,
  file: UploadableImage
) {
  const attachment = await mutateOData<Attachment>(accessToken, buildUrl('Attachments'), {
    method: 'POST',
    body: JSON.stringify({
      filename: file.fileName,
      mimeType: file.mimeType,
    }),
  });

  const fileResponse = await fetch(file.uri);
  const fileBlob = await fileResponse.blob();
  const contentUrl = buildV2Url(`Attachments/${attachment.ID}/content`);
  const uploadResponse = await fetch(contentUrl, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.mimeType,
    },
    body: fileBlob,
  });

  if (uploadResponse.status === 401) {
    const error = new Error('Unauthorized');
    error.name = 'UnauthorizedError';
    throw error;
  }

  if (!uploadResponse.ok) {
    const errorBody = await readErrorBody(uploadResponse);
    throw new HttpStatusError(
      uploadResponse.status,
      errorBody || `Request failed with status ${uploadResponse.status}`,
      errorBody
    );
  }

  return {
    id: attachment.ID,
    url: contentUrl,
  };
}

export async function uploadProfileImage(accessToken: string, file: UploadableImage) {
  const preparedFile = await prepareProfileImageForUpload(file);
  return uploadAttachment(accessToken, preparedFile);
}

export async function updateFriendshipPermission(
  accessToken: string,
  friendshipId: string,
  isAllowedToStampForFriend: boolean
) {
  return mutateOData<string>(accessToken, buildUrl(`Friendships(${friendshipId})`), {
    method: 'PATCH',
    body: JSON.stringify({
      isAllowedToStampForFriend,
    }),
  });
}

export async function removeFriendship(accessToken: string, friendshipId: string) {
  if (!friendshipId) {
    throw new Error('Friendship ID is required');
  }

  return mutateOData<null>(accessToken, buildUrl(`Friendships(${friendshipId})`), {
    method: 'DELETE',
  });
}

export async function createStamping(accessToken: string, stampId: string) {
  return mutateOData<Stamping>(accessToken, buildUrl('Stampings'), {
    method: 'POST',
    body: JSON.stringify({
      stamp: {
        ID: stampId,
      },
    }),
  });
}

export async function upsertStampNote(accessToken: string, stampId: string, note: string) {
  return mutateOData<StampNote>(accessToken, buildUrl('StampNotes'), {
    method: 'POST',
    body: JSON.stringify({
      stamp: {
        ID: stampId,
      },
      note,
    }),
  });
}

export async function updateStamping(accessToken: string, stampingId: string, visitedAt: string) {
  return mutateOData<Stamping>(accessToken, buildUrl(`Stampings(${stampingId})`), {
    method: 'PATCH',
    body: JSON.stringify({
      visitedAt,
    }),
  });
}

export async function deleteStamping(accessToken: string, stampingId: string) {
  return mutateOData<null>(accessToken, buildUrl(`Stampings(${stampingId})`), {
    method: 'DELETE',
  });
}
