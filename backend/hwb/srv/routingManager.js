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

async function calculateHikingRoutes(calculationParamsOuter, aTravelTimes, aStampsDoneByUser) {
    return new Promise(async (resolve, reject) => {
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

        const dfs = (poi, poiType, path, duration, distance, depth, stampCount, canDrive, calculationParamsInner) => {
            if (duration > calculationParamsInner.maxDuration ||
                distance > calculationParamsInner.maxDistance ||
                depth > calculationParamsInner.maxDepth) {
                return;
            }
            if (poi === calculationParamsInner.startId && calculationParamsInner.pathLengthSinceCar > 1) {
                routes.push({ path: path, stampCount: stampCount, distance, duration });
                if (!calculationParamsInner.allowDriveInRoute) {
                    return;
                }
                canDrive = true; //we are again at out parking spot and can drive again
            }

            visited.add(poi);
            const neighbors = adjacencyList.get(poi);
            neighbors.forEach(neighbor => {
                if (!path.map(p => p.poi).includes(neighbor.toPoi) || neighbor.toPoi === calculationParamsInner.startId) {
                    let newDistance = distance;
                    let newStampCount = stampCount;

                    let calculationParamsInnerClone = { ...calculationParamsInner };
                    // Increment distance only if travel mode is not 'drive'
                    if (neighbor.travelMode !== 'drive') {
                        newDistance += parseInt(neighbor.distanceMeters);
                    } else if (canDrive) {
                        //update car location to new parking space
                        calculationParamsInnerClone.startId = neighbor.toPoi;
                        calculationParamsInnerClone.pathLengthSinceCar = 0;
                        canDrive = false;
                    } else {
                        // can not drive as car is parked at other space.
                        // Path invalid and return
                        return;
                    }
                    calculationParamsInnerClone.pathLengthSinceCar++;

                    // Increment stamp count if poi is of type 'stamp'
                    if (neighbor.toPoiType === 'stamp'
                        && !path.map(p => p.poi).includes(neighbor.toPoi)
                        && !aStampsDoneByUser.includes(neighbor.toPoi)) {
                        newStampCount++;
                    }

                    dfs(neighbor.toPoi,
                        neighbor.toPoiType,
                        path.concat({
                            poi: neighbor.toPoi,
                            id: neighbor.ID,
                            name: neighbor.name,
                            toPoiType: neighbor.toPoiType,
                            travelMode: neighbor.travelMode,
                            duration: neighbor.durationSeconds,
                            distance: neighbor.distanceMeters
                        }),
                        duration + parseInt(neighbor.durationSeconds),
                        newDistance,
                        depth + 1,
                        newStampCount,
                        canDrive,
                        calculationParamsInnerClone);
                }
            });

            if (poi !== calculationParamsInner.startId) {
                visited.delete(poi);
                if (poiType === 'stamp') {
                }
            }
        };

        calculationParamsOuter.pathLengthSinceCar = 1;
        dfs(calculationParamsOuter.startId, "Start", [{ poi: calculationParamsOuter.startId, id: null, name: "Start" }], 0, 0, 0, 0, false, calculationParamsOuter);

        let sortedRoutes = routes.filter(route => route.stampCount >= calculationParamsOuter.minStampCount)
            .sort((a, b) => {
                if (b.stampCount - a.stampCount === 0) {  // If stampCounts are equal, use secondary sort
                    const valueA = a.stampCount / a.distance //(a.distance + a.duration);
                    const valueB = b.stampCount / b.distance //(b.distance + b.duration);
                    return valueB - valueA;
                }
                return b.stampCount - a.stampCount;  // Primary sort by stampCount
            });

        //Only return top 5
        // return sortedRoutes;
        sortedRoutes = filterUniquePaths(sortedRoutes)
            .slice(0, 5);
        sortedRoutes = await addPositionStrings(sortedRoutes);
        resolve(sortedRoutes);
    });
}

function addPositionStrings(aRoutes) {
    return new Promise(async (resolve, reject) => {

        let uniqueIds = new Set();

        aRoutes.forEach(route => {
            route.path.forEach(item => {
                if (item.id) {
                    uniqueIds.add(item.id);
                }
            });
        });

        // Convert Set to Array
        uniqueIds = Array.from(uniqueIds);

        // Format UUIDs for SQL query (ensure each UUID is surrounded by single quotes)
        const formattedIds = uniqueIds.map(id => `'${id}'`).join(',');

        // Read required positionStrings
        const aTravelTimesWithPositionString = await cds.run(SELECT.from('hwb_db_TravelTimes').where(`ID in (${formattedIds})`));
        const dataMap = aTravelTimesWithPositionString.reduce((map, obj) => {
            map[obj.ID] = obj.positionString;
            return map;
        }, {});

        let i = 0;
        aRoutes.forEach(route => {
            route.id = i;
            i++;
            let itemOrder = 0;
            route.path.forEach(item => {
                item.positionString = dataMap[item.id];
                item.order = itemOrder;
                itemOrder++;
            });
        });
        resolve(aRoutes);
    })
}


function filterUniquePaths(paths) {
    // Object to store unique sets of POIs
    const uniquePaths = [];
    const seenPOISets = new Set();

    // Iterate through each path in the data
    paths.forEach(path => {
        // Create a set of POIs from the current path to ensure uniqueness and to ignore order
        const poiSet = new Set(path.path.filter(poi => poi.toPoiType == "stamp").map(poi => poi.poi));

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
