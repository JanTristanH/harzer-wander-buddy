using {hwb.db as db} from '../db/schema';

service api @(requires: 'authenticated-user') {

    function calculateTravelTimesNNearestNeighbors(n : Integer) returns Integer;

    function getMissingTravelTimesCount(n : Integer) returns Integer;

    entity HikingRoute {
        Points         : Composition of many TravelTimes;
        totalDistance  : Integer;
        totalDuration  : Integer;
        totalNewStamps : Integer;
    }

    function calculateHikingRoute(maxDepth : Integer,
                                  maxDuration : Integer,
                                  maxDistance : Integer,
                                  minStampCount : Integer, //TODO implement
                                  allowDriveInRoute: Boolean,
                                  latitudeStart : String,
                                  longitudeStart : String)      returns String;

    function getTourByIdListTravelTimes(idListTravelTimes : String) returns String;

    function updateOrderBy() returns String;

    @cds.redirection.target
    entity Stampboxes              as projection on db.Stampboxes;

    entity ParkingSpots            as projection on db.ParkingSpots;
    entity TravelTimes             as projection on db.TravelTimes;

    @readonly
    entity RouteCalculationRequest as projection on db.RouteCalculationRequest;

    entity Tours as projection on db.Tours;

    @readonly
    entity AllPointsOfInterest as select from Stampboxes {
        key ID,
        longitude,
        latitude,
        name,
        description
    } union all
    select from ParkingSpots {
        key ID,
        longitude,
        latitude,
        name,
        description
    };


    entity Stampings @(restrict: [
        {
            grant: 'READ',
            where: 'createdBy = $user'
        },
        {grant: 'WRITE'}
    ])                             as projection on db.Stampings;

    //action route (statingStampID:Integer, targetNumberOfStamps: Integer) returns Integer;

    action DeleteSpotWithRoutes (SpotId: UUID) returns String;

    // Entity only used internally to caculate NearestNeighbors to cut down on maps routing requests
    // TODO set up read restrictions from external
    entity NeighborsStampStamp     as
        select from db.Stampboxes as Stampboxes
        join db.Stampboxes as NeighborsBox
            on Stampboxes.ID != NeighborsBox.ID
        {
            Stampboxes.ID,
            NeighborsBox.ID     as NeighborsID,
            Stampboxes.number,
            NeighborsBox.number as NeighborsNumber,
            NeighborsBox.latitude,
            NeighborsBox.longitude,
            cast ( SQRT(
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
            )    as Double)               as distanceKm : Double

        }
        // where
        //     Stampboxes.ID = 'bebf5cd4-e427-4297-a490-0730968690c2'
        order by
        cast ( $projection.distanceKm as Double ) asc;

    entity NeighborsStampParking   as
        select from db.Stampboxes as Stampboxes
        join db.ParkingSpots as Neighbors
            on Stampboxes.ID != Neighbors.ID
        {
            Stampboxes.ID,
            Neighbors.ID as NeighborsID,
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
            cast ( $projection.distanceKm as Double ) asc;

    entity NeighborsParkingStamp   as
        select from db.ParkingSpots as Parking
        join db.Stampboxes as NeighborsBox
            on Parking.ID != NeighborsBox.ID
        {
            Parking.ID,
            NeighborsBox.ID     as NeighborsID,
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
            cast ( $projection.distanceKm as Double ) asc;

    entity NeighborsParkingParking as
        select from db.ParkingSpots as Parking
        join db.ParkingSpots as Neighbors
            on Parking.ID != Neighbors.ID
        {
            Parking.ID,
            Neighbors.ID as NeighborsID,
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
            cast ( $projection.distanceKm as Double ) asc;

 entity NeighborsCalculationRequestParking as
        select from db.RouteCalculationRequest as CalculationRequest
        join db.ParkingSpots as Neighbors
            on CalculationRequest.ID != Neighbors.ID
        {
            CalculationRequest.ID,
            Neighbors.ID as NeighborsID,
            cast ( CalculationRequest.longitude as Double ) as CalculationRequestLongitude,
            cast ( CalculationRequest.latitude as Double ) as CalculationRequestLatitude,
            Neighbors.latitude,
            Neighbors.longitude,
            SQRT(
                POW(
                    111.2 * (
                        cast ( Neighbors.latitude as Double ) - cast ( CalculationRequest.latitude as Double )
                    ), 2
                )+POW(
                    111.2 * (
                        cast ( CalculationRequest.longitude as Double ) - cast ( Neighbors.longitude as Double )
                    ) * COS(
                        cast ( Neighbors.latitude as Double ) / 57.3
                    ), 2
                )
            )            as distanceKm : Double

        }
        order by
            cast ( $projection.distanceKm as Double ) asc;


    entity tree                    as
            select from db.TravelTimes as TravelTimes {
                fromPoi,
                toPoi,
                ID,
                fromPoi as rootPoiID
            }
        union all
            select from db.TravelTimes as TravelTimes
            inner join db.TravelTimes as tree
                on TravelTimes.toPoi = tree.fromPoi
            {
                tree.fromPoi,
                tree.toPoi,
                tree.ID,
                '' as rootPoiID

            };

    entity treeFilter              as projection on api.tree;

@readonly
entity typedTravelTimes
       as select from db.TravelTimes as TravelTimes
       join api.ParkingSpots as ParkingSpots on TravelTimes.toPoi = ParkingSpots.ID
    //    where ParkingSpots.ID is not null
        {
           key TravelTimes.ID,
           TravelTimes.fromPoi,
           TravelTimes.toPoi,
           TravelTimes.durationSeconds,
           TravelTimes.distanceMeters,
           TravelTimes.travelMode,
           ParkingSpots.name,
           'parking' as toPoiType: String
       }
       union all
       select from db.TravelTimes as TravelTimes
       join api.Stampboxes as Stampboxes on TravelTimes.toPoi = Stampboxes.ID
        {
           key TravelTimes.ID,
           TravelTimes.fromPoi,
           TravelTimes.toPoi,
           TravelTimes.durationSeconds,
           TravelTimes.distanceMeters,
           TravelTimes.travelMode,
           Stampboxes.name,
           'stamp' as toPoiType: String
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
