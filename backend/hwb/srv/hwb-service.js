const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const fetch = require('node-fetch');
const routingManager = require('./routingManager')

const MAX_REQUESTS_PER_CALL = process.env.MAX_REQUESTS_PER_CALL ? process.env.MAX_REQUESTS_PER_CALL : 1000;
// 40.000 free 
//  2.500 used
let count = 0;
let countRequest = 0;
let aTravelTimesGlobal = [];

module.exports = class api extends cds.ApplicationService {
  init() {

    this.after('READ', `Stampboxes`, (stampBoxes, req) => {
      return stampBoxes.map(box => {
        if (box.Stampings) {
          box.Stampings = box.Stampings.filter(s => s.createdBy == req.user.id);
        }
        return box;
      });
    })

    this.after('CREATE', 'Tours', async (req) => {
      return upsertTourDetailsById(req, this.entities('hwb.db'));
    });

    this.on('calculateTravelTimesNNearestNeighbors', calculateTravelTimesNNearestNeighbors.bind(this))

    this.on('getMissingTravelTimesCount', getMissingTravelTimesCount.bind(this))

    this.on('calculateHikingRoute', calculateHikingRoute)

    this.on("DeleteSpotWithRoutes", deleteSpotWithRoutes)

    this.on('READ', 'TypedTravelTimes', async (req) => {
      // const db = cds.transaction(req);

      return typedTravelTimes;
    });

    return super.init()
  }
}

function upsertTourDetailsById(req, entities) {
  const {Tour2TravelTime } = entities;
  //TODO recalculate Details of distance & duration
  const aTravelTimeIds = req.idListTravelTimes.split(";");
  let aTour2TravelTime = aTravelTimeIds.map( travelTime_ID => {
    return {
      travelTime_ID,
      tour_ID: req.ID
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

      let oRoute = await calculateRoute(box, neighbor, travelMode);

      if (oRoute && oRoute.routes && oRoute.routes[0]) {
        result.push({
          ID: uuidv4(),
          fromPoi: box.ID,
          toPoi: neighbor.NeighborsID,
          durationSeconds: oRoute.routes[0].duration.split('s')[0],
          distanceMeters: oRoute.routes[0].distanceMeters,
          travelMode,
          //Waypoint Route
          positionString: mapPolyLineToPositionString(oRoute.routes[0].polyline.geoJsonLinestring.coordinates)
        });
      } else if (oRoute != "Quota per Request exceeded!") {
        console.error("Error Calculating Route, received: " + JSON.stringify(oRoute));
      }

    }
    resolve(result)
  });
}

function mapPolyLineToPositionString(aCoordinates) {
  return aCoordinates.map(coordinatePair => coordinatePair.concat([0]))
    .map(coordinatePair => coordinatePair.join(";"))
    .join(";")
}

function calculateRoute(pointA, pointB, travelMode) {
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
        console.log("computeRoutes: " + j);
        resolve(j);
      }
      );
  });
}
