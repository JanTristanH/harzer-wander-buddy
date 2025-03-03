using {hwb.db as db} from '../db/schema';

service api @(requires: 'authenticated-user') {

    @requires: 'admin'
    function calculateTravelTimesNNearestNeighbors(n : Integer)     returns Integer;

    @requires: 'admin'
    function getMissingTravelTimesCount(n : Integer)                returns Integer;

    @requires: 'admin'
    function addElevationToAllTravelTimes()                         returns String;

    @requires: 'admin'
    action   DeleteSpotWithRoutes(SpotId : UUID)                    returns String;


    function calculateHikingRoute(maxDepth : Integer,
                                  maxDuration : Integer,
                                  maxDistance : Integer,
                                  minStampCount : Integer, //TODO implement
                                  allowDriveInRoute : Boolean,
                                  latitudeStart : String,
                                  longitudeStart : String,
                                  groupFilterStampings : String)    returns String;

    function getTourByIdListTravelTimes(idListTravelTimes : String) returns String;
    action   updateTourByPOIList(TourID : UUID, POIList : String)   returns String;

    @requires: 'admin'
    function updateOrderBy()                                        returns String;

    @cds.redirection.target
    @readonly
    entity Stampboxes                         as
        projection on db.Stampboxes {
            *,
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
    entity ParkingSpots                       as projection on db.ParkingSpots;

    @readonly
    entity TravelTimes                        as projection on db.TravelTimes;

    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'WRITE',
            where: 'principal = $user'
        }
    ]
    entity Users                              as
        projection on db.ExternalUsers {
            ID,
            principal,
            name,
            picture,
            false as isFriend : Boolean,
            '[]'  as roles    : String
        };

    function getCurrentUser()                                       returns Users;

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
            toUser.ID        as ID,
            toUser.principal as principal,
            toUser.name      as name,
            toUser.picture   as picture,
            createdBy        as createdBy,
            ID               as FriendshipID,
            true             as isFriend : Boolean
        };

    @cds.redirection.target
    @restrict: [
        {
            grant: 'READ',
            to   : 'authenticated-user'
        },
        {
            grant: 'WRITE',
            to   : 'authenticated-user'
        }
    ]
    entity Friendships                        as projection on db.Friendships;


    @readonly
    entity PendingFriendshipRequests          as projection on db.PendingFriendshipRequests;

    action   acceptPendingFriendshipRequest(FriendshipID : UUID)    returns String;

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
            '' as groupFilterStampings  : String,
            0  as AverageGroupStampings : Integer
        };

    @readonly
    entity AllPointsOfInterest                as
            select from Stampboxes {
                key ID,
                    longitude,
                    latitude,
                    name,
                    orderBy,
                    description,
                    'stamp' as poiType   : String
            }
        union all
            select from ParkingSpots {
                key ID,
                    longitude,
                    latitude,
                    name,
                    '999'     as orderBy,
                    description,
                    'parking' as poiType : String
            };


    entity Stampings @(restrict: [
        {
            grant: 'READ',
            where: 'createdBy = $user'
        },
        {grant: 'WRITE'}
    ])                                        as projection on db.Stampings;


    // Entity only used internally to caculate NearestNeighbors to cut down on maps routing requests
    // TODO set up read restrictions from external
    entity NeighborsStampStamp                as
        select from db.Stampboxes as Stampboxes
        join db.Stampboxes as NeighborsBox
            on Stampboxes.ID != NeighborsBox.ID
        {
            key Stampboxes.ID,
            key NeighborsBox.ID     as NeighborsID,
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
