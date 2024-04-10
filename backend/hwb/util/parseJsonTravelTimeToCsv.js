const fs = require('fs');

const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
};

const jsonToCsv = (jsonData) => {
  if (!jsonData || !jsonData.length) return '';

  const headers = ['ID', 'fromPoi', 'toPoi', 'durationSeconds', 'distanceMeters', 'travelMode', 'positionString'];
  const csvRows = jsonData.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','));
  
  return [headers.join(','), ...csvRows].join('\r\n');
};

const writeCsvFile = (csvData, filePath) => {
  fs.writeFile(filePath, csvData, (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    } else {
      console.log(`CSV data saved to ${filePath}`);
    }
  });
};

const jsonFilePath = 'TravelTime.json';
const csvFilePath = 'TravelTime.csv';

const jsonData = readJsonFile(jsonFilePath);
const csvData = jsonToCsv(jsonData);
writeCsvFile(csvData, csvFilePath);
