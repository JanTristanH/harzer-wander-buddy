const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const {onAfterFriendshipCreate, acceptPendingFriendshipRequest} = require('./friendships');

const fetch = require('node-fetch');
const routingManager = require('./routingManager');

const MAX_REQUESTS_PER_CALL = process.env.MAX_REQUESTS_PER_CALL ? process.env.MAX_REQUESTS_PER_CALL : 1000;
// 40.000 free 
//  2.500 used
let count = 0;
let countRequest = 0;
let aTravelTimesGlobal = [];

module.exports = class api extends cds.ApplicationService {
  init() {

    this.after('READ', `Stampboxes`, async (stampBoxes, req) => {
      const Stampings = this.entities('hwb.db').Stampings;
      const aStampings = await SELECT.from(Stampings).where({ createdBy: req.user.id });
      return stampBoxes.map(box => {
        box.hasVisited = !!aStampings.find(s => s.stamp_ID == box.ID);
        return box;
      });
    })

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

    this.on("DeleteSpotWithRoutes", deleteSpotWithRoutes)

    this.on("getTourByIdListTravelTimes", getTourByIdListTravelTimes)

    this.on("updateTourByPOIList", updateTourByPOIList)

    this.on('READ', 'TypedTravelTimes', async (req) => {
      // const db = cds.transaction(req);

      return typedTravelTimes;
    });

    this.on('addElevationToAllTravelTimes', addElevationToAllTravelTimes)

    this.after('CREATE', 'Friendships', onAfterFriendshipCreate);

    this.on('acceptPendingFriendshipRequest', acceptPendingFriendshipRequest);

    return super.init()
  }
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
  let id = req.data.TourID;
  let poiList = req.data.POIList;

  const { typedTravelTimes } = this.api.entities;
  const { Stampboxes, ParkingSpots, TravelTimes, Tour2TravelTime, Tours } = this.entities('hwb.db');

  let aPois = poiList.split(";").filter(p => !!p);
  if(aPois.length < 2){
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

  // Loop through all POI pairs and create the list of required pairs
  for (let i = 0; i < aPois.length - 1; i++) {
    aPoiPairs.push({ fromPoi: aPois[i], toPoi: aPois[i + 1] });
  }

  // Construct a condition string for the WHERE clause to match pairs of POIs
  let conditionString = aPoiPairs
    .map(pair => `(fromPoi = '${pair.fromPoi}' AND toPoi = '${pair.toPoi}')`)
    .join(' OR ');

  // If there are no pairs, skip the query
  if (conditionString.length === 0) {
    conditionString = '1 = 0'; // Just to ensure no results are returned
  }

  // Step 1: Load applicable travel times for the given POI pairs
  let aTravelTimesWithPositionString = await SELECT
    .columns('ID', 'fromPoi', 'toPoi', 'durationSeconds', 'distanceMeters', 'travelMode', 'name', 'elevationLoss', 'elevationGain')
    .from(typedTravelTimes)
    .where(`${conditionString}`);
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

    let travelMode = toPoi.type == toPoi.type == "parking" ? "drive" : "walk";
    let calculatedTravelTime = await getTravelTimes(fromPoi, [toPoi], travelMode);
    calculatedTravelTime = calculatedTravelTime[0];
    // Add the calculated travel time to the array of needed travel times
    aNeededTravelTimes.push(calculatedTravelTime);
  }
  // save the new travel times to the database
  if (aNeededTravelTimes.length > 0) {
    await INSERT(aNeededTravelTimes).into(TravelTimes);
    aTravelTimesWithPositionString = aTravelTimesWithPositionString.concat(aNeededTravelTimes);
  }

  // Update Tour TravelTimes
  let aTour2TravelTime = getRankedTour2TravelTimes(aTravelTimesWithPositionString, aPois, id);

  await DELETE.from(Tour2TravelTime).where({ tour_ID: id });
  await INSERT(aTour2TravelTime).into(Tour2TravelTime);

  let distance = 0, duration = 0, stampCount = 0, idListTravelTimes = "", totalElevationGain = 0, totalElevationLoss = 0;
  for (let i = 0; i < aTravelTimesWithPositionString.length; i++) {
    const oTravelTime = aTravelTimesWithPositionString[i];
    distance += parseInt(oTravelTime.distanceMeters) || 0;
    duration += parseInt(oTravelTime.durationSeconds) || 0;
    totalElevationGain += parseInt(oTravelTime.elevationGain) || 0;
    totalElevationLoss += parseInt(oTravelTime.elevationLoss) || 0;
    idListTravelTimes = idListTravelTimes + aTravelTimesWithPositionString.ID

    if (oStampBoxById[oTravelTime.toPoi]) {
      oStampBoxById[oTravelTime.toPoi] = null;
      stampCount++;
    }

    if (i == 0 && oStampBoxById[oTravelTime.fromPoi]) {
      oStampBoxById[oTravelTime.fromPoi] = null;
      stampCount++;
    }
  }

  let oTour = {
    ID: id,
    distance,
    duration,
    stampCount,
    idListTravelTimes,
    totalElevationGain,
    totalElevationLoss
  }
  await UPSERT(oTour).into(Tours);

  oTour.idListTravelTimes = aTour2TravelTime.map(tt => tt.travelTime_ID).join(";")
  oTour.path = aTour2TravelTime;
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

  let aPathIds = id.split(";").map(id => `'${id}'`);
  aPathIds.unshift("'xx'");

  const aTravelTimesWithPositionString = await SELECT
    .columns('ID', 'fromPoi', 'toPoi', 'toPoiType', 'durationSeconds', 'distanceMeters', 'travelMode', 'name')
    .where(`ID in (${aPathIds.join(',')})`)
    .from(typedTravelTimes);

  let aStampBoxes = await SELECT.from(Stampboxes);
  const currentUser = req.user.id; // Get the current user ID
  let aStampingForUser = await SELECT.from(Stampings).where({ createdBy: currentUser });
  aStampingForUser = aStampingForUser.map(stamping => stamping.stamp_ID);

  let oStampBoxById = {};
  aStampBoxes.forEach(box => {
    box.stampedByUser = !!aStampingForUser[box.ID];
    oStampBoxById[box.ID] = box;
  });

  let distance = 0, duration = 0, stampCount = 0;
  if (aTravelTimesWithPositionString.length == 0) {
    return {
      stampCount: 0,
      distance: 0,
      duration: 0,
      id: "notFound",
      path: []
    };
  }
  for (let i = 0; i < aTravelTimesWithPositionString.length; i++) {
    const oTravelTime = aTravelTimesWithPositionString[i];
    distance += parseInt(oTravelTime.distanceMeters);
    duration += parseInt(oTravelTime.durationSeconds);

    if (oStampBoxById[oTravelTime.toPoi] && oStampBoxById[oTravelTime.toPoi].stampedByUser == false) {
      stampCount++;
    }

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

  const result = await routingManager.addPositionStrings([{
    stampCount,
    distance,
    duration,
    id,
    path
  }]);
  return result[0];
}

async function calculateHikingRoute(req) {
  // req.data.startId = "5810c033-235d-4836-b09d-f7829929e2fe";
  console.log(req.data);
  const { typedTravelTimes, Stampboxes, Stampings } = this.api.entities;
  if (aTravelTimesGlobal.length == 0) {
    aTravelTimesGlobal = await SELECT
      .columns('ID', 'fromPoi', 'toPoi', 'toPoiType', 'durationSeconds', 'distanceMeters', 'travelMode', 'name')
      .from(typedTravelTimes);
  }

  aStampsDoneByUser = await SELECT
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
  countRequest = 0;
  let result = await processTravelTimes.bind(this)(n, getTravelTimes);
  return result;
}

function processTravelTimes(nearestNeighborsCount, processor) {
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
    return processor(spot, adjacentParkingSpots, 'drive');
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
    return processor(spot, adjacentStamps, 'walk');
  }

  async function getTravelTimesStampParkingSpaces(box, aExistingTravelTimes) {
    let adjacentParkingSpots = await SELECT
      .from(NeighborsStampParking)
      .where({ ID: box.ID })
      .limit(nearestNeighborsCount);

    adjacentParkingSpots = adjacentParkingSpots.filter(s => !aExistingTravelTimes.includes(s.NeighborsID));
    missingTravelTimesCount += adjacentParkingSpots.length;
    // calculate travel time by foot via maps api
    return processor(box, adjacentParkingSpots, 'walk');
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

    return processor(box, adjacentStamps, 'walk');
  }
}

function getTravelTimes(box, neighborPois, travelMode) {
  return new Promise(async (resolve, reject) => {

    let result = [];
    for (let i = 0; i < neighborPois.length; i++) {
      const neighbor = neighborPois[i];

      if (neighbor.distanceKm == 0) {
        continue;
      }
      if(!neighbor){
        console.error("Neighbor is missing");
        continue;
      }
      console.info(`Calculating Route from ${box.name}(${box.ID}) to ${neighbor.name}(${neighbor.ID})`);
      let oRoute = await calculateRoute(box, neighbor, travelMode);

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
      } else if (oRoute != "Quota per Request exceeded!") {
        const oError = JSON.stringify(oRoute);
        console.error("Error Calculating Route, received: " + oError);
        reject(oRoute);
      }

    }
    if (travelMode == "walk") {
      // TODO test
      let aPromises = result.map(addElevationProfileToTravelTime);
      Promise.all(aPromises).then(r => resolve(r));
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

function calculateRoute(pointA, pointB, travelMode) {
  if (!pointA || !pointB) {
    console.error("Point A or B is missing");
    Promise.reject("Point A or B is missing");
  }
  if (countRequest >= MAX_REQUESTS_PER_CALL) {
    return Promise.resolve("Quota per Request exceeded!");
  }
  countRequest++;
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
          reject(j);
        }
        resolve(j);
      }
      );
  });
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
    aLocations = oTravelTime.positionString.split(";0;");
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

        if(j.results.length == 0){
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
