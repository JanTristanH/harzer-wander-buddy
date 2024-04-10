using {hwb.db as db} from '../db/schema';

service api @(requires: 'authenticated-user') {

    function calculateTravelTimesNNearestNeighbors(n : Integer) returns Integer;

    @cds.redirection.target
    entity Stampboxes             as projection on db.Stampboxes;

    entity ParkingSpots           as projection on db.ParkingSpots;
    entity TravelTimes as projection on db.TravelTimes;
    entity Stampings @(restrict: [
        {
            grant: 'READ',
            where: 'createdBy = $user'
        },
        {grant: 'WRITE'}
    ])                            as projection on db.Stampings;

    @readonly
    entity PersonalizedStampboxes as
        select from db.Stampboxes as Stampboxes distinct {
            key ID,
                number,
                isKidFriendly,
                isElderlyFriendly,
                isStrollerFriendly,
                hasToilet,
                hasFood,
                longitude,
                latitude,
                name,
                description,
                image,

                case
                    when
                        length(
                            Stampboxes.Stampings.createdBy
                        ) > 0
                    then
                        true
                    else
                        false
                end as hasVisited : Boolean

        };

    //action route (statingStampID:Integer, targetNumberOfStamps: Integer) returns Integer;

    // Entity only used internally to caculate NearestNeighbors to cut down on maps routing requests
    // TODO set up read restrictions from external
    entity NeighborsStampStamp              as
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
            )                   as distanceKm : Double

        }
        // where
        //     Stampboxes.ID = 'bebf5cd4-e427-4297-a490-0730968690c2'
        order by
            distanceKm asc;

 entity NeighborsStampParking              as
        select from db.Stampboxes as Stampboxes
        join db.ParkingSpots as Neighbors
            on Stampboxes.ID != Neighbors.ID
        {
            Stampboxes.ID,
            Neighbors.ID     as NeighborsID,
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
            )                   as distanceKm : Double

        }
        order by
            distanceKm asc;


    entity tree                    as
        select from db.TravelTimes as TravelTimes
        {
            fromPoi,
            toPoi,
            ID,
            fromPoi as rootPoiID
        } where TravelTimes.fromPoi = 'bebf5cd4-e427-4297-a490-0730968690c2'

        union all select from db.TravelTimes as TravelTimes
            inner join db.TravelTimes as tree
                on TravelTimes.toPoi = tree.fromPoi
        {
            tree.fromPoi,
            tree.toPoi,
            tree.ID,
            '' as rootPoiID

         };
}
