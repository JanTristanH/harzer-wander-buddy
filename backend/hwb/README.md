# Getting Started

## Todo

- implement api call to maps to get times (by travel type) ✔️
- persist calculated Travel Times ✔️
- implement DFS to suggest routes ✔️
- UI für suggested routes -> General route planning & viewing ✔️
- dev deploy on domain ✔️
- Too many parking spaces obscure the relevant neighbor travel times.
  - admin ui for adding and removing spots ✔️
  - recalculate routes button ✔️
  - display routes for spot ✔️
- ~~ distance < 10 km instead of  n nearest neighbors ~~ -> too many
- set up better demo users ✔️
~~ - configure aiven postgres ~~ -> did not work, local docker postgres ✔️
- Delete unsensible Parking Spots, persist them & update demo data spots & Travel times
- Stampings are not user dependant ✔️
- enhance data quality, parking spaces & routes ✔️ (ongoing)
- route calculation broken -> starting parking spaces not correct
- link spot to external search
- fix recalculation of routes
- Mobile optimization & UI overhaul with mobile optimization
    - better units in dialog ✔️
    - show used parking spaces on route view ✔️
    - show user location on map
    - enhance List / route handling
      - different map routes (dotted for walking) ✔️
      - show parking spots of route on map
    - fix map label toggling ✔️
    - allow parking toggling

## MVP 2

- implement search above
- card based view of routes
- allow manual changes to routes
- configure social login
- paid parking info
- shareability for routes
- images for routes & spots
- cute mascot
- complient map server
- Friends feature (plan route together & notification)
- Ui5 project into cap
- Stempel als Strtpunkt
- Kommentare an Stempel "fehlt"

## Backlog
- save some hand picked default routes
- save high profile for routes
- link to park for night parking
- score for completing area
- score where walking from other side would be easier

## Docker 

`docker build . -t hwb`
Github registry verbinden
lowercase pushen

## Database

This project is configured to run with a managed postgres. For example using [aiven](https://console.aiven.io/).
