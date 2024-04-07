const cds = require('@sap/cds/lib')

module.exports = class api extends cds.ApplicationService { init(){
  this.on ('calculateTravelTimesNNearestNeighbors', calculateTravelTimesNNearestNeighbors)
  this.before ('*', console.log)
  return super.init()
}}

/** Generate primary keys for target entity in request */
async function calculateTravelTimesNNearestNeighbors (req) {
    const {n} = req.data

    // p -> p via car
    // p -> s via foot (later bike)
    // calculate first for stamps, then parking spaces

    // fetch all stamps and iterate
    // get n nearest stamp neighbors
    // get n nearest parking spaces
    // calculate travel time by foot via maps api

    // save


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