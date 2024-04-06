const fs = require('fs');
const {
    v4: uuidv4
} = require('uuid');

let data = JSON.parse(fs.readFileSync('./2024_04_06_manuell_Park4Night.json', {
    encoding: 'utf8',
    flag: 'r'
}));

data = data.map(poi => {
    let name = poi.title_short.split(") ")[1];
    return {
        ID: uuidv4(),
        longitude: poi.lng,
        latitude: poi.lat,
        name,
        description: poi.description
    }
})
//map to csv ordered string
.map(poi => `${poi.ID};${poi.longitude};${poi.latitude};${poi.name};${poi.description}`)
.join("\n");
// Display the file data
console.log(data);
fs.writeFile('parsedParkingSpaces.csv', data, 'utf8', () => {});