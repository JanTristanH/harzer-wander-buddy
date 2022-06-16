using { hwb.db as db  } from '../db/schema';

service api {

    entity Stampboxes as projection on db.Stampboxes;
    //entity ParkingSpots as projection on db.ParkingSpots;

}
