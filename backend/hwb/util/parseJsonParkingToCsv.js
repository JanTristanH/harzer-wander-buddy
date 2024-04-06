const fs = require('fs');
const {
    v4: uuidv4
} = require('uuid');

let data = JSON.parse(fs.readFileSync('./2024_04_06_manuell_Park4Night.json', {
    encoding: 'utf8',
    flag: 'r'
}));

data = data.pois;

data = data.map(poi => {
    let name = poi.title_short.split(") ")[1];
    return {
        ID: uuidv4(),
        validFrom: "1970-01-01T00:00:01.0+00:00",
        validTo: "2037-12-31T23:00:01.000Z",
        longitude: poi.point.lng,
        latitude: poi.point.lat,
        name,
        description: poi.description
    }
})
//map to csv ordered string
.map(poi => `${poi.ID};${poi.validFrom};${poi.validTo};${poi.longitude};${poi.latitude};${poi.name};${poi.description};`)
.join("\n");
// Display the file data
console.log(data);