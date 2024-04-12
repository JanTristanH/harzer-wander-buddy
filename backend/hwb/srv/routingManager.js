const cds = require('@sap/cds/lib')

async function loadSubTree(ID) {
    const visited = new Set(); // A set to keep track of visited nodes

    return new Promise(async (resolve, reject) => {
        try {
            const initialRecords = await cds.run(SELECT.from('hwb_db_TravelTimes').where({ fromPoi: ID }));

            async function fetchSubTree(records) {
                if (records.length === 0) {
                    // Termination condition: No more records to process
                    return;
                }

                console.log('Processing records:', records); // For debugging
                const promises = [];

                for (let record of records) {
                    // Check if the node has already been visited
                    if (visited.has(record.toPoi)) {
                        continue; // Skip this record if it has been visited
                    }
                    visited.add(record.toPoi); // Mark this node as visited

                    const childRecordsPromise = cds.run(SELECT.from('hwb_db_TravelTimes').where({ fromPoi: record.toPoi }))
                        .then(childRecords => {
                            console.log('Child records for', record.toPoi, ':', childRecords); // For debugging
                            record.children = childRecords;
                            return fetchSubTree(childRecords); // Recursive call
                        });

                    promises.push(childRecordsPromise);
                }

                return Promise.all(promises);
            }

            await fetchSubTree(initialRecords);
            resolve(initialRecords);
        } catch (error) {
            console.error('Error in loadSubTree:', error); // For debugging
            reject(error);
        }
    });
}

async function calculateHikingRoutes(calculationParams, aTravelTimes) {
    // Create an adjacency list where each edge is directional
    const adjacencyList = new Map();
    aTravelTimes.forEach(edge => {
        if (!adjacencyList.has(edge.fromPoi)) {
            adjacencyList.set(edge.fromPoi, []);
        }
        adjacencyList.get(edge.fromPoi).push(edge);
    });

    const routes = [];
    const visited = new Set();

    const dfs = (poi, poiType, path, duration, distance, depth, stampCount) => {
        if (duration > calculationParams.maxDuration || distance > calculationParams.maxDistance || depth > calculationParams.maxDepth) {
            return;
        }
        if (poi === calculationParams.startId && path.length > 1) {
            routes.push({ path: path, stampCount: stampCount, distance, duration });
            return;
        }

        visited.add(poi);
        const neighbors = adjacencyList.get(poi);
        neighbors.forEach(neighbor => {
            if (!path.map(p => p.poi).includes(neighbor.toPoi) || neighbor.toPoi === calculationParams.startId) {
                let newDistance = distance;
                let newStampCount = stampCount;

                // Increment distance only if travel mode is not 'drive'
                if (neighbor.travelMode !== 'drive') {
                    //TODO only allow drive where the car is parked
                    newDistance += parseInt(neighbor.distanceMeters);
                }

                // Increment stamp count if poi is of type 'stamp'
                if (neighbor.toPoiType === 'stamp' && !path.map(p => p.poi).includes(neighbor.toPoi)) {
                    newStampCount++;
                }

                dfs(neighbor.toPoi, neighbor.toPoiType, path.concat({ poi: neighbor.toPoi, id: neighbor.ID, name: neighbor.name, toPoiType: neighbor.toPoiType }), duration + parseInt(neighbor.durationSeconds), newDistance, depth + 1, newStampCount);
            }
        });

        if (poi !== calculationParams.startId) {
            visited.delete(poi);
            if (poiType === 'stamp') {
            }
        }
    };

    dfs(calculationParams.startId, "start", [{ poi: calculationParams.startId, id: null, name: "Sart" }], 0, 0, 0, 0);

   let sortedRoutes =  routes.filter(route => route.stampCount > 0)
        .sort((a, b) => {
            if (b.stampCount - a.stampCount === 0) {  // If stampCounts are equal, use secondary sort
                const valueA = a.stampCount / (a.distance + a.duration);
                const valueB = b.stampCount / (b.distance + b.duration);
                return valueB - valueA;
            }
            return b.stampCount - a.stampCount;  // Primary sort by stampCount
        });

        //Only return top 5
        return filterUniquePaths(sortedRoutes)
        .slice(0, 5);
}


function filterUniquePaths(paths) {
    // Object to store unique sets of POIs
    const uniquePaths = [];
    const seenPOISets = new Set();

    // Iterate through each path in the data
    paths.forEach(path => {
        // Create a set of POIs from the current path to ensure uniqueness and to ignore order
        const poiSet = new Set(path.path.filter( poi => poi.toPoiType == "stamp").map(poi => poi.poi));

        // Convert the set to a string to use as a unique key (since sets cannot be directly compared)
        const poiSetKey = Array.from(poiSet).sort().join(',');

        // Check if we have already seen this set of POIs
        if (!seenPOISets.has(poiSetKey)) {
            // If not seen, add to the seen sets and to the results
            seenPOISets.add(poiSetKey);
            uniquePaths.push(path);
        }
    });
    return uniquePaths
}

exports.loadSubTree = loadSubTree;
exports.calculateHikingRoutes = calculateHikingRoutes;
