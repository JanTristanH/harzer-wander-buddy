const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

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
  const { Stampboxes, TravelTimes } = this.entities('hwb.db')
  const { NeighborsStampStamp, NeighborsStampParking } = this.api.entities

  // p -> p via car
  // p -> s via foot (later bike)
  // calculate first for stamps, then parking spaces

  // fetch all stamps and iterate
  let aStampBoxes = await SELECT
    `ID`
    .from(Stampboxes);

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
      .limit(n - 2);

    let neighborPois = adjacentStamps.concat(adjacentParkingSpots);
    // calculate travel time by foot via maps api
    let aTravelTimes = await getTravelTimes(box, neighborPois, 'drive');
    // save to table
    await UPSERT(aTravelTimes).into(TravelTimes)
  }
  let blub = 1;

  // repeat same for parking spaces

  // fetch all parking spaces and iterate
  // get n nearest stamp neighbors
  // calculate travel time by foot via maps api
  // get n nearest parking spaces
  // calculate travel time by car via maps api

  // let b = await SELECT `stock` .from (Stampboxes)

  // await UPDATE (Books,book) .with ({ stock: stock -= quantity })

  return { n }
}

function getTravelTimes(box, neighborPois, travelMode) {
  return new Promise((resolve, reject) => {

    let result = [];
    for (let i = 0; i < neighborPois.length; i++) {
      const neighbor = neighborPois[i];
      result.push({
        ID: uuidv4(),
        fromPoi: box.ID,
        toPoi: neighbor.ID,
        durationSeconds: 5,
        distanceMeters: 5,
        travelMode,
        encodedPolyLine: ""

        //Waypoint Route
      })

    }
    resolve(result)
  });
}