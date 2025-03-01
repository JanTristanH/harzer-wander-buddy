namespace hwb.db;

using {
    temporal,
    cuid,
    managed
} from '@sap/cds/common';

using { Attachments } from '@cap-js/attachments';

type User : String(255);

aspect PointOfInterest {
    longitude   : Double;
    latitude    : Double;
    name        : String(255);
    description : String(2048);
    image       : String(2048); //LargeBinary @Core.MediaType : 'image/png';
}

entity ExternalUsers : cuid {
    principal             : User        @assert.unique;
    email                 : String(255) @assert.unique;
    email_verified        : Boolean;
    family_name           : String(255);
    given_name            : String(255);
    name                  : String(255);
    nickname              : String(255);
    picture               : String(255);
    sid                   : String(255);
    sub                   : String(255);
    updated_at_iso_string : String(255);
    updated_at            : Timestamp   @cds.on.insert: $now;
}

entity Attachments_local : Attachments {
    
}

@assert.integrity: false
entity Stampboxes : cuid, temporal, PointOfInterest {
    number                 : String(40); // to allow Sonderstempel via name
    orderBy                : String(40);
    isKidFriendly          : Boolean;
    isElderlyFriendly      : Boolean;
    isStrollerFriendly     : Boolean;
    hasVisited             : Boolean; /**populated by READ handler */
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

    // dummy fields
    groupFilterStampings   : String;
    groupSize              : Integer;
    totalGroupStampings    : Integer;
    stampedUserIds         : String;
    stampedUsers           : String;
}

@assert.integrity: false
entity AdjacentStamps {
    key first  : Association to Stampboxes;
    key second : Association to Stampboxes;
}

@assert.integrity: false
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

entity RouteCalculationRequest : cuid {
    longitude : String(40);
    latitude  : String(40);
    createdAt : Timestamp @cds.on.insert: $now;
    createdBy : User      @cds.on.insert: $user;
}

@assert.integrity: false
@cds.autoexpose
entity TravelTimes : cuid {
    fromPoi          : UUID;
    toPoi            : UUID;
    durationSeconds  : Integer64;
    distanceMeters   : Integer64;
    travelMode       : String(128);
    positionString   : LargeString;
    elevationGain    : Double;
    elevationLoss    : Double;
    maxElevation     : Double;
    minElevation     : Double;
    elevationProfile : LargeString;
    tours            : Association to many Tour2TravelTime
                           on tours.travelTime = $self;
}

@assert.integrity: false
entity Stampings : cuid {
    stamp     : Association to Stampboxes;
    createdAt : Timestamp @cds.on.insert: $now;
    createdBy : User      @cds.on.insert: $user;
}

@cds.autoexpose
entity Tours : cuid, managed {
    name                  : String;
    /** distance in meters */
    distance              : Integer64;
    /** duration in seconds */
    duration              : Integer64;
    /** stamp count independent from users stamps */
    stampCount            : Int32;
    /** id list of travel times, can be used to describe the path of a tour */
    idListTravelTimes     : LargeString;
    /** path as many ranked travel times.
     *  Each travel time has a from and a to.
     *  To get the pois of this tour, we need to look at all n toPois and the first from POI.
     */
    totalElevationLoss    : Double;
    totalElevationGain    : Double;
    groupFilterStampings  : String; // dummy field to filter for group stampings
    AverageGroupStampings : Double; // dummy field to calculate average group stampings
    path                  : Association to many Tour2TravelTime
                                on path.tour = $self;
}

entity Tour2TravelTime @cds.autoexpose {
    key tour       : Association to Tours;
    key travelTime : Association to TravelTimes;
        rank       : Int16;
}

entity Friendships : cuid {
    fromUser  : Association to ExternalUsers;
    toUser    : Association to ExternalUsers;
    confirmed : Boolean default false;
    createdBy : User @cds.on.insert: $user;
}

entity PendingFriendshipRequests : cuid {
    fromUser           : Association to ExternalUsers;
    toUser             : Association to ExternalUsers;
    outgoingFriendship : Association to Friendships;
}

// Input start any poi -> gps guess & Max driving time
// Check adjecent stamps -> could also be generic -> load eg 20 km radius/box -> salesman trump
