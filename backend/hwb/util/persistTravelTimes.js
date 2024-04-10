const fetch = require('node-fetch');
const fs = require('fs');

const url = 'http://localhost:4004/odata/v2/api/TravelTimes';
const auth = 'Basic ' + Buffer.from('Kevin:pass').toString('base64');
const results = [];

const fetchData = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': auth }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    results.push(...data.d.results);

    if (data.d.__next) {
      await fetchData(data.d.__next);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

const saveToFile = () => {
  fs.writeFile('TravelTime.json', JSON.stringify(results, null, 2), (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    } else {
      console.log('Data saved to TravelTime.json');
    }
  });
};

fetchData(url).then(saveToFile);
