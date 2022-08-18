using {hwb.db as db} from '../db/schema';

service api @(requires : 'authenticated-user') {

    entity Stampboxes as projection on db.Stampboxes;
    //entity ParkingSpots as projection on db.ParkingSpots;

    entity Stampings @(restrict : [
        {
        grant : 'READ',
        where : 'createdBy = $user'
    },
    {grant: 'WRITE'}])               as projection on db.Stampings;

}
