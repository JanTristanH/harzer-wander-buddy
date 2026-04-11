using {hwb.db as db} from '../db/schema';

service api @(requires: 'authenticated-user') {

    type TourDetailPathItem {
        ID                  : UUID;
        id                  : String;
        fromPoi             : UUID;
        toPoi               : UUID;
        toPoiType           : String;
        durationSeconds     : Integer64;
        distanceMeters      : Integer64;
        travelMode          : String(128);
        name                : String;
        positionString      : LargeString;
        order               : Integer;
    };

    type TourLinkItem {
        travelTime_ID       : UUID;
        tour_ID             : UUID;
        rank                : Integer;
    };

    type TourDetailResponse {
        stampCount          : Integer;
        newStampCountForUser: Integer;
        distance            : Integer64;
        duration            : Integer64;
        id                  : String;
        groupSize           : Integer;
        AverageGroupStampings : Double;
        path                : many TourDetailPathItem;
    };

    type TourUpdateResponse {
        ID                  : UUID;
        distance            : Integer64;
        duration            : Integer64;
        stampCount          : Integer;
        newStampCountForUser: Integer;
        idListTravelTimes   : LargeString;
        totalElevationGain  : Double;
        totalElevationLoss  : Double;
        path                : many TourLinkItem;
    };

    type HikingRoutePathItem {
        poi                 : UUID;
        id                  : String;
        name                : String;
        toPoiType           : String;
        travelMode          : String(128);
        duration            : Integer64;
        distance            : Integer64;
        positionString      : LargeString;
        order               : Integer;
    };

    type HikingRouteResult {
        stampCount          : Integer;
        distance            : Integer64;
        duration            : Integer64;
        id                  : String;
        groupSize           : Integer;
        AverageGroupStampings : Double;
        path                : many HikingRoutePathItem;
    };

    type RouteToStampFromPositionResult {
        distanceMeters      : Integer64;
        durationSeconds     : Integer64;
        elevationGainMeters : Integer64;
        elevationLossMeters : Integer64;
    };

    type HikingRouteCalculationResponse {
        results             : many HikingRouteResult;
    };

    type PlaceSearchResult {
        placeId          : String;
        name             : String;
        formattedAddress : String;
        latitude         : Double;
        longitude        : Double;
        provider         : String;
    };

    @requires: 'admin'
    function calculateTravelTimesNNearestNeighbors(n : Integer)        returns Integer;

    @requires: 'admin'
    function getMissingTravelTimesCount(n : Integer)                   returns Integer;

    @requires: 'admin'
    function addElevationToAllTravelTimes()                            returns String;

    @requires: 'admin'
    action   DeleteSpotWithRoutes(SpotId : UUID)                       returns String;

    function calculateHikingRoute(maxDepth : Integer,
                                  maxDuration : Integer,
                                  maxDistance : Integer,
                                  minStampCount : Integer, //TODO implement
                                  allowDriveInRoute : Boolean,
                                  latitudeStart : String,
                                  longitudeStart : String,
                                  groupFilterStampings : String)       returns HikingRouteCalculationResponse;

    action   getRouteToStampFromPosition(stampId : UUID,
                                         latitude : Double,
                                         longitude : Double)                 returns RouteToStampFromPositionResult;

    function getTourByIdListTravelTimes(idListTravelTimes : String)    returns TourDetailResponse;
    action   updateTourByPOIList(TourID : UUID, POIList : String)      returns TourUpdateResponse;
    action   searchPlacesByName(query : String,
                                latitude : Double,
                                longitude : Double,
                                limit : Integer)                        returns many PlaceSearchResult;

    function backfillMissingVisitedAt()                                returns Integer;

    @requires: 'admin'
    function updateOrderBy()                                           returns String;

    @cds.redirection.target
    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: '*',
            to   : 'admin'
        }
    ]
    entity Stampboxes                         as
        projection on db.Stampboxes {
            *,
            neighborStamps       : Association to many NeighborsStampStamp
                                        on neighborStamps.ID = $self.ID,
            neighborParking      : Association to many NeighborsStampParking
                                        on neighborParking.ID = $self.ID,
            '' as groupFilterStampings : String,
            0  as groupSize            : Integer,
            0  as totalGroupStampings  : Integer,
            '' as stampedUserIds       : String, // actually an array
            '' as stampedUsers         : String // actually an array
        };

    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: '*',
            to   : 'admin'
        }
    ]
    entity ParkingSpots                       as
        projection on db.ParkingSpots {
            *,
            neighborStamps  : Association to many NeighborsParkingStamp
                                  on neighborStamps.ID = $self.ID,
            neighborParking : Association to many NeighborsParkingParking
                                  on neighborParking.ID = $self.ID
        };

    @readonly
    entity TravelTimes                        as projection on db.TravelTimes;

    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'WRITE',
            where: 'ID = $user'
        }
    ]
    entity Users                              as
        projection on db.ExternalUsers {
            ID,
            name,
            picture,
            false as isFriend : Boolean,
            '[]'  as roles    : String
        };

    function getCurrentUser()                                          returns Users;

    function getCurrentUserID()                                        returns Users;

    function getVersion()                                              returns String;

    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'CREATE',
            to   : 'authenticated-user'
        },
        {
            grant: 'UPDATE',
            where: 'createdBy = $user'
        }
    ]
    entity Attachments                        as projection on db.Attachments_local;

    @restrict: [{
        grant: 'READ',
        where: 'createdBy = $user'
    }]
    entity MyFriends                          as
        projection on db.Friendships {
            toUser.ID                 as ID,
            toUser.name               as name,
            toUser.picture            as picture,
            createdBy                 as createdBy,
            ID                        as FriendshipID,
            status                    as status,
            true                      as isFriend : Boolean,
            isAllowedToStampForFriend as isAllowedToStampForMe,
            false                      as isAllowedToStampForFriend : Boolean
        };

    @cds.redirection.target
    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'CREATE',
            to   : 'authenticated-user'
        },
        {
            grant: 'UPDATE',
            to   : 'authenticated-user',
            where: 'createdBy = $user'
        },
        {
            grant: 'DELETE',
            to   : 'authenticated-user',
            where: 'createdBy = $user'
        }
    ]
    entity Friendships                        as projection on db.Friendships;


    @restrict: [
        {grant: 'READ'},
        {
            grant: 'CREATE',
            to   : 'authenticated-user'
        },
        {
            grant: 'DELETE',
            where: 'fromUser_ID = $user'
        }
    ]
    entity PendingFriendshipRequests          as projection on db.PendingFriendshipRequests;

    action   acceptPendingFriendshipRequest(FriendshipID : UUID)       returns String;

    @readonly
    entity RouteCalculationRequest            as projection on db.RouteCalculationRequest;

    @restrict: [
        {grant: 'READ'}, // Allow all authenticated users to read
        {
            grant: 'CREATE',
            to   : 'authenticated-user'
        },
        {
            grant: 'UPDATE',
            where: 'createdBy = $user'
        },
        {
            grant: 'DELETE',
            where: 'createdBy = $user'
        }
    ]
    entity Tours                              as
        projection on db.Tours {
            *,
            creator : Association to one Users
                          on creator.ID = $self.createdBy,
            '' as groupFilterStampings  : String,
            0  as AverageGroupStampings : Integer,
            0  as newStampCountForUser  : Integer
        };

    @readonly
    entity AllPointsOfInterest                as
            select from Stampboxes {
                key ID,
                    longitude,
                    latitude,
                    name,
                    number as stampNumber,
                    orderBy,
                    heroImageUrl,
                    imageCaption,
                    description,
                    'stamp' as poiType   : String
            }
        union all
            select from ParkingSpots {
                key ID,
                    longitude,
                    latitude,
                    name,
                    ''        as stampNumber : String,
                    '999'     as orderBy,
                    ''        as heroImageUrl : String(2048),
                    ''        as imageCaption : String(2048),
                    description,
                    'parking' as poiType : String
            };


    entity Stampings @(restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'CREATE',
            to   : 'authenticated-user'
        },
        {
            grant: 'UPDATE',
            where: 'createdBy = $user'
        },
        {
            grant: 'DELETE',
            where: 'createdBy = $user'
        }
    ])                                        as projection on db.Stampings;

    action   stampForGroup(sStampId : UUID, bStampForUser : Boolean, sGroupUserIds : String) returns String;
    action   getStampFriendVisits(sStampId : UUID, sGroupUserIds : String) returns String;
    action   getUsersProgress(sGroupUserIds : String) returns String;

    // Entity only used internally to caculate NearestNeighbors to cut down on maps routing requests
    // TODO set up read restrictions from external
    entity NeighborsStampStamp                as
        select from db.Stampboxes as Stampboxes
        join db.Stampboxes as NeighborsBox
            on Stampboxes.ID != NeighborsBox.ID
        {
            key Stampboxes.ID,
            key NeighborsBox.ID     as NeighborsID,
                sourceStamp         : Association to one Stampboxes
                                          on sourceStamp.ID = $self.ID,
                neighborStamp       : Association to one Stampboxes
                                          on neighborStamp.ID = $self.NeighborsID,
                Stampboxes.number,
                NeighborsBox.number as NeighborsNumber,
                NeighborsBox.latitude,
                NeighborsBox.longitude,
                cast(
                    SQRT(
                        POW(
                            111.2 * (
                                NeighborsBox.latitude - Stampboxes.latitude
                            ), 2
                        )+POW(
                            111.2 * (
                                Stampboxes.longitude - NeighborsBox.longitude
                            ) * COS(
                                NeighborsBox.latitude / 57.3
                            ), 2
                        )
                    ) as                            Double
                )                   as distanceKm : Double

        }
        // where
        //     Stampboxes.ID = 'bebf5cd4-e427-4297-a490-0730968690c2'
        order by
            cast(
                $projection.distanceKm as Double
            ) asc;

    entity NeighborsStampParking              as
        select from db.Stampboxes as Stampboxes
        join db.ParkingSpots as Neighbors
            on Stampboxes.ID != Neighbors.ID
        {
            key Stampboxes.ID,
            key Neighbors.ID as NeighborsID,
                sourceStamp   : Association to one Stampboxes
                                    on sourceStamp.ID = $self.ID,
                neighborParking : Association to one ParkingSpots
                                    on neighborParking.ID = $self.NeighborsID,
                Stampboxes.number,
                Neighbors.latitude,
                Neighbors.longitude,
                SQRT(
                    POW(
                        111.2 * (
                            Neighbors.latitude - Stampboxes.latitude
                        ), 2
                    )+POW(
                        111.2 * (
                            Stampboxes.longitude - Neighbors.longitude
                        ) * COS(
                            Neighbors.latitude / 57.3
                        ), 2
                    )
                )            as distanceKm : Double

        }
        order by
            cast(
                $projection.distanceKm as Double
            ) asc;

    entity NeighborsParkingStamp              as
        select from db.ParkingSpots as Parking
        join db.Stampboxes as NeighborsBox
            on Parking.ID != NeighborsBox.ID
        {
            key Parking.ID,
            key NeighborsBox.ID     as NeighborsID,
                sourceParking       : Association to one ParkingSpots
                                          on sourceParking.ID = $self.ID,
                neighborStamp       : Association to one Stampboxes
                                          on neighborStamp.ID = $self.NeighborsID,
                NeighborsBox.number as NeighborsNumber,
                NeighborsBox.latitude,
                NeighborsBox.longitude,
                SQRT(
                    POW(
                        111.2 * (
                            NeighborsBox.latitude - Parking.latitude
                        ), 2
                    )+POW(
                        111.2 * (
                            Parking.longitude - NeighborsBox.longitude
                        ) * COS(
                            NeighborsBox.latitude / 57.3
                        ), 2
                    )
                )                   as distanceKm : Double

        }
        // where
        //     Stampboxes.ID = 'bebf5cd4-e427-4297-a490-0730968690c2'
        order by
            cast(
                $projection.distanceKm as Double
            ) asc;

    entity NeighborsParkingParking            as
        select from db.ParkingSpots as Parking
        join db.ParkingSpots as Neighbors
            on Parking.ID != Neighbors.ID
        {
            key Parking.ID,
            key Neighbors.ID as NeighborsID,
                sourceParking : Association to one ParkingSpots
                                    on sourceParking.ID = $self.ID,
                neighborParking : Association to one ParkingSpots
                                    on neighborParking.ID = $self.NeighborsID,
                Neighbors.latitude,
                Neighbors.longitude,
                SQRT(
                    POW(
                        111.2 * (
                            Neighbors.latitude - Parking.latitude
                        ), 2
                    )+POW(
                        111.2 * (
                            Parking.longitude - Neighbors.longitude
                        ) * COS(
                            Neighbors.latitude / 57.3
                        ), 2
                    )
                )            as distanceKm : Double

        }
        order by
            cast(
                $projection.distanceKm as Double
            ) asc;

    entity NeighborsCalculationRequestParking as
        select from db.RouteCalculationRequest as CalculationRequest
        join db.ParkingSpots as Neighbors
            on CalculationRequest.ID != Neighbors.ID
        {
            key CalculationRequest.ID,
            key Neighbors.ID as NeighborsID,
                cast(
                    CalculationRequest.longitude as             Double
                )            as CalculationRequestLongitude,
                cast(
                    CalculationRequest.latitude as              Double
                )            as CalculationRequestLatitude,
                Neighbors.latitude,
                Neighbors.longitude,
                SQRT(
                    POW(
                        111.2 * (
                            cast(
                                Neighbors.latitude as           Double
                            )-cast(
                                CalculationRequest.latitude as  Double
                            )
                        ), 2
                    )+POW(
                        111.2 * (
                            cast(
                                CalculationRequest.longitude as Double
                            )-cast(
                                Neighbors.longitude as          Double
                            )
                        ) * COS(
                            cast(
                                Neighbors.latitude as           Double
                            ) / 57.3
                        ), 2
                    )
                )            as distanceKm :                    Double

        }
        order by
            cast(
                $projection.distanceKm as Double
            ) asc;


    entity tree                               as
            select from db.TravelTimes as TravelTimes {
                    fromPoi,
                    toPoi,
                key ID,
                    fromPoi as rootPoiID
            }
        union all
            select from db.TravelTimes as TravelTimes
            inner join db.TravelTimes as tree
                on TravelTimes.toPoi = tree.fromPoi
            {
                    tree.fromPoi,
                    tree.toPoi,
                key tree.ID,
                    '' as rootPoiID

            };

    entity treeFilter                         as projection on api.tree;

    @readonly
    entity typedTravelTimes                   as
            select from db.TravelTimes as TravelTimes
            join api.ParkingSpots as ParkingSpots
                on TravelTimes.toPoi = ParkingSpots.ID
            //    where ParkingSpots.ID is not null
            {
                key TravelTimes.ID,
                    TravelTimes.fromPoi,
                    TravelTimes.toPoi,
                    TravelTimes.durationSeconds,
                    TravelTimes.distanceMeters,
                    TravelTimes.travelMode,
                    TravelTimes.elevationGain,
                    TravelTimes.elevationLoss,
                    ParkingSpots.name,
                    'parking' as toPoiType : String
            }
        union all
            select from db.TravelTimes as TravelTimes
            join api.Stampboxes as Stampboxes
                on TravelTimes.toPoi = Stampboxes.ID
            {
                key TravelTimes.ID,
                    TravelTimes.fromPoi,
                    TravelTimes.toPoi,
                    TravelTimes.durationSeconds,
                    TravelTimes.distanceMeters,
                    TravelTimes.travelMode,
                    TravelTimes.elevationGain,
                    TravelTimes.elevationLoss,
                    Stampboxes.name,
                    'stamp' as toPoiType   : String
            };
//    union all
//    select from db.TravelTimes as TravelTimes
//    where not exists (select from api.ParkingSpots as p where p.ID = TravelTimes.toPoi)
//    and not exists (select from api.Stampboxes as s where s.ID = TravelTimes.toPoi) {
//        key TravelTimes.ID,
//        TravelTimes.fromPoi,
//        TravelTimes.toPoi,
//        TravelTimes.durationSeconds,
//        TravelTimes.distanceMeters,
//        TravelTimes.travelMode,
//        'unknown' as toPoiType: String
//    };

}
