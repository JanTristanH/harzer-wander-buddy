namespace hwb.db;

using {
    temporal,
    cuid
} from '@sap/cds/common';

type User : String(255);

aspect PointOfInterest {
    longitude   : String(40);
    latitude    : String(40);
    name        : String(40);
    description : String(2048);
    image       : String(2048); //LargeBinary @Core.MediaType : 'image/png';
}

@assert.integrity : false
entity Stampboxes : cuid, temporal, PointOfInterest {

    number                 : String(40); // to allow Sonderstempel

    isKidFriendly          : Boolean;
    isElderlyFriendly      : Boolean;
    isStrollerFriendly     : Boolean;
    hasToilet              : Boolean;
    hasFood                : Boolean;
    // parkingSpot            : Composition of many ParkingSpots
    //                              on parkingSpot.target = $self;
    myAdjacentStamp        : Composition of many AdjacentStamps
                                 on myAdjacentStamp.first = $self;
    targetForAdjacentStamp : Composition of many AdjacentStamps
                                 on targetForAdjacentStamp.second = $self;
    Stampings              : Composition of many Stampings
                                 on Stampings.stamp = $self;
}

@assert.integrity : false
entity AdjacentStamps {
    key first  : Association to Stampboxes;
    key second : Association to Stampboxes;
}

@assert.integrity : false
entity ParkingSpots : cuid, PointOfInterest {
    // target             : Association to Stampboxes;
    // hikingTime         : many {
    //     to             : String(40);
    //     seconds        : Integer;
    //     fitnessScore   : Integer;
    //     DistanceMeters : Integer;
    //     Elevation      : Integer; //TODO choose fitting type
    // //Waypoints gpx isch -> route zeigen
    //}
}

@assert.integrity : false
entity TravelTimes : cuid {
    //Todo also include from parking to stamp
    fromPoi : UUID;
    toPoi   : UUID;
    Seconds : Integer;
//Waypoint Route
}

@assert.integrity : false
entity Stampings {
    stamp : Association to Stampboxes;
    createdAt   : Timestamp @cds.on.insert : $now;
    createdBy   : User      @cds.on.insert : $user;
}

// Todo save commen stamps as suggested routed

// Input start any poi -> gps guess & Max driving time
// Check adjecent stamps -> could also be generic -> load eg 20 km radius/box -> salesman trump
