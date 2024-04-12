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
    const uniqueStamps = new Set();

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
            if (!visited.has(neighbor.toPoi) || neighbor.toPoi === calculationParams.startId) {
                let newDistance = distance;
                let newStampCount = stampCount;

                // Increment distance only if travel mode is not 'drive'
                if (neighbor.travelMode !== 'drive') {
                    newDistance += parseInt(neighbor.distanceMeters);
                }

                // Increment stamp count if poi is of type 'stamp'
                if (neighbor.toPoiType === 'stamp' && !uniqueStamps.has(neighbor.toPoi)) {
                    newStampCount++;
                    uniqueStamps.add(neighbor.toPoi);
                }

                dfs(neighbor.toPoi, neighbor.toPoiType, path.concat({ poi: neighbor.toPoi, id: neighbor.ID }), duration + parseInt(neighbor.durationSeconds), newDistance, depth + 1, newStampCount);
            }
        });

        if (poi !== calculationParams.startId) {
            visited.delete(poi);
            if (poiType === 'stamp') {
                uniqueStamps.delete(poi);
            }
        }
    };

    dfs(calculationParams.startId, "start", [{ poi: calculationParams.startId, id: null }], 0, 0, 0, 0);

    return routes.filter(route => route.stampCount > 0);
}





exports.loadSubTree = loadSubTree;
exports.calculateHikingRoutes = calculateHikingRoutes;
