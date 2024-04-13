const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const fetch = require('node-fetch');
require("dotenv").config();
const routingManager = require('./routingManager')

// 40.000 free 
// 10.815 used
let count = 0;
let aTravelTimesGlobal = [];

module.exports = class api extends cds.ApplicationService {
  init() {


    const full = this.entities('hwb.db')

    this.on('calculateTravelTimesNNearestNeighbors', calculateTravelTimesNNearestNeighbors)

    this.on('calculateHikingRoute', calculateHikingRoute)

    
    this.on('READ', 'TypedTravelTimes', async (req) => {
      // const db = cds.transaction(req);
      
      
      return typedTravelTimes;
    });
    
    return super.init()
  }
}

async function calculateHikingRoute(req) {
  req.data.startId = "5810c033-235d-4836-b09d-f7829929e2fe";
  console.log(req.data);
  if (aTravelTimesGlobal.length == 0){
    const { typedTravelTimes } = this.api.entities
    aTravelTimesGlobal = await SELECT
      .columns('ID', 'fromPoi', 'toPoi', 'toPoiType', 'durationSeconds', 'distanceMeters', 'travelMode', 'name')
      .from(typedTravelTimes);

  }
  let results = await routingManager.calculateHikingRoutes(req.data, aTravelTimesGlobal);
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

/** calculate travel times to neighbors via maps api */
async function calculateTravelTimesNNearestNeighbors(req) {
  const { n } = req.data
  const { Stampboxes, TravelTimes, ParkingSpots } = this.entities('hwb.db')
  const { NeighborsStampStamp, NeighborsStampParking, NeighborsParkingStamp, NeighborsParkingParking } = this.api.entities

  // p -> p via car
  // p -> s via foot (later bike)
  // calculate first for stamps, then parking spaces

  // fetch all stamps and iterate
  let aStampBoxes = await SELECT
    .from(Stampboxes);
  aStampBoxes = []; //disable

  // for (let i = 0; i < aStampBoxes.length; i++) {
  //   const box = aStampBoxes[i];

  //   // get n nearest stamp neighbors
  //   let adjacentStamps = await SELECT
  //     .from(NeighborsStampStamp)
  //     .where({ ID: box.ID })
  //     .limit(n);

  //   // get n nearest parking spaces
  //   let adjacentParkingSpots = await SELECT
  //     .from(NeighborsStampParking)
  //     .where({ ID: box.ID })
  //     .limit(n);

  //   let neighborPois = adjacentStamps.concat(adjacentParkingSpots);
  //   // calculate travel time by foot via maps api
  //   let aTravelTimes = await getTravelTimes(box, neighborPois, 'walk');
  //   // save to table
  //   if (aTravelTimes){
  //     await UPSERT(aTravelTimes).into(TravelTimes)
  //   }    
  // }

  //repeat same for parking spaces

  // fetch all parking spaces and iterate
  let aParkingSpots = await SELECT
    .from(ParkingSpots);

  for (let i = 0; i < aParkingSpots.length; i++) {
    const spot = aParkingSpots[i];

    // // get n nearest stamp neighbors
    // let adjacentStamps = await SELECT
    //   .from(NeighborsParkingStamp)
    //   .where({ ID: spot.ID })
    //   .limit(n);
    //   adjacentStamps = []; // disable 

    // // calculate travel time by foot via maps api
    // let aTravelTimesWalk = await getTravelTimes(spot, adjacentStamps, 'walk');
    let aTravelTimesWalk = [];

    // get n nearest parking spaces
    let adjacentParkingSpots = await SELECT
      .from(NeighborsParkingParking)
      .where({ ID: spot.ID })
      .limit(n);

    // calculate travel time by car via maps api
    let aTravelTimesDrive = await getTravelTimes(spot, adjacentParkingSpots, 'drive'); //TODO did this work?

    let aTravelTimes = aTravelTimesWalk.concat(aTravelTimesDrive);
    // save to table
    if (aTravelTimes){
      await UPSERT(aTravelTimes).into(TravelTimes)
    }
  }

  return { n }
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
          positionString: mapPolyLineToPositionString(oRoute.routes[0].polyline.geoJsonLinestring.coordinates)

          //Waypoint Route
        })
      } else {
        let a = 5;
        console.log(JSON.stringify(oRoute));
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
        "x-goog-fieldmask": "routes.duration,routes.distanceMeters,routes.polyline",
        "Referer": "https://developers-dot-devsite-v2-prod.appspot.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": JSON.stringify(body),
      "method": "POST"
    }).then(r => r.json())
      .then(j => resolve(j));
  });
}