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
    // Convert aTravelTimes to an adjacency list
    const adjacencyList = new Map();
    aTravelTimes.forEach(edge => {
        if (!adjacencyList.has(edge.fromPoi)) {
            adjacencyList.set(edge.fromPoi, []);
        }
        if (!adjacencyList.has(edge.toPoi)) {
            adjacencyList.set(edge.toPoi, []);
        }
        adjacencyList.get(edge.fromPoi).push(edge);
        adjacencyList.get(edge.toPoi).push({...edge, fromPoi: edge.fromPoi, toPoi: edge.toPoi});
    });

    const routes = [];
    const visited = new Set();

    const dfs = (poi, path, duration, distance, depth) => {
        if (duration > calculationParams.maxDuration || distance > calculationParams.maxDistance || depth > calculationParams.maxDepth) {
            return;
        }
        if (poi === calculationParams.startId && path.length > 1) {
            routes.push(path);
            return;
        }

        visited.add(poi);
        const neighbors = adjacencyList.get(poi);
        neighbors.forEach(neighbor => {
            if (!visited.has(neighbor.toPoi) || neighbor.toPoi === calculationParams.startId) {
                dfs(neighbor.toPoi, path.concat(neighbor.toPoi), duration + parseInt(neighbor.durationSeconds), distance + parseInt(neighbor.distanceMeters), depth + 1);
            }
        });
        if (poi !== calculationParams.startId) {
            visited.delete(poi);
        }
    };

    dfs(calculationParams.startId, [calculationParams.startId], 0, 0, 0);

    return routes;
}



exports.loadSubTree = loadSubTree;
exports.calculateHikingRoutes = calculateHikingRoutes;
