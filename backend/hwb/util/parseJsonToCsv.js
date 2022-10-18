const fs = require('fs');
const {
    v4: uuidv4
} = require('uuid');

let data = JSON.parse(fs.readFileSync('./2022_10_18_09_11__stampBoxes.json', {
    encoding: 'utf8',
    flag: 'r'
}));

data = data.pois;

data = data.map(poi => {
    let number = poi.title.match(/\d+/)[0];
    return {
        ID: uuidv4(),
        validFrom: "1970-01-01T00:00:01.0+00:00",
        validTo: "2037-12-31T23:00:01.000Z",
        longitude: poi.point.lng,
        latitude: poi.point.lat,
        name: poi.title,
        description: poi.title + " ~ this will come later: make a get request",
        number
    }
})
//map to csv ordered string
.map(poi => `${poi.ID};${poi.validFrom};${poi.validTo};${poi.longitude};${poi.latitude};${poi.name};${poi.description};${poi.number};`)
.join("\n");
// Display the file data
console.log(data);