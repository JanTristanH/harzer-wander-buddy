using {hwb.db as db} from '../db/schema';

service api @(requires : 'authenticated-user') {

    @cds.redirection.target
    entity Stampboxes             as projection on db.Stampboxes;
    //entity ParkingSpots as projection on db.ParkingSpots;

    entity Stampings @(restrict : [
        {
            grant : 'READ',
            where : 'createdBy = $user'
        },
        {grant : 'WRITE'}
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
                    length(Stampboxes.Stampings.createdBy) > 0
                then
                    true
                else
                    false
            end as hasVisited : Boolean

        };

//action route (statingStampID:Integer, targetNumberOfStamps: Integer) returns Integer;

}
