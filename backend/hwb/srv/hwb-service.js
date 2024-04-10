const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const fetch = require('node-fetch');
require("dotenv").config();

module.exports = class api extends cds.ApplicationService {
  init() {


    const full = this.entities('hwb.db')

    this.on('calculateTravelTimesNNearestNeighbors', calculateTravelTimesNNearestNeighbors)
    return super.init()
  }
}

/** calculate travel times to neighbors via maps api */
async function calculateTravelTimesNNearestNeighbors(req) {
  const { n } = req.data
  const { Stampboxes, TravelTimes, ParkingSpots } = this.entities('hwb.db')
  const { NeighborsStampStamp, NeighborsStampParking, NeighborsParkingStamp, NeighborsParkingParking  } = this.api.entities

  // p -> p via car
  // p -> s via foot (later bike)
  // calculate first for stamps, then parking spaces

  // fetch all stamps and iterate
  let aStampBoxes = await SELECT
    .from(Stampboxes);
  aStampBoxes = [{ ID: "bebf5cd4-e427-4297-a490-0730968690c2", longitude: 10.615779999999972, latitude: 51.80054 }]; // for testing

  for (let i = 0; i < aStampBoxes.length; i++) {
    const box = aStampBoxes[i];

    // get n nearest stamp neighbors
    let adjacentStamps = await SELECT
      .from(NeighborsStampStamp)
      .where({ ID: box.ID })
      .limit(n);

    // get n nearest parking spaces
    let adjacentParkingSpots = await SELECT
      .from(NeighborsStampParking)
      .where({ ID: box.ID })
      .limit(n);

    let neighborPois = adjacentStamps.concat(adjacentParkingSpots);
    // calculate travel time by foot via maps api
    let aTravelTimes = await getTravelTimes(box, neighborPois, 'walk');
    // save to table
    await UPSERT(aTravelTimes).into(TravelTimes)
  }

  //repeat same for parking spaces

  // fetch all parking spaces and iterate
  let aParkingSpots =  SELECT
    .from(ParkingSpots);

    aParkingSpots = [{ ID: "07d7006d-1ab8-4b43-9722-d8710d148492", longitude: 10.55049, latitude: 51.784652 }]; // for testing

  for (let i = 0; i < aParkingSpots.length; i++) {
    const spot = aParkingSpots[i];

    // get n nearest stamp neighbors
    let adjacentStamps = await SELECT
      .from(NeighborsParkingStamp)
      .where({ ID: spot.ID })
      .limit(n);

    // calculate travel time by foot via maps api
    let aTravelTimesWalk = await getTravelTimes(spot, adjacentStamps, 'walk');

      // get n nearest parking spaces
    let adjacentParkingSpots = await SELECT
      .from(NeighborsParkingParking)
      .where({ ID: spot.ID })
      .limit(n - 5);

    // calculate travel time by car via maps api
    let aTravelTimesDrive = await getTravelTimes(spot, adjacentParkingSpots, 'drive');

    let aTravelTimes = aTravelTimesWalk.concat(aTravelTimesDrive);
    // save to table
    await UPSERT(aTravelTimes).into(TravelTimes)
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

      result.push({
        ID: uuidv4(),
        fromPoi: box.ID,
        toPoi: neighbor.ID,
        durationSeconds: oRoute.routes[0].duration.split('s')[0],
        distanceMeters: oRoute.routes[0].distanceMeters,
        travelMode,
        positionString: mapPolyLineToPositionString(oRoute.routes[0].polyline.geoJsonLinestring.coordinates)

        //Waypoint Route
      })

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