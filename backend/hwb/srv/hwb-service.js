const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const {
  onAfterFriendshipCreate,
  acceptPendingFriendshipRequest,
  onBeforeFriendshipCreate,
  onBeforeFriendshipDelete,
} = require('./friendships');

const fetch = require('node-fetch');
const routingManager = require('./routingManager');

const MAX_REQUESTS_PER_CALL = process.env.MAX_REQUESTS_PER_CALL ? process.env.MAX_REQUESTS_PER_CALL : 1000;
const PLACE_SEARCH_MIN_QUERY_LENGTH = 3;
const PLACE_SEARCH_MAX_RESULTS = 8;
const PLACE_SEARCH_DEFAULT_LIMIT = 6;
const PLACE_SEARCH_DEFAULT_LATITUDE = 51.7544;
const PLACE_SEARCH_DEFAULT_LONGITUDE = 10.6182;
const PLACE_SEARCH_BIAS_RADIUS_METERS = 50000;
const PLACE_SEARCH_CACHE_TTL_HIT_MS = 7 * 24 * 60 * 60 * 1000;
const PLACE_SEARCH_CACHE_TTL_EMPTY_MS = 24 * 60 * 60 * 1000;
// 40.000 free 
//  2.500 used
let count = 0;
let aTravelTimesGlobal = [];

module.exports = class api extends cds.ApplicationService {
  init() {

    this.on('READ', `Stampboxes`, onStampboxesRead.bind(this))

    this.on('READ', 'Tours', onTourRead.bind(this));

    this.after('CREATE', 'Tours', async (req) => {
      return upsertTourDetailsById(req, this.entities('hwb.db'));
    });

    this.on('calculateTravelTimesNNearestNeighbors', calculateTravelTimesNNearestNeighbors.bind(this))

    this.on('updateOrderBy', async (req) => {
      const { Stampboxes } = this.entities('hwb.db');

      let aStampBoxes = await SELECT.from(Stampboxes);

      const updatePromises = aStampBoxes.map(async (oBox) => {
        oBox.orderBy = oBox.number.padStart(3, '0');

        await UPDATE(Stampboxes)
          .set({
            orderBy: oBox.orderBy
          })
          .where({ ID: oBox.ID });
      });

      await Promise.all(updatePromises);

      return `Updated ${aStampBoxes.length} Boxes`;
    });

    this.on('getMissingTravelTimesCount', getMissingTravelTimesCount.bind(this))

    this.on('calculateHikingRoute', calculateHikingRoute)
    this.on('getRouteToStampFromPosition', getRouteToStampFromPosition)

    this.on("DeleteSpotWithRoutes", deleteSpotWithRoutes)

    this.on("getTourByIdListTravelTimes", getTourByIdListTravelTimes)

    this.on("updateTourByPOIList", updateTourByPOIList)
    this.on('backfillMissingVisitedAt', backfillMissingVisitedAt)

    this.on('READ', 'TypedTravelTimes', async (req) => {
      // const db = cds.transaction(req);

      return typedTravelTimes;
    });

    this.on('addElevationToAllTravelTimes', addElevationToAllTravelTimes)

    this.on('stampForGroup', stampForGroup)
    this.on('getStampFriendVisits', getStampFriendVisits)
    this.on('getUsersProgress', getUsersProgress)
    this.on('searchPlacesByName', searchPlacesByName)

    this.before('CREATE', 'Friendships', onBeforeFriendshipCreate);

    this.after('CREATE', 'Friendships', onAfterFriendshipCreate);

    this.before('DELETE', 'Friendships', onBeforeFriendshipDelete);

    this.on('getCurrentUser', async (req) => {
      const ExternalUsers = this.entities('hwb.db').ExternalUsers;
      const currentUser = await SELECT.one.from(ExternalUsers).where({ ID: req.user.id });
      if (currentUser && currentUser.ID) {
        currentUser.roles = req.user._roles;
      }
      return currentUser;
    });

    this.on('getCurrentUserID', async (req) => {
      return req.user;
    });

    this.on('getVersion', async (req) => {
      return process.env.npm_package_version;
    });

    this.on('acceptPendingFriendshipRequest', acceptPendingFriendshipRequest);

    this.after('READ', 'Users', addIsFriend.bind(this));

    this.after('READ', 'MyFriends', addIsAllowedToStampForFriend.bind(this));

    this.before("CREATE", "Stampings", verifyStampingIsForBox)
    this.before("CREATE", "Stampings", applyDefaultVisitTimestamp)

    return super.init()
  }
}

async function verifyStampingIsForBox(req) {
  const { stamp } = req.data;
  const db = this.entities('hwb.db');

  if (!stamp) {
      req.error(400, 'Stampbox is required for the stamping.');
      console.log(req.data)
      return;
  }

  const existingStampbox = await SELECT.from(db.Stampboxes).where({ ID: stamp.ID });
  if (!existingStampbox || existingStampbox.length === 0) {
      req.error(404, `Stampbox with ID ${stamp} does not exist.`);
      return;
  }
}

function applyDefaultVisitTimestamp(req) {
  if (!req.data.visitedAt) {
    req.data.visitedAt = req.data.createdAt || new Date().toISOString();
  }
}

async function onTourRead(req, next) {
  let bReturnOnlyFirst = false;
  let tours = await next();

  if (tours?.ID) {
    bReturnOnlyFirst = true;
    tours = [tours];
  }

  const db = this.entities('hwb.db');
  const whereConditions = req.query.SELECT.where || [];
  const groupFilterStampings = extractFilters(whereConditions, "!=").groupFilterStampings;

  const groupUserIds =
    groupFilterStampings && groupFilterStampings.trim().length > 0
      ? groupFilterStampings.split(',').map(u => u.trim())
      : [req.user.id];

  const result = await addGroupDetailsToTours(db, tours, groupUserIds, req.user.id);

  return bReturnOnlyFirst ? result[0] : result;
}

function addGroupDetailsToTours(db, tours, groupUserIds, currentUserId) {
  if (!tours) {
    return Promise.resolve([]);
  }

  return new Promise(async (resolve, reject) => {
    // Query stampings where createdBy is in the provided group.
    const aStampings = await SELECT.from(db.Stampings).where({ createdBy: { in: groupUserIds } });
    const aUsers = await SELECT.from(db.ExternalUsers).where({ ID: { in: groupUserIds } });
    const aStampingsByUser = getStampingByUsers(aStampings, aUsers);
    const stampBoxes = await SELECT.from(db.Stampboxes).columns('ID');
    const stampBoxIds = new Set(stampBoxes.map(stamp => stamp.ID));
    const requestedUserStampings = currentUserId
      ? await SELECT.from(db.Stampings).columns('stamp_ID').where({ createdBy: currentUserId })
      : [];
    const requestedUserStampIds = new Set(requestedUserStampings.map(stamping => stamping.stamp_ID));

    const result = await Promise.all(
      tours?.map(tour => {
        return new Promise(async (resolve, reject) => {
          try {
            tour.groupSize = groupUserIds.length;
            const tourId = tour.ID;
            let toPois;
            if (tourId) {
              const ttt = await SELECT
                .from(db.Tour2TravelTime)
                .where({ tour_ID: tourId });
              ttt.sort((a, b) => a.rank - b.rank);

              const tt = await SELECT
              .from(db.TravelTimes)
              .where({ ID: { in: ttt.map(t => t.travelTime_ID) } });
          
              toPois = tt.map(t => t.toPoi);

              if (tt.length > 0 && ttt.length > 0) {
                const firstTravelTime = tt.filter( tt => tt.ID == ttt[0].travelTime_ID)[0];
                toPois.push(firstTravelTime.fromPoi);
              }
            } else {
              toPois = tour.path?.map(p => p.poi)
            }
            if (!toPois) {
              tour.AverageGroupStampings = 0;
              tour.newStampCountForUser = 0;
              resolve(tour);
              return;
            }
            const nAverageGroupStampings = getTotalStampings(aStampingsByUser, toPois) / groupUserIds.length;
            const uniqueTourStampIds = [...new Set(toPois.filter(poiId => stampBoxIds.has(poiId)))];
            const newStampCountForUser = uniqueTourStampIds.filter(
              stampId => !requestedUserStampIds.has(stampId)
            ).length;

            // Populate the custom fields:
            tour.AverageGroupStampings = Math.round(nAverageGroupStampings * 100) / 100;
            tour.newStampCountForUser = newStampCountForUser;

            resolve(tour);
          } catch (error) {
            reject(error);
          }
        });
      })
    );
    resolve(result);
  });
}

function getTotalStampings(stampings, toPois) {
  let aStampCount = [];
  for (let i = 0; i < toPois.length; i++) {
    const poi = toPois[i];
    const aStampings = stampings.filter(s => s.stamping.stamp_ID == poi);
    aStampCount.push(aStampings.length);
  }
  return aStampCount.reduce((p, c) => p + c, 0);
}

function getStampingByUsers(stampings, users) {
  let result = [];
  for (let i = 0; i < stampings.length; i++) {
    let stamping = stampings[i];
    let user = users.find(u => u.ID == stamping.createdBy);
    if (user) {
      result.push({
        user: user,
        stamping: stamping
      });
    }
  }
  return result;
}

async function onStampboxesRead(req, next) {
  const db = this.entities('hwb.db');
  applyDefaultCurrentValidityFilter(req);

  let bReturnOnlyFirst = false;
  let stampBoxes = await next();

  if (stampBoxes?.ID) {
    bReturnOnlyFirst = true;
    stampBoxes = [stampBoxes];
  }

  if (!stampBoxes || stampBoxes.length === 0) {
    return bReturnOnlyFirst ? null : [];
  }

  const whereConditions = req.query.SELECT.where || [];
  const groupFilterStampings = extractFilters(whereConditions, "!=").groupFilterStampings;

  const groupUserIds =
    groupFilterStampings && groupFilterStampings.trim().length > 0
      ? groupFilterStampings.split(',').map(u => u.trim())
      : [req.user.id];

  const aStampings = await SELECT.from(db.Stampings).where({ createdBy: { in: groupUserIds } });
  const aUsers = await SELECT.from(db.ExternalUsers).where({ ID: { in: groupUserIds } });

  const result = stampBoxes.map(box => {
    const boxStampings = aStampings.filter(s => s.stamp_ID == box.ID);
    const stampedUserIds = [...new Set(boxStampings.map(s => s.createdBy))];

    // Populate the custom fields:
    box.hasVisited = stampedUserIds.includes(req.user.id);
    box.groupSize = groupUserIds.length;
    box.totalGroupStampings = stampedUserIds.length;
    box.stampedUserIds = stampedUserIds;
    box.stampedUsers = aUsers.filter(u => stampedUserIds.includes(u.ID));

    if(box.Stampings){
      // XXX path authorization on expands only applies on HANA :(
      // All Stampings are loaded!
      // TODO: rewrite to ensure only needed are loaded
      box.Stampings = box.Stampings.filter( s => s.createdBy == req.user.id);
    }

    return box;
  });
  return bReturnOnlyFirst ? result[0] : result;
}

function applyDefaultCurrentValidityFilter(req) {
  const select = req?.query?.SELECT;
  if (!select || hasValidityFilter(select.where) || isReadByKnownId(req)) {
    return;
  }

  const nowIso = new Date().toISOString();
  const currentValidityFilter = [
    { ref: ['validFrom'] }, '<=', { val: nowIso },
    'and',
    { ref: ['validTo'] }, '>', { val: nowIso }
  ];

  if (!select.where || select.where.length === 0) {
    select.where = currentValidityFilter;
    return;
  }

  select.where = [{ xpr: select.where }, 'and', { xpr: currentValidityFilter }];
}

function isReadByKnownId(req) {
  if (req?.data?.ID) {
    return true;
  }

  if ((req?.params || []).some(param => param?.ID)) {
    return true;
  }

  const select = req?.query?.SELECT;
  if (!select) {
    return false;
  }

  return hasFieldFilter(select.where, 'ID') || hasIdFilterInFrom(select.from);
}

function hasIdFilterInFrom(from) {
  if (!from?.ref || !Array.isArray(from.ref)) {
    return false;
  }

  return from.ref.some(segment => hasFieldFilter(segment?.where, 'ID'));
}

function hasFieldFilter(filters, fieldName) {
  if (!filters || filters.length === 0) {
    return false;
  }

  for (let i = 0; i < filters.length; i++) {
    const token = filters[i];
    if (token?.xpr && hasFieldFilter(token.xpr, fieldName)) {
      return true;
    }

    const refPath = token?.ref || [];
    if (!refPath.includes(fieldName)) {
      continue;
    }

    const operator = filters[i + 1];
    const valueToken = filters[i + 2];
    if ((operator === '=' || operator === 'in') && valueToken) {
      return true;
    }
  }

  return false;
}

function hasValidityFilter(filters) {
  if (!filters || filters.length === 0) {
    return false;
  }

  for (const token of filters) {
    if (token?.xpr && hasValidityFilter(token.xpr)) {
      return true;
    }

    const refPath = token?.ref || [];
    if (refPath.includes('validFrom') || refPath.includes('validTo')) {
      return true;
    }
  }

  return false;
}


function extractFilters(filters, operator) {
  if (!filters) {
    return null;
  }
  if (filters[0]?.xpr) {
    filters = filters[0].xpr;
  }
  let result = {};
  for (let i = 0; i < filters.length; i++) {
    if (filters[i].ref) {
      // Extract the reference
      let ref = filters[i].ref[0];
      // Check if the next element is '=' and the element after that has a value
      if (filters[i + 1] === operator && filters[i + 2] && filters[i + 2].val) {
        // Store the reference and its value
        result[ref] = filters[i + 2].val;
        // Skip the next two elements
        i += 2;
      }
    }
  }
  return result;
}

async function addIsFriend(users, req) {
  const { MyFriends } = this.api.entities;
  const aFriendships = await SELECT.from(MyFriends).where({ createdBy: req.user.id });
  const aFriendIds = aFriendships
    .filter(f => f.status === 'accepted')
    .map(f => f.ID);
  return users.map(user => {
    user.isFriend = aFriendIds.includes(user.ID);
    user.isAllowedFor
    return user;
  });
}

function upsertTourDetailsById(req, entities) {
  const { Tour2TravelTime } = entities;
  //TODO recalculate Details of distance & duration
  const aTravelTimeIds = req.idListTravelTimes.split(";");
  let rank = 0;
  let aTour2TravelTime = aTravelTimeIds.map(travelTime_ID => {
    rank = rank + 512;
    return {
      travelTime_ID,
      tour_ID: req.ID,
      rank
    }
  })
  return UPSERT(aTour2TravelTime).into(Tour2TravelTime);
}

async function deleteSpotWithRoutes(req) {
  let poiIdToDelete = req.data.SpotId
  const full = this.entities('hwb.db');
  const { Stampboxes, ParkingSpots, TravelTimes } = full;

  let result = 0;
  // result += await DELETE.from(Stampboxes).where({ ID: poiIdToDelete });
  result += await DELETE.from(ParkingSpots).where({ ID: poiIdToDelete });
  result += await DELETE.from(TravelTimes).where({ fromPoi: poiIdToDelete });
  result += await DELETE.from(TravelTimes).where({ toPoi: poiIdToDelete });
  return result;
}

async function updateTourByPOIList(req) {
  return handleTourByPOIList.call(this, req, { persist: true });
}

function isDriveTravelMode(travelMode) {
  const normalized = String(travelMode || "").trim().toLowerCase();
  return normalized.includes("drive");
}

async function handleTourByPOIList(req, options = { persist: true }) {
  const persist = options.persist !== false;
  let id = req.data.TourID;
  let poiList = req.data.POIList;

  const { typedTravelTimes } = this.api.entities;
  const { Stampboxes, ParkingSpots, TravelTimes, Tour2TravelTime, Tours, Stampings } = this.entities('hwb.db');

  const existingTour = await SELECT.one.from(Tours).where({ ID: id });
  if (!existingTour) {
    req.error(404, `Tour with ID ${id} does not exist.`);
    return;
  }
  if (existingTour.createdBy !== req.user.id) {
    req.error(403, `You are not allowed to ${persist ? "update" : "preview"} tour ${id}.`);
    return;
  }

  let aPois = poiList.split(";").filter(p => !!p);
  aPois = removeAdjacentDuplicates(aPois);
  if (aPois.length < 2) {
    throw new Error("At least 2 POIs are required to create a tour");
  }
  let aPoiPairs = [];
  let aParkingSpots = await SELECT.from(ParkingSpots);
  let oParkingSpotsById = {};
  aParkingSpots.forEach(p => {
    oParkingSpotsById[p.ID] = p;
  });
  let aStampBoxes = await SELECT.from(Stampboxes);
  let oStampBoxById = {};
  aStampBoxes.forEach(box => {
    oStampBoxById[box.ID] = box;
  });
  const aUserStampings = await SELECT
    .from(Stampings)
    .columns('stamp_ID')
    .where({ createdBy: req.user.id });
  const stampedStampBoxIds = new Set(aUserStampings.map(stamping => stamping.stamp_ID));

  // Loop through all POI pairs and create the list of required pairs
  for (let i = 0; i < aPois.length - 1; i++) {
    aPoiPairs.push({ fromPoi: aPois[i], toPoi: aPois[i + 1] });
  }

  const fromPoiIds = [...new Set(aPoiPairs.map(pair => pair.fromPoi))];
  const toPoiIds = [...new Set(aPoiPairs.map(pair => pair.toPoi))];
  const wantedPairKeys = new Set(aPoiPairs.map(pair => `${pair.fromPoi}-${pair.toPoi}`));

  // Step 1: Load applicable travel times for the given POI pairs
  let aTravelTimesWithPositionString = await SELECT
    .columns('ID', 'fromPoi', 'toPoi', 'durationSeconds', 'distanceMeters', 'travelMode', 'name', 'elevationLoss', 'elevationGain')
    .from(typedTravelTimes)
    .where({
      fromPoi: { in: fromPoiIds },
      toPoi: { in: toPoiIds }
    });
  aTravelTimesWithPositionString = aTravelTimesWithPositionString
    .filter(route => wantedPairKeys.has(`${route.fromPoi}-${route.toPoi}`))
    .filter(route => {
      // Enforce expected mode by POI type:
      // parking -> parking = drive, everything else = walk
      const isParkingToParking = !oStampBoxById[route.fromPoi] && !oStampBoxById[route.toPoi];
      return isParkingToParking ? isDriveTravelMode(route.travelMode) : !isDriveTravelMode(route.travelMode);
    });
  aTravelTimesWithPositionString = getUniqueRoutes(aTravelTimesWithPositionString);

  // Step 2: Identify missing travel times
  // Create a set of POI pairs from the results for easier lookup
  let existingTravelTimes = new Set();
  aTravelTimesWithPositionString.forEach((entry) => {
    existingTravelTimes.add(`${entry.fromPoi}-${entry.toPoi}`);
  });

  // Prepare an array of POI pairs for which travel times are missing
  let aMissingTravelTimes = [];

  // Loop through all POI pairs and check if the travel time is already present
  aPoiPairs.forEach((pair) => {
    let pairKey = `${pair.fromPoi}-${pair.toPoi}`;
    if (!existingTravelTimes.has(pairKey)) {
      aMissingTravelTimes.push(pair);
    }
  });

  // Step 3: Calculate missing travel times
  let aNeededTravelTimes = [];
  const routeBudget = createRouteBudget();
  for (let pair of aMissingTravelTimes) {
    let fromPoi = oStampBoxById[pair.fromPoi];
    if (!fromPoi) {
      fromPoi = oParkingSpotsById[pair.fromPoi] || {};
      fromPoi.type = "parking"
    }

    let toPoi = oStampBoxById[pair.toPoi];
    if (!toPoi) {
      toPoi = oParkingSpotsById[pair.toPoi] || {};
      toPoi.type = "parking"
    }

    let travelMode = (toPoi.type === "parking" && fromPoi.type === "parking") ? "drive" : "walk";
    let calculatedTravelTime = await getTravelTimes(fromPoi, [toPoi], travelMode, routeBudget);
    calculatedTravelTime = calculatedTravelTime[0];
    // Add the calculated travel time to the array of needed travel times
    if (calculatedTravelTime) {
      aNeededTravelTimes.push(calculatedTravelTime);
    }
  }
  // Persist newly calculated travel times only for update calls.
  if (aNeededTravelTimes.length > 0) {
    if (persist) {
      await INSERT(aNeededTravelTimes).into(TravelTimes);
    }
    aTravelTimesWithPositionString = aTravelTimesWithPositionString.concat(aNeededTravelTimes);
  }

  // Build ranked tour links from the requested POI sequence.
  let aTour2TravelTime = getRankedTour2TravelTimes(aTravelTimesWithPositionString, aPois, id);
  if (aTour2TravelTime.length !== aPois.length - 1) {
    req.error(422, `Unable to ${persist ? "update" : "preview"} tour ${id}: missing route segments for the requested POI list.`);
    return;
  }

  if (persist) {
    await DELETE.from(Tour2TravelTime).where({ tour_ID: id });
    await INSERT(aTour2TravelTime).into(Tour2TravelTime);
  }

  const orderedTour2TravelTime = [...aTour2TravelTime].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const travelTimesById = new Map(aTravelTimesWithPositionString.map(tt => [tt.ID, tt]));
  const orderedTravelTimes = orderedTour2TravelTime.map(tt => travelTimesById.get(tt.travelTime_ID));
  if (orderedTravelTimes.some(tt => !tt)) {
    req.error(422, `Unable to ${persist ? "update" : "preview"} tour ${id}: inconsistent route segments for the requested POI list.`);
    return;
  }

  let distance = 0, duration = 0, stampCount = 0, newStampCountForUser = 0, idListTravelTimes = "", totalElevationGain = 0, totalElevationLoss = 0;
  const countedStampIds = new Set();

  function countStampIfNeeded(poiId) {
    if (oStampBoxById[poiId] && !countedStampIds.has(poiId)) {
      countedStampIds.add(poiId);
      stampCount++;
      if (!stampedStampBoxIds.has(poiId)) {
        newStampCountForUser++;
      }
    }
  }

  for (let i = 0; i < orderedTravelTimes.length; i++) {
    const oTravelTime = orderedTravelTimes[i];
    const distanceMeters = parseInt(oTravelTime.distanceMeters, 10) || 0;
    const durationSeconds = parseInt(oTravelTime.durationSeconds, 10) || 0;
    const isDriveSegment = isDriveTravelMode(oTravelTime.travelMode);

    if (!isDriveSegment) {
      distance += distanceMeters;
      totalElevationGain += parseInt(oTravelTime.elevationGain, 10) || 0;
      totalElevationLoss += parseInt(oTravelTime.elevationLoss, 10) || 0;
    }
    duration += durationSeconds;

    if (i === 0) {
      countStampIfNeeded(oTravelTime.fromPoi);
    }
    countStampIfNeeded(oTravelTime.toPoi);
  }
  idListTravelTimes = orderedTour2TravelTime.map(tt => tt.travelTime_ID).join(";");

  let oTour = {
    ID: id,
    distance,
    duration,
    stampCount,
    idListTravelTimes,
    totalElevationGain,
    totalElevationLoss
  }
  if (persist) {
    await UPSERT(oTour).into(Tours);
  }

  oTour.idListTravelTimes = idListTravelTimes;
  oTour.newStampCountForUser = newStampCountForUser;
  oTour.path = orderedTour2TravelTime;
  return oTour;

  function getRankedTour2TravelTimes(aRelevantTravelTimes, aPois, tourId) {
    let oRankMap = new Map();
    aRelevantTravelTimes.forEach((tt) => {
      oRankMap.set(`${tt.fromPoi};${tt.toPoi}`, tt);
    });

    let aTour2TravelTime = [];
    let rank = 0;
    for (let i = 0; i < aPois.length - 1; i++) {
      let fromPoi = aPois[i];
      let toPoi = aPois[i + 1];
      let tt = oRankMap.get(`${fromPoi};${toPoi}`);
      if (tt) {
        rank = rank + 512;
        aTour2TravelTime.push({
          travelTime_ID: tt.ID,
          tour_ID: tourId,
          rank: rank
        });
      }
    }
    return aTour2TravelTime;
  }
}

function removeAdjacentDuplicates(arr) {
  const result = [];

  for (let i = 0; i < arr.length; i++) {
    if (result.length === 0 || result[result.length - 1] !== arr[i]) {
      result.push(arr[i]);
    }
  }

  return result;
}

function getUniqueRoutes(routes) {
  const uniqueRoutes = {};

  routes.forEach((route) => {
    const pairKey = `${route.fromPoi}-${route.toPoi}`;
    const duration = parseFloat(route.durationSeconds);

    // If the pair doesn't exist yet, or if the current route has a smaller duration, update the entry
    if (!uniqueRoutes[pairKey] || duration < parseFloat(uniqueRoutes[pairKey].durationSeconds)) {
      uniqueRoutes[pairKey] = route;
    }
  });

  // Convert the result back to an array
  return Object.values(uniqueRoutes);
}

async function getTourByIdListTravelTimes(req) {
  let id = req.data.idListTravelTimes;
  if (!id) {
    return {};
  }
  const { TravelTimes, Stampboxes, Stampings } = this.entities('hwb.db');
  const { typedTravelTimes } = this.api.entities;

  let aPathIds = id.split(";").filter(Boolean);
  aPathIds.unshift("xx");

  const aTravelTimesWithPositionString = await SELECT
    .columns('ID', 'fromPoi', 'toPoi', 'toPoiType', 'durationSeconds', 'distanceMeters', 'travelMode', 'name')
    .where({ ID: { in: aPathIds } })
    .from(typedTravelTimes);

  let aStampBoxes = await SELECT.from(Stampboxes);
  const currentUser = req.user.id; // Get the current user ID
  let aStampingForUser = await SELECT.from(Stampings).where({ createdBy: currentUser });
  const stampedStampBoxIds = new Set(aStampingForUser.map(stamping => stamping.stamp_ID));

  let oStampBoxById = {};
  aStampBoxes.forEach(box => {
    box.stampedByUser = stampedStampBoxIds.has(box.ID);
    oStampBoxById[box.ID] = box;
  });

  let distance = 0, duration = 0, stampCount = 0, newStampCountForUser = 0;
  const countedStampIds = new Set();
  if (aTravelTimesWithPositionString.length == 0) {
    return {
      stampCount: 0,
      newStampCountForUser: 0,
      distance: 0,
      duration: 0,
      id: "notFound",
      path: []
    };
  }

  function countStampIfNeeded(poiId) {
    if (!oStampBoxById[poiId] || countedStampIds.has(poiId)) {
      return;
    }

    countedStampIds.add(poiId);
    stampCount++;
    if (!stampedStampBoxIds.has(poiId)) {
      newStampCountForUser++;
    }
  }

  for (let i = 0; i < aTravelTimesWithPositionString.length; i++) {
    const oTravelTime = aTravelTimesWithPositionString[i];
    const distanceMeters = parseInt(oTravelTime.distanceMeters, 10) || 0;
    const durationSeconds = parseInt(oTravelTime.durationSeconds, 10) || 0;
    if (!isDriveTravelMode(oTravelTime.travelMode)) {
      distance += distanceMeters;
    }
    duration += durationSeconds;

    if (i == 0) {
      countStampIfNeeded(oTravelTime.fromPoi);
    }
    countStampIfNeeded(oTravelTime.toPoi);

    oTravelTime.id = oTravelTime.ID;
    aTravelTimesWithPositionString[i] = oTravelTime;
  }

  // sort path like requested
  let oTravelTimesById = {};
  const path = [];
  aTravelTimesWithPositionString.forEach(travelTime => {
    oTravelTimesById[travelTime.ID] = travelTime;
  });

  for (let i = 0; i < aPathIds.length; i++) {
    let id = aPathIds[i].replaceAll("'", "");
    if (oTravelTimesById[id]) {
      path.push(oTravelTimesById[id]);
    }
  }

  let result = await routingManager.addPositionStrings([{
    stampCount: stampCount ? stampCount : 0,
    newStampCountForUser: newStampCountForUser ? newStampCountForUser : 0,
    distance,
    duration,
    id,
    path
  }]);
  result = await addGroupDetailsToTours(this.entities('hwb.db'), result, [req.user.id], req.user.id);
  return result[0];
}

async function calculateHikingRoute(req) {
  const db = this.entities('hwb.db');
  // req.data.startId = "5810c033-235d-4836-b09d-f7829929e2fe";
  console.log(req.data);
  const { typedTravelTimes, Stampboxes, Stampings } = this.api.entities;
  if (aTravelTimesGlobal.length == 0) {
    aTravelTimesGlobal = await SELECT
      .columns('ID', 'fromPoi', 'toPoi', 'toPoiType', 'durationSeconds', 'distanceMeters', 'travelMode', 'name')
      .from(typedTravelTimes);
  }

  let aStampsDoneByUser = await SELECT
    .columns('stamp_ID')
    .where({ createdBy: req.user.id })
    .from(Stampings);
  aStampsDoneByUser = aStampsDoneByUser.map(s => s.stamp_ID);

  //Determine starting Parking spaces and iterate
  let aStartingParking = await determineStartingParking.bind(this)(req.data);

  let results = [];
  for (let i = 0; i < aStartingParking.length; i++) {
    req.data.startId = aStartingParking[i].NeighborsID;
    let newRoutes = await routingManager.calculateHikingRoutes(req.data, aTravelTimesGlobal, aStampsDoneByUser);
    results = results.concat(newRoutes);
  }

  if (results.length > 0) {
    const groupFilterStampings = req.data.groupFilterStampings;
    const groupUserIds =
      groupFilterStampings && groupFilterStampings.trim().length > 0
        ? groupFilterStampings.split(',').map(u => u.trim())
        : [req.user.id];

    results = await addGroupDetailsToTours(db, results, groupUserIds, req.user.id);
  }

  return { results }

  return {
    Points: [{
      "ID": "00012d90-308f-427b-a80d-1a4b6f287fa6",
      "fromPoi": "5810c033-235d-4836-b09d-f7829929e2fe",
      "toPoi": "5810c033-235d-4836-b09d-f7829929e2fe",
      "durationSeconds": "2397",
      "distanceMeters": "2484",
      "travelMode": "walk",
      "positionString": "10.8015411;51.8247587;0;10.8015486;51.8247947;0;"
    }],
    totalDistance: 1,
    totalDuration: 2,
    totalNewStamps: 3
  }
}

async function getRouteToStampFromPosition(req) {
  const db = this.entities('hwb.db');
  const targetPoiId = typeof req.data?.stampId === 'string' ? req.data.stampId.trim() : '';
  const latitude = Number(req.data?.latitude);
  const longitude = Number(req.data?.longitude);

  if (!targetPoiId) {
    req.error(400, 'stampId is required.');
    return null;
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    req.error(400, 'latitude must be a valid number between -90 and 90.');
    return null;
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    req.error(400, 'longitude must be a valid number between -180 and 180.');
    return null;
  }

  let targetPoi = await SELECT.one
    .from(db.Stampboxes)
    .columns('ID', 'latitude', 'longitude')
    .where({ ID: targetPoiId });

  if (!targetPoi) {
    targetPoi = await SELECT.one
      .from(db.ParkingSpots)
      .columns('ID', 'latitude', 'longitude')
      .where({ ID: targetPoiId });
  }

  if (!targetPoi) {
    req.error(404, `Point of interest with ID ${targetPoiId} does not exist.`);
    return null;
  }

  const targetLatitude = Number(targetPoi.latitude);
  const targetLongitude = Number(targetPoi.longitude);
  if (!Number.isFinite(targetLatitude) || !Number.isFinite(targetLongitude)) {
    req.error(422, `Point of interest with ID ${targetPoiId} does not have coordinates.`);
    return null;
  }

  let route;
  try {
    route = await calculateRoute(
      { latitude, longitude },
      { latitude: targetLatitude, longitude: targetLongitude },
      'walk'
    );
  } catch (error) {
    console.error('getRouteToStampFromPosition route calculation failed, using fallback:', error);
  }

  const routeResult = route?.routes?.[0];
  const fallbackRoute = buildFallbackRouteFromPosition(
    { latitude, longitude },
    { latitude: targetLatitude, longitude: targetLongitude }
  );
  const resolvedRoute = routeResult?.polyline?.geoJsonLinestring?.coordinates?.length
    ? routeResult
    : fallbackRoute;

  if (!resolvedRoute?.polyline?.geoJsonLinestring?.coordinates?.length) {
    req.error(502, 'No route found.');
    return null;
  }

  let elevationResult;
  try {
    elevationResult = await addElevationProfileToTravelTime({
      positionString: mapPolyLineToPositionString(resolvedRoute.polyline.geoJsonLinestring.coordinates)
    });
  } catch (error) {
    console.error('getRouteToStampFromPosition elevation calculation failed:', error);
    req.error(502, 'Unable to calculate elevation metrics.');
    return null;
  }

  const distanceMeters = Number.parseFloat(resolvedRoute.distanceMeters);
  const durationSeconds = Number.parseFloat(String(resolvedRoute.duration || '').replace(/s$/, ''));

  return {
    distanceMeters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : 0,
    durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 0,
    elevationGainMeters: Math.round(Number(elevationResult?.elevationGain ?? 0)),
    elevationLossMeters: Math.round(Number(elevationResult?.elevationLoss ?? 0))
  };
}

function buildFallbackRouteFromPosition(pointA, pointB) {
  const distanceMeters = distanceInMeters(
    pointA.latitude,
    pointA.longitude,
    pointB.latitude,
    pointB.longitude
  );
  const durationSeconds = estimateWalkingDurationSeconds(distanceMeters);

  return {
    duration: `${durationSeconds}s`,
    distanceMeters: Math.round(distanceMeters),
    polyline: {
      geoJsonLinestring: {
        coordinates: buildInterpolatedCoordinates(pointA, pointB, 24)
      }
    }
  };
}

function buildInterpolatedCoordinates(pointA, pointB, sampleCount = 24) {
  const safeSampleCount = Math.max(2, Math.min(64, Math.floor(sampleCount)));
  const coordinates = [];

  for (let index = 0; index < safeSampleCount; index += 1) {
    const factor = safeSampleCount === 1 ? 0 : index / (safeSampleCount - 1);
    const latitude = pointA.latitude + (pointB.latitude - pointA.latitude) * factor;
    const longitude = pointA.longitude + (pointB.longitude - pointA.longitude) * factor;
    coordinates.push([longitude, latitude]);
  }

  return coordinates;
}

function estimateWalkingDurationSeconds(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0;
  }

  return Math.max(60, Math.round(distanceMeters * 0.9));
}

async function determineStartingParking(params) {
  return new Promise(async (resolve, reject) => {

    const { RouteCalculationRequest } = this.entities('hwb.db');
    let calculationRequest = {
      ID: uuidv4(),
      latitude: params.latitudeStart,
      longitude: params.longitudeStart
    }
    await INSERT(calculationRequest).into(RouteCalculationRequest);


    const { NeighborsCalculationRequestParking } = this.api.entities
    let parking = await SELECT.from(NeighborsCalculationRequestParking)
      .where({ ID: calculationRequest.ID })
      .limit(2);
    resolve(parking);
  });
}

/** Check if all expected routes are present */
async function getMissingTravelTimesCount(req) {
  const { n } = req.data
  let result = await processTravelTimes.bind(this)(n, () => { });
  return result;
}

/** calculate travel times to neighbors via maps api */
async function calculateTravelTimesNNearestNeighbors(req) {
  const { n } = req.data
  const routeBudget = createRouteBudget();
  let result = await processTravelTimes.bind(this)(n, getTravelTimes, routeBudget);
  return result;
}

function processTravelTimes(nearestNeighborsCount, processor, routeBudget = createRouteBudget()) {
  const { Stampboxes, TravelTimes, ParkingSpots } = this.entities('hwb.db')
  const { NeighborsStampStamp, NeighborsStampParking, NeighborsParkingStamp, NeighborsParkingParking } = this.api.entities
  let missingTravelTimesCount = 0;
  return new Promise(async (resolve, reject) => {
    // s -> s walk
    // s -> p walk

    // fetch all stamps and iterate
    let aStampBoxes = await SELECT.from(Stampboxes);
    let actualUpdateCount = 0;

    for (let i = 0; i < aStampBoxes.length; i++) {
      const box = aStampBoxes[i];
      let aExistingTravelTimes = await SELECT.from(TravelTimes).where({ fromPoi: box.ID });
      aExistingTravelTimes = aExistingTravelTimes.map(t => t.toPoi);

      let aTravelTimesWalk = await getTravelTimesStampStamps(box, aExistingTravelTimes);
      if (aTravelTimesWalk && aTravelTimesWalk.length) {
        await UPSERT(aTravelTimesWalk).into(TravelTimes);
        actualUpdateCount += aTravelTimesWalk.length;
      }

      aTravelTimesWalk = await getTravelTimesStampParkingSpaces(box, aExistingTravelTimes);
      if (aTravelTimesWalk && aTravelTimesWalk.length) {
        await UPSERT(aTravelTimesWalk).into(TravelTimes);
        actualUpdateCount += aTravelTimesWalk.length;
      }

    }

    //repeat same for parking spaces
    // p -> s walk
    // p -> p drive

    // fetch all parking spaces and iterate
    let aParkingSpots = await SELECT.from(ParkingSpots);

    for (let i = 0; i < aParkingSpots.length; i++) {
      const spot = aParkingSpots[i];
      let aExistingTravelTimes = await SELECT.from(TravelTimes).where({ fromPoi: spot.ID });
      aExistingTravelTimes = aExistingTravelTimes.map(t => t.toPoi);

      let aTravelTimesWalk = await getTravelTimesParkingStamps(spot, aExistingTravelTimes);

      if (aTravelTimesWalk && aTravelTimesWalk.length) {
        await UPSERT(aTravelTimesWalk).into(TravelTimes);
        actualUpdateCount += aTravelTimesWalk.length;
      }

      let aTravelTimesDrive = await getTravelTimesParkingParking(spot, aExistingTravelTimes);
      if (aTravelTimesDrive && aTravelTimesDrive.length) {
        await UPSERT(aTravelTimesDrive).into(TravelTimes);
        actualUpdateCount += aTravelTimesDrive.length;
      }
    }

    resolve(missingTravelTimesCount);
  });

  async function getTravelTimesParkingParking(spot, aExistingTravelTimes) {
    // get n nearest parking spaces
    let adjacentParkingSpots = await SELECT
      .from(NeighborsParkingParking)
      .where({ ID: spot.ID })
      .limit(nearestNeighborsCount);

    adjacentParkingSpots = adjacentParkingSpots.filter(s => !aExistingTravelTimes.includes(s.NeighborsID));
    missingTravelTimesCount += adjacentParkingSpots.length;

    // calculate travel time by car via maps api
    return processor(spot, adjacentParkingSpots, 'drive', routeBudget);
  }

  async function getTravelTimesParkingStamps(spot, aExistingTravelTimes) {
    // get n nearest stamp neighbors
    let adjacentStamps = await SELECT
      .from(NeighborsParkingStamp)
      .where({ ID: spot.ID })
      .limit(nearestNeighborsCount);

    adjacentStamps = adjacentStamps.filter(s => !aExistingTravelTimes.includes(s.NeighborsID));
    missingTravelTimesCount += adjacentStamps.length;

    // calculate travel time by foot via maps api
    return processor(spot, adjacentStamps, 'walk', routeBudget);
  }

  async function getTravelTimesStampParkingSpaces(box, aExistingTravelTimes) {
    let adjacentParkingSpots = await SELECT
      .from(NeighborsStampParking)
      .where({ ID: box.ID })
      .limit(nearestNeighborsCount);

    adjacentParkingSpots = adjacentParkingSpots.filter(s => !aExistingTravelTimes.includes(s.NeighborsID));
    missingTravelTimesCount += adjacentParkingSpots.length;
    // calculate travel time by foot via maps api
    return processor(box, adjacentParkingSpots, 'walk', routeBudget);
  }

  async function getTravelTimesStampStamps(box, aExistingTravelTimes) {
    // // get neighbors within 10 km
    // let adjacentStamps = await SELECT
    //   .from(NeighborsStampStamp)
    //   .where({
    //     distanceKm: { '<=': 5 }, and: {
    //       ID: box.ID
    //     }
    //   });
    // get n nearest neighbors
    let adjacentStamps = await SELECT
      .from(NeighborsStampStamp)
      .where({ ID: box.ID })
      .limit(nearestNeighborsCount);

    adjacentStamps = adjacentStamps.filter(s => !aExistingTravelTimes.includes(s.NeighborsID));
    missingTravelTimesCount += adjacentStamps.length;

    return processor(box, adjacentStamps, 'walk', routeBudget);
  }
}

function getTravelTimes(box, neighborPois, travelMode, routeBudget = createRouteBudget()) {
  return new Promise(async (resolve, reject) => {

    let result = [];
    for (let i = 0; i < neighborPois.length; i++) {
      const neighbor = neighborPois[i];

      if (!neighbor) {
        console.error("Neighbor is missing");
        continue;
      }
      if (neighbor.distanceKm == 0) {
        continue;
      }
      console.info(`Calculating Route from ${box.name}(${box.ID}) to ${neighbor.name}(${neighbor.ID})`);
      let oRoute;
      try {
        oRoute = await calculateRoute(box, neighbor, travelMode, routeBudget);
      } catch (error) {
        console.error("Error calculating route:", error);
        continue;
      }

      if (oRoute && oRoute.routes && oRoute.routes[0]) {
        result.push({
          ID: uuidv4(),
          fromPoi: box.ID,
          toPoi: neighbor.ID || neighbor.NeighborsID,
          durationSeconds: oRoute.routes[0].duration.split('s')[0],
          distanceMeters: oRoute.routes[0].distanceMeters,
          travelMode,
          //Waypoint Route
          positionString: mapPolyLineToPositionString(oRoute.routes[0].polyline.geoJsonLinestring.coordinates)
        });
      } else if (oRoute) {
        console.error("Skipping invalid route result:", JSON.stringify(oRoute));
      }

    }
    if (travelMode == "walk") {
      // TODO test
      let aPromises = result.map(addElevationProfileToTravelTime);
      Promise.all(aPromises)
        .then(r => resolve(r))
        .catch(error => {
          console.error("Elevation profile calculation failed:", error);
          resolve(result);
        });
    } else {
      resolve(result);
    }
  });
}

function mapPolyLineToPositionString(aCoordinates) {
  return aCoordinates.map(coordinatePair => coordinatePair.concat([0]))
    .map(coordinatePair => coordinatePair.join(";"))
    .join(";")
}

function calculateRoute(pointA, pointB, travelMode, routeBudget = createRouteBudget()) {
  if (!pointA || !pointB) {
    console.error("Point A or B is missing");
    return Promise.reject("Point A or B is missing");
  }
  if (!consumeRouteBudget(routeBudget)) {
    return Promise.resolve("Quota per Request exceeded!");
  }
  count++;
  console.log(count);
  // return {
  //   "routes": [
  //     {
  //       "duration": "5",
  //       "distanceMeters": "5",
  //       polyline: {
  //         geoJsonLinestring: { coordinates: [["10.467539999999985;51.78544" ]]}
  //       }
  //     }]
  // };

  let body = {
    "origin": {
      "location": {
        "latLng": {
          "latitude": pointA.latitude,
          "longitude": pointA.longitude
        }
      }
    },
    "destination": {
      "location": {
        "latLng": {
          "latitude": pointB.latitude,
          "longitude": pointB.longitude
        }
      }
    },
    "travelMode": travelMode,
    "polylineQuality": "HIGH_QUALITY",
    "polylineEncoding": "GEO_JSON_LINESTRING",
    "computeAlternativeRoutes": false,
    "routeModifiers": {
      "avoidTolls": false,
      "avoidHighways": false,
      "avoidFerries": false,
      "avoidIndoor": false
    }
  };

  if (travelMode.toLowerCase() == 'drive') {
    body.routingPreference = "traffic_unaware";
  }

  return new Promise((resolve, reject) => {
    fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      "headers": {
        "accept": "*/*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/json",
        "sec-ch-ua": "\"Not A(Brand\";v=\"99\", \"Google Chrome\";v=\"121\", \"Chromium\";v=\"121\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-client-data": "CIq2yQEIpbbJAQipncoBCNr2ygEIkqHLAQiLq8wBCJ3+zAEIhaDNAQiD8M0BGPTJzQEYp+rNARjYhs4B",
        "x-goog-api-key": process.env.GOOLGE_MAPS_API_KEY,
        "x-goog-fieldmask": "routes.duration,routes.distanceMeters,routes.polyline"
      },
      "body": JSON.stringify(body),
      "method": "POST"
    }).then(r => r.json())
      .then(j => {
        // omit the polyline for logging
        console.info("computeRoutes: " + JSON.stringify(j?.routes?.map(r => { return { duration: r.duration, distanceMeters: r.distanceMeters } })));
        if (!j.routes || j.routes?.length == 0) {
          console.error("No Route found!");
          console.error("Request: " + JSON.stringify(body));
          console.error("Response: " + JSON.stringify(j));
          reject({
            message: "No route found",
            details: j
          });
          return;
        }
        resolve(j);
      })
      .catch(error => {
        console.error("computeRoutes failed:", error);
        reject({
          message: "Route calculation failed",
          details: error?.message || String(error)
        });
      });
  });
}

function createRouteBudget() {
  return {
    requests: 0,
    limit: Number.parseInt(MAX_REQUESTS_PER_CALL, 10) || 0
  };
}

function consumeRouteBudget(routeBudget) {
  if (!routeBudget) {
    return true;
  }

  if (routeBudget.limit <= 0) {
    return false;
  }

  if (routeBudget.requests >= routeBudget.limit) {
    return false;
  }

  routeBudget.requests += 1;
  return true;
}

async function addElevationToAllTravelTimes(req) {
  const { TravelTimes } = this.entities('hwb.db');
  let aTravelTimes = await SELECT.from(TravelTimes).limit(250)
    .where({ elevationProfile: null, travelMode: "walk" });
  let aPromises = aTravelTimes.map(addElevationProfileToTravelTime);
  let aResults = await Promise.all(aPromises);
  // persist the results
  await UPSERT(aResults).into(TravelTimes);
  return `Updated ${aResults.length} TravelTimes; Max 250`;
}

function addElevationProfileToTravelTime(oTravelTime) {
  return new Promise((resolve, reject) => {
    let aLocations = oTravelTime.positionString.split(";0;");
    aLocations.pop();
    // map from  "<longitude>;<latitude>" to lat lng
    aLocations = aLocations.map(location => location.split(";").reverse().join(","));

    // keep a max of 512 locations
    // sort out inner points
    const maxLocations = 128;
    if (aLocations.length > maxLocations) {
      let aNewLocations = [];
      for (let i = 0; i < aLocations.length; i += Math.ceil(aLocations.length / maxLocations)) {
        aNewLocations.push(aLocations[i]);
      }
      aLocations = aNewLocations
    }

    fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${aLocations.join("|")}&key=${process.env.GOOLGE_MAPS_API_KEY}`)
      .then(r => r.json())
      .then(j => {
        if (j.status != "OK") {
          console.error("Error getting Elevation Profile");
          console.error("Request: " + JSON.stringify(aLocations));
          reject(j);
        }
        // expected result:
        // {
        //   "results":
        //   [
        //     {
        //       "elevation": 1608.637939453125,
        //       "location": { "lat": 39.7391536, "lng": -104.9847034 },
        //       "resolution": 4.771975994110107,
        //     },
        //   ],
        // "status": "OK",
        // }

        if (j.results.length == 0) {
          resolve(oTravelTime);
          return;
        }
        // determine max and min elevation as well as the total elevation gain and loss
        let lastElevation = j.results[0].elevation;
        let maxElevation = j.results[0].elevation;
        let minElevation = j.results[0].elevation;
        let elevationGain = 0;
        let elevationLoss = 0;
        let elevationProfile = [];
        j.results.forEach(location => {
          elevationProfile.push(location.elevation);
          let elevation = location.elevation;
          if (elevation > maxElevation) {
            maxElevation = elevation;
          }
          if (elevation < minElevation) {
            minElevation = elevation;
          }
          // at least 1m difference
          if (elevation > lastElevation + 1 || elevation < lastElevation - 1) {
            if (elevation > lastElevation) {
              elevationGain += elevation - lastElevation;
            } else if (elevation < lastElevation) {
              elevationLoss += lastElevation - elevation;
            }
          }
          lastElevation = elevation;
        });

        oTravelTime.elevationGain = elevationGain;
        oTravelTime.elevationLoss = elevationLoss;
        oTravelTime.maxElevation = maxElevation;
        oTravelTime.minElevation = minElevation;
        oTravelTime.elevationProfile = elevationProfile.join(";");
        resolve(oTravelTime);
      }
      );
  });
}

function normalizePlaceSearchQuery(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function clampPlaceSearchLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return PLACE_SEARCH_DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(PLACE_SEARCH_MAX_RESULTS, parsed));
}

function roundPlaceSearchBias(value, fallback, min, max) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.max(min, Math.min(max, parsed));
  return Number(clamped.toFixed(1)); // enforce 1 decimal everywhere
}

function buildPlaceSearchCacheKey(query, latitudeRounded, longitudeRounded) {
  return `${query}|${latitudeRounded.toFixed(1)}|${longitudeRounded.toFixed(1)}`;
}

function parseCachedPlaceResults(payload) {
  if (typeof payload !== 'string' || payload.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(place => ({
        placeId: typeof place?.placeId === 'string' ? place.placeId : '',
        name: typeof place?.name === 'string' ? place.name : '',
        formattedAddress: typeof place?.formattedAddress === 'string' ? place.formattedAddress : '',
        latitude: Number(place?.latitude),
        longitude: Number(place?.longitude),
        provider: 'google'
      }))
      .filter(place =>
        place.placeId &&
        place.name &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
      );
  } catch {
    return [];
  }
}

async function fetchPlacesFromGoogle({ query, latitude, longitude, limit }) {
  const apiKey = process.env.GOOLGE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": "places.id,places.displayName,places.formattedAddress,places.location"
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "de",
      regionCode: "DE",
      maxResultCount: limit,
      locationBias: {
        circle: {
          center: {
            latitude,
            longitude
          },
          radius: PLACE_SEARCH_BIAS_RADIUS_METERS
        }
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Places API failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const places = Array.isArray(payload?.places) ? payload.places : [];

  return places
    .map(place => {
      const latitudeValue = Number(place?.location?.latitude);
      const longitudeValue = Number(place?.location?.longitude);
      const placeId = typeof place?.id === 'string' ? place.id.trim() : '';
      const name = typeof place?.displayName?.text === 'string' ? place.displayName.text.trim() : '';
      const formattedAddress =
        typeof place?.formattedAddress === 'string' ? place.formattedAddress.trim() : '';

      if (!placeId || !name || !Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
        return null;
      }

      return {
        placeId,
        name,
        formattedAddress,
        latitude: latitudeValue,
        longitude: longitudeValue,
        provider: 'google'
      };
    })
    .filter(Boolean);
}

async function searchPlacesByName(req) {
  const { PlaceSearchCache } = this.entities('hwb.db');
  const queryInput = typeof req.data?.query === 'string' ? req.data.query : '';
  const normalizedQuery = normalizePlaceSearchQuery(queryInput);

  if (normalizedQuery.length < PLACE_SEARCH_MIN_QUERY_LENGTH) {
    return [];
  }

  const requestedLimit = clampPlaceSearchLimit(req.data?.limit);
  const latitudeRounded = roundPlaceSearchBias(
    req.data?.latitude,
    PLACE_SEARCH_DEFAULT_LATITUDE,
    -90,
    90
  );
  const longitudeRounded = roundPlaceSearchBias(
    req.data?.longitude,
    PLACE_SEARCH_DEFAULT_LONGITUDE,
    -180,
    180
  );
  const cacheKey = buildPlaceSearchCacheKey(normalizedQuery, latitudeRounded, longitudeRounded);

  try {
    const cacheEntry = await SELECT.one.from(PlaceSearchCache).where({ cacheKey });
    if (cacheEntry?.expiresAt && new Date(cacheEntry.expiresAt).getTime() > Date.now()) {
      const cachedResults = parseCachedPlaceResults(cacheEntry.payload);
      return cachedResults.slice(0, requestedLimit);
    }
  } catch (error) {
    console.error('searchPlacesByName cache lookup failed', error);
  }

  let places = [];
  try {
    places = await fetchPlacesFromGoogle({
      query: queryInput.trim(),
      latitude: latitudeRounded,
      longitude: longitudeRounded,
      limit: PLACE_SEARCH_MAX_RESULTS
    });
  } catch (error) {
    console.error('searchPlacesByName provider call failed', error);
    return [];
  }

  const ttlMs = places.length > 0 ? PLACE_SEARCH_CACHE_TTL_HIT_MS : PLACE_SEARCH_CACHE_TTL_EMPTY_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  try {
    await UPSERT.into(PlaceSearchCache).entries({
      cacheKey,
      queryNormalized: normalizedQuery,
      biasLatitudeRounded: latitudeRounded,
      biasLongitudeRounded: longitudeRounded,
      payload: JSON.stringify(places),
      expiresAt
    });
  } catch (error) {
    console.error('searchPlacesByName cache upsert failed', error);
  }

  places = places.filter(isInsideHarzRadius);
  return places.slice(0, requestedLimit);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function isInsideHarzRadius(place) {
  const harzCenterLat = PLACE_SEARCH_DEFAULT_LATITUDE;
  const harzCenterLon = PLACE_SEARCH_DEFAULT_LONGITUDE;
  return distanceInMeters(
    harzCenterLat,
    harzCenterLon,
    place.latitude,
    place.longitude
  ) <= PLACE_SEARCH_BIAS_RADIUS_METERS;
}

async function stampForGroup(req) {
  const { Stampings, Friendships } = this.entities('hwb.db');
  const { sStampId, sGroupUserIds, bStampForUser } = req.data;
  const nowIso = new Date().toISOString();

  // Extract group user IDs into an array
  const groupUserIds = sGroupUserIds?.split(',') || [];

  // Find friends allowed to stamp for the current user
  const friendsAllowedToStamp = await SELECT
    .from(Friendships)
    .where({
      isAllowedToStampForFriend: true,
      toUser_ID: req.user.id,
      fromUser_ID: { in: groupUserIds }
    });

  // Prepare stampings for friends and optionally for the current user
  const stampings = friendsAllowedToStamp.map(friend => ({
    stamp_ID: sStampId,
    createdBy: friend.fromUser_ID,
    visitedAt: nowIso
  }));

  if (bStampForUser) {
    stampings.push({ 
      stamp_ID: sStampId,
      createdBy: req.user.id,
      visitedAt: nowIso
    });
  }

  // Filter out existing stampings to avoid duplicates
  const existingStampings = await SELECT
    .from(Stampings)
    .where({
      stamp_ID: sStampId,
      createdBy: { in: stampings.map(stamping => stamping.createdBy) }
    });

  const existingStampingIds = existingStampings.map(stamping => `${stamping.stamp_ID}-${stamping.createdBy}`);
  const newStampings = stampings.filter(stamping => !existingStampingIds.includes(`${stamping.stamp_ID}-${stamping.createdBy}`));

  // Insert new stampings
  if (newStampings.length > 0) {
    await INSERT.into(Stampings).entries(newStampings);
  }

  return "ok";
}

async function backfillMissingVisitedAt(req) {
  const { Stampings } = this.entities('hwb.db');
  const stampingsMissingVisitedAt = await SELECT
    .from(Stampings)
    .columns('ID', 'createdAt')
    .where({ visitedAt: null });

  if (!stampingsMissingVisitedAt.length) {
    return 0;
  }

  let updatedCount = 0;
  for (const stamping of stampingsMissingVisitedAt) {
    const visitedAt = stamping.createdAt || new Date().toISOString();
    await UPDATE(Stampings)
      .set({ visitedAt })
      .where({ ID: stamping.ID });
    updatedCount += 1;
  }

  return updatedCount;
}

async function getStampFriendVisits(req) {
  const { Stampings, ExternalUsers } = this.entities('hwb.db');
  const { MyFriends } = this.api.entities;
  const { sStampId, sGroupUserIds } = req.data || {};

  if (!sStampId) {
    req.error(400, 'sStampId is required');
    return JSON.stringify([]);
  }

  const myAcceptedFriends = await SELECT
    .from(MyFriends)
    .where({
      createdBy: req.user.id,
      status: 'accepted'
    });
  const acceptedFriendIds = myAcceptedFriends
    .map(friend => friend.ID)
    .filter(Boolean);

  if (acceptedFriendIds.length === 0) {
    return JSON.stringify([]);
  }

  const requestedFriendIds = sGroupUserIds && sGroupUserIds.trim().length > 0
    ? sGroupUserIds.split(',').map(userId => userId.trim()).filter(Boolean)
    : acceptedFriendIds;
  const allowedRequestedIds = requestedFriendIds.filter(userId => acceptedFriendIds.includes(userId));

  if (allowedRequestedIds.length === 0) {
    return JSON.stringify([]);
  }

  const allStampings = await SELECT
    .from(Stampings)
    .where({
      stamp_ID: sStampId,
      createdBy: { in: allowedRequestedIds }
    });

  const latestByFriendId = new Map();
  for (const stamping of allStampings) {
    const friendId = stamping.createdBy;
    if (!friendId) {
      continue;
    }

    const current = latestByFriendId.get(friendId);
    const nextTime = stamping.visitedAt || stamping.createdAt;
    const currentTime = current ? (current.visitedAt || current.createdAt) : undefined;

    if (
      !current ||
      new Date(nextTime || 0).getTime() > new Date(currentTime || 0).getTime()
    ) {
      latestByFriendId.set(friendId, stamping);
    }
  }

  const friendIds = Array.from(latestByFriendId.keys());
  if (friendIds.length === 0) {
    return JSON.stringify([]);
  }

  const friendUsers = await SELECT
    .from(ExternalUsers)
    .columns('ID', 'name', 'picture')
    .where({ ID: { in: friendIds } });
  const userById = new Map(friendUsers.map(user => [user.ID, user]));

  const visits = Array.from(latestByFriendId.entries())
    .map(([friendId, stamping]) => {
      const user = userById.get(friendId);
      const timestamp = stamping.visitedAt || stamping.createdAt;

      return {
        friendId,
        name: user?.name || friendId,
        picture: user?.picture,
        stampingId: stamping.ID,
        visitedAt: stamping.visitedAt || null,
        createdAt: stamping.createdAt || null,
        timestamp: timestamp || null
      };
    })
    .sort((left, right) =>
      new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime()
    );

  return JSON.stringify(visits);
}

async function getUsersProgress(req) {
  const { Stampings, Stampboxes } = this.entities('hwb.db');
  const data = req.data || {};
  const csvIds = typeof data.sGroupUserIds === 'string'
    ? data.sGroupUserIds.split(',').map(id => id.trim()).filter(Boolean)
    : [];
  const arrayIds = Array.isArray(data.userIds)
    ? data.userIds.map(id => `${id}`.trim()).filter(Boolean)
    : [];
  const userIds = Array.from(new Set([...arrayIds, ...csvIds]));

  if (userIds.length === 0) {
    return JSON.stringify([]);
  }

  const allStampboxes = await SELECT
    .from(Stampboxes)
    .columns('ID');
  const totalCount = allStampboxes.length;

  const stampings = await SELECT
    .from(Stampings)
    .columns('createdBy', 'stamp_ID')
    .where({
      createdBy: { in: userIds }
    });
  const stampedIdsByUser = new Map();

  for (const stamping of stampings) {
    const userId = stamping.createdBy;
    const stampId = stamping.stamp_ID;
    if (!userId || !stampId) {
      continue;
    }

    let stampedIds = stampedIdsByUser.get(userId);
    if (!stampedIds) {
      stampedIds = new Set();
      stampedIdsByUser.set(userId, stampedIds);
    }

    stampedIds.add(stampId);
  }

  const progress = userIds.map(userId => {
    const visitedCount = stampedIdsByUser.get(userId)?.size || 0;
    const completionPercent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

    return {
      userId,
      visitedCount,
      completionPercent
    };
  });

  return JSON.stringify(progress);
}

async function addIsAllowedToStampForFriend(aMyFriends, req) {
  if( !(aMyFriends.length && aMyFriends[0].ID)){
    return aMyFriends;
  }
  const { Friendships } = this.entities('hwb.db');

  const aCanCurrentUserStampFor = await SELECT
    .from(Friendships)
    .where({ 
      toUser_ID: req.user.id,
      isAllowedToStampForFriend: true
    });
    const aCanStampForIds = aCanCurrentUserStampFor.map( f => f.fromUser_ID);

    for (let i = 0; i < aMyFriends.length; i++) {
      const oFriend = aMyFriends[i];
      oFriend.isAllowedToStampForFriend = aCanStampForIds.includes(oFriend.ID)
    }
    return aMyFriends;
}
