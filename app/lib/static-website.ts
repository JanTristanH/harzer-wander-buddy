/** The website builds the real app and replaces only its public data boundary. */
import { Platform } from 'react-native';
import type { ParkingSpot, Stampbox, StampboxFetchMode } from '@/lib/api';

export const isStaticWebsite = Platform.OS === 'web' && process.env.EXPO_PUBLIC_DATA_MODE === 'static';
export const staticWebsiteBasePath = process.env.EXPO_PUBLIC_STATIC_BASE_PATH || '/preview/overview/app';
export const liveAppLoginUrl = 'https://app.harzer-wander-buddy.de/app/rnweb/login';

type CatalogueStamp = {
  id: string; number: number; name: string; description: string;
  latitude: number; longitude: number; validFrom: string; validTo: string;
  heroImageUrl?: string; imageCaption?: string; articleUrl: string;
};
type Catalogue = { schemaVersion: number; stamps: CatalogueStamp[]; parkingSpots: ParkingSpot[] };
let cataloguePromise: Promise<Catalogue> | undefined;

function validateCatalogue(data: Catalogue): Catalogue {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.stamps) || !Array.isArray(data.parkingSpots)) {
    throw new Error('Unbekanntes Format des öffentlichen Stempelstellen-Katalogs.');
  }
  return data;
}

export function loadStaticCatalogue(): Promise<Catalogue> {
  // Private Sites may require authentication for every JSON/font request.
  // The preview packager embeds this public catalogue in the HTML document.
  const embedded = isStaticWebsite && typeof window !== 'undefined'
    ? (window as Window & { __HWB_STATIC_CATALOGUE__?: Catalogue }).__HWB_STATIC_CATALOGUE__
    : undefined;
  if (embedded !== undefined) {
    return Promise.resolve().then(() => validateCatalogue(embedded));
  }
  if (!cataloguePromise) {
    cataloguePromise = fetch(`${staticWebsiteBasePath}/public-catalogue.json`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Die statischen Stempelstellen konnten nicht geladen werden.');
        const data = await response.json() as Catalogue;
        return validateCatalogue(data);
      }).catch((error) => { cataloguePromise = undefined; throw error; });
  }
  return cataloguePromise;
}

export async function staticStampboxes(mode: StampboxFetchMode): Promise<Stampbox[]> {
  const catalogue = await loadStaticCatalogue();
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return catalogue.stamps.filter((stamp) => {
    if (mode === 'visited') return false;
    if (mode === 'relocated') return Date.parse(stamp.validTo) < today.getTime();
    if (mode === 'validToday' || mode === 'open') {
      return Date.parse(stamp.validFrom) <= now && now <= Date.parse(stamp.validTo);
    }
    return true;
  }).map((stamp) => ({
    ID: stamp.id, number: String(stamp.number), orderBy: String(stamp.number).padStart(3, '0'),
    name: stamp.name, description: stamp.description,
    latitude: stamp.latitude, longitude: stamp.longitude,
    validFrom: stamp.validFrom, validTo: stamp.validTo,
    heroImageUrl: stamp.heroImageUrl, imageCaption: stamp.imageCaption,
    hasVisited: false, totalGroupStampings: 0, stampedUsers: [], stampedUserIds: [],
  }));
}

export function openLiveAppLogin() {
  if (typeof window !== 'undefined') {
    // Leave the same-origin website frame. Authentication remains on the live app.
    (window.top || window).location.assign(liveAppLoginUrl);
  }
}

export async function openStaticStampArticle(stampId: string) {
  const stamp = (await loadStaticCatalogue()).stamps.find((item) => item.id === stampId);
  if (!stamp || !/^\/stempelstelle-\d{3}-[^/]+\/$/.test(stamp.articleUrl)) {
    throw new Error('Für diese Stempelstelle fehlt die bestehende Artikelseite.');
  }
  (window.top || window).location.assign(new URL(stamp.articleUrl, 'https://www.harzer-wander-buddy.de').href);
}

export function assertLiveBackend() {
  if (isStaticWebsite) throw new Error('Diese Funktion ist nur in der angemeldeten App verfügbar.');
}
