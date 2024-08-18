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
- Stampings are not user dependant ✔️
- enhance data quality, parking spaces & routes ✔️ (ongoing)
- route calculation broken -> starting parking spaces not correct (fixed itself) ✔️
- link spot to external search ✔️
- Mobile optimization & UI overhaul with mobile optimization	
    - better units in dialog ✔️
    - show used parking spaces on route view ✔️
    - show user location on map ✔️
    - allow parking toggling ✔️
    - enhance List / route handling
      - different map routes (dotted for walking) ✔️
    - fix map label toggling combined with zoom ✔️
- Redirect to Login from webapp ✔️ (use /app/...)
- Create logout button ✔️
- deploy docker to server ✔️
- backup current parkin spaces ✔️
- add landing page for app domain ✔️
- implement search above
- show start parking space
- show user location on map and center on it ✔️
- update Readme for dev instructions
- refactor routes to use joined travel time key (-> persist later, can recalculate dynamically)
- /policies/terms-of-service & /policies/privacy-policy => maintain on website
- upgrade developer to production key
- look into problem with 24 remaining routes

## MVP 2

- open individual travel time in maps or hiking app like komoot
- card based view of routes
  - highlight selected travel on map
- update demo data from live system
- allow manual changes to routes
- paid parking info
- shareability for routes
- images for routes & spots
- cute mascot ✔️
- complient map server
- Friends feature (plan route together & notification)
- refactor starting algorithm
  - nearest
  - from stamp
  - from my location
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

This project is configured to run with a postgres.
