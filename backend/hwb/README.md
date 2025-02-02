# Getting Started

## Running this project

- run `cds watch` to start the backend
- the frontend is also served via the cds server
  - be careful with the link in the console: is protected by the auth0 endpoint.
    - http://localhost:4004/app -> protected by auth0
    - http://localhost:4004/frontendhwb/webapp/index.html -> basic auth & geo locating available (Users are configured in `package.json`)
- The profiles `memory`, `development` and `production` are available and can be selected using the `--profile` flag
  - `development` is selected as default with a persistent database
  - to get dummy data, rename the folder `DoNotDeploy-data` to `data` and run `cds deploy`
  - to configure `production` the postgres location, you can use the `.cdsrc.json` file. `postgres.cdsrc.json` contains the connection details if a container is run from the `pg.yml` file. (`docker-compose -f pg.yml up -d`)
- building and publishing the final docker container is handled via github actions via tags

## Needed Environment variables

Rename the file `sample.env` to `.env` for development. You must also provide a api key in the `app/frontendhwb/index.html` to load the google maps script.
For deployment you may also provide them directly to the container.

## Database

This project is configured to run with a postgres.

## Todo

- implement api call to maps to get times (by travel type) ✔️
- persist calculated Travel Times ✔️
- implement DFS to suggest routes ✔️
- UI für suggested routes -> General route planning & viewing ✔️
- dev deploy on domain ✔️
- Too many parking spaces obscure the relevant neighbor travel times. ✔️
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
- Mobile optimization & UI overhaul with mobile optimization	✔️
    - better units in dialog ✔️
    - show used parking spaces on route view ✔️
    - show user location on map ✔️
    - allow parking toggling ✔️
    - enhance List / route handling ✔️
      - different map routes (dotted for walking) ✔️
    - fix map label toggling combined with zoom ✔️
- Redirect to Login from webapp ✔️ (use /app/...)
- Create logout button ✔️
- deploy docker to server ✔️
- backup current parkin spaces ✔️
- add landing page for app domain ✔️
- implement search above ✔️
- show start parking space ✔️
- show user location on map and center on it ✔️
- update Readme for dev instructions ✔️
- build ui5 app & rewrite path in express ✔️
- sorting column ✔️
- add quick view for selected POI ✔️
  - contains navigate to button that opens maps ✔️
  - link to external site ✔️
  - fix user experience on mobile for this view -> pull up card ✔️
- refactor routes to use joined travel time key (-> persist later, can recalculate dynamically) ✔️
- badge progress overview ✔️
- basic tour planning ✔️
  - clicking a poi should move it to the center of the map ✔️
  - start navigation from tour view ✔️
  - stamp from tour view ✔️
  - quick add poi from map to end of tour ✔️
- Verify automatic tours are working ✔️
- make website installable ✔️ (https://maskable.app/editor -> for icon edit)
- nice illustrated message on initial routes view -> show list of tours ✔️
- have map start near me if possible & keep viewport on reload ✔️
- add elevation to travel times ✔️
- verify deploy works without deleting prod data ✔️
- call `addElevationToAllTravelTimes` on live system ✔️
- /policies/terms-of-service & /policies/privacy-policy => maintain on website ✔️
- maintain cookie policy (currently only tecnical cookie, so not needed ✔️)
- are you sure when deleting stampings
- Filtering on Map view -> Goethe weg usw.
- upgrade developer to production key
- minimum authority
  - admin role ✔️
  - only edit my own tours ❓
  - add new audience to prod docker
- show user profile picture
- set up social media ✔️
- set up jeykell pages for seo ✔️
- trackability total users / users active in the last x days (✔️ Good enough for start on auth0)
- UI overhaul II -> fix up design

# Last stretch before rewrite 
- support maps.me navigation
- show personalized stamp count in addition to total on tour page
- Friends feature
  - show group status on map
  - send and accept friend requests
  - display stamp list of friend and mine
  - display stamping state of group member on tour (detail) page

## MVP 2

- open individual travel time in maps or hiking app like komoot
- add images & descriptions to stamps
- refactor starting algorithm
  - nearest
  - from stamp
  - from my location
- Update color schema of app to match background of mascot
- look into sapui5 vs openui5 (openUi5 does not have GeoMap)
- look into problem with 24 remaining routes
- fix handler to be normally performant: this.after('READ', `Stampboxes`
- Profile page
  - saved tours
  - overview achievements
  - timeline for stampings (allow change of date)
- monetization strategy ads from 5th login on?
- optional: generate AI descriptions for routes
- card based view of routes ✔️
  - highlight selected travel on map ✔️
- update demo data from live system
- allow manual changes to routes ✔️
- paid parking info
- shareability for routes ✔️
- cute mascot ✔️
- compliant map server
- Comments on Stamps to mark missing / broken ones
- support for multi book management

## Backlog

- add maps api key from env to index file
- save some hand picked default routes
- save height profile for routes ✔️
- link to park for night parking
- score for completing area
- score where walking from other side would be easier
- Admin Master data app -> new Stamps & moving
- Admin Master data app -> update path of a TravelTime
- Deal with legacy Stamps & check for deviation on HWN site
- History view for changed stamps

## Build with Docker locally 

- run `docker build . -t hwb`
- connect to Github registry via VS Code extension
- push all lowercase


## Nice Blog

- Authentication (createdBy) https://community.sap.com/t5/technology-blogs-by-members/cap-demystify-user-authentication/ba-p/13488676

## Role related setup in auth0

- add role `admin` to user
- add permission to role
- add Application -> API (for audience)
- enable RBAC
- add again manually
  - Action -> Triggers -> Post Login
    - create custom:
````js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://app.harzer-wander-buddy.de/"; // Use a custom namespace -> same as audience
  
  // Get assigned roles
  const assignedRoles = event.authorization.roles || [];

  // Add roles to the token
  api.idToken.setCustomClaim(`${namespace}roles`, assignedRoles);
  api.accessToken.setCustomClaim(`${namespace}roles`, assignedRoles);
};
````
    - move into flow on the left