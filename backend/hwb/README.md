# Getting Started

## Explicit local auth profiles

| Profile | Backend command | App / browser |
| --- | --- | --- |
| `dev-basic` | `npm run watch:basic` (or `start:basic`) | Separately run `npm run web:basic --prefix app` from repository root; `http://localhost:8081/login` |
| `dev-sso` | `npm run watch:sso` (or `start:sso`) | Build with `./scripts/build-and-copy-rnweb.sh` from repository root; `http://localhost:4004/app/rnweb` |
| `production` | Existing container startup | Existing PostgreSQL and Auth0 configuration |

Both local profiles inherit the development SQLite database (`db.sqlite`). For a new
checkout, initialize it with `npm run deploy:sqlite` from this directory before starting.
Start only one CAP profile on port 4004 at a time. `PORT=4005 npm run start:basic` can
run alongside SSO, but then Expo must use `EXPO_PUBLIC_BACKEND_URL=http://localhost:4005`.

`dev-basic` uses real HTTP Basic headers and only explicitly configured test accounts,
with the test login from `../../AGENTS.md`. No wildcard users or default CAP mock users
are accepted. A valid login provisions the local `ExternalUsers` record so profile,
onboarding and ownership checks work with the same user ID. Test users have no admin
role by default. Basic cannot be combined with `production`.

`dev-sso` keeps the existing Auth0 session and bearer authentication. For local startup,
empty issuer/audience values fall back to the public Auth0 configuration in
`../../app/app.json`; CAP's session base URL is explicitly `http://localhost:4004/`.
Session secrets and client credentials still come from the local `.env`. If using a
different tenant, configure matching `ISSUER_BASE_URL`, `AUDIENCE` and Expo values.
These local defaults do not apply to production. The existing `development` default
and container startup remain unchanged.

## Running this project

- run `cds watch` to start the backend
- the frontend is also served via the cds server
  - be careful with the link in the console: is protected by the auth0 endpoint.
    - http://localhost:4004/app -> protected by auth0
    - http://localhost:4004/app/frontendhwb/webapp/index.html -> legacy UI5 app (Auth0 in the default profile)
- The profiles `memory`, `development` and `production` are available and can be selected using the `--profile` flag
  - `development` is selected as default with a persistent database
  - to get dummy data, rename the folder `DoNotDeploy-data` to `data` and run `cds deploy`
  - to configure `production` the postgres location, you can use the `.cdsrc.json` file. `postgres.cdsrc.json` contains the connection details if a container is run from the `pg.yml` file. (`docker-compose -f pg.yml up -d`)
- building and publishing the final docker container is handled via github actions via tags

## React Native Web via CAP

Use the separate Expo web dev server only with `dev-basic`; do not use it for local Auth0 login. The Auth0 SPA configuration is meant for the RN web build served by the CAP server.

Install dependencies once, from the repository root, if either `node_modules` directory is missing:

```bash
npm ci --prefix app
npm ci --prefix backend/hwb
```

Build and copy the RN web HTML/assets into the CAP app folder from the repository root:

```bash
./scripts/build-and-copy-rnweb.sh
```

The script runs `npx expo export --platform web` in `app/` and replaces `backend/hwb/app/rnweb` with the generated `app/dist` output.
Edit the source files under `app/`; do not edit `app/dist` or `backend/hwb/app/rnweb`, since both are generated. Re-run the build-and-copy script after each web change, then reload the browser.

Then start CAP:

```bash
cd backend/hwb
npm run watch
```

Open the RN web app through CAP:

- http://localhost:4004/app/rnweb

Auth0 local development settings for this CAP-served entry point:

- Allowed Callback URLs: `http://localhost:4004/app/rnweb/auth/callback`
- Allowed Logout URLs: `http://localhost:4004/app/rnweb/auth/logout`
- Allowed Web Origins: `http://localhost:4004`

## Needed Environment variables

Copy `sample.env` to `.env` for local development. Keep the `.env` file local and do not commit secrets.

For the React Native web app's Auth0 bearer-token API calls, make sure these values are populated in `backend/hwb/.env` before starting CAP:

- `ISSUER_BASE_URL`: the Auth0 tenant issuer matching `auth0Domain` in `app/app.json` (for example, `https://<tenant>.us.auth0.com`).
- `AUDIENCE`: the API identifier matching `auth0Audience` in `app/app.json`.

An empty `ISSUER_BASE_URL` lets the page load and Auth0 login begin, but protected API requests fail. `CLIENT_ID`, `CLIENT_SECRET`, `SECRET`, and `BASE_URL` configure CAP's own Auth0 session flow (for example, the older `/app` UI5 route); the RN web SPA uses `auth0ClientIdWeb` from `app/app.json` instead. For CAP's session flow, `BASE_URL` should be `http://localhost:4004/` locally.

You must also provide an API key in `app/frontendhwb/index.html` to load the Google Maps script. For deployment, environment variables may be provided directly to the container.

## Database

This project is configured to run with a postgres.

## Export live data as CSV

Use these endpoints to export live DB content for CAP seed files.

- `GET /export/csv`
  - Lists all supported entities and direct download URLs.
- `GET /export/csv/:entity`
  - Exports one entity as CSV (`text/csv`) with filename `hwb.db.<Entity>.csv`.
  - Example: `/export/csv/Stampboxes`

The export endpoints require authentication (browser session or bearer token).

Example with bearer token:

```bash
npm run download-csv-exports -- \
  --base-url https://app.harzer-wander-buddy.de \
  --session-cookie 'eyJ...'
```

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
- Filtering on Map view -> Goethe weg usw. ❌
- upgrade developer to production key ❌
- minimum authority ✔️
  - admin role ✔️
  - only edit my own tours ✔️
  - add new audience to prod docker ?❌?
- show user profile picture ✔️
- set up social media ✔️
- set up jeykell pages for seo ✔️ -> indexing does not work as intended; maybe use cloudflare pages
- trackability total users / users active in the last x days (✔️ Good enough for start on auth0)
- UI overhaul II -> fix up design
  - mainly tour handling

# Last stretch before rewrite 
- show personalized stamp count in addition to total on tour page ✔️
- Friends feature ✔️
  - show group status on map ✔️
  - show group status on transient tour ✔️ (semi polished)
  - send and accept friend requests ✔️
  - display stamping state of group member on tour (detail) page ✔️
  - Profile Page (with edit for my User) ✔️
  - navigation to other Users Profile ✔️
  - display stamp list of friend and mine ✔️
  - initials for empty picture formatter ✔️
  - see friends of user and add via profile page ✔️
- remove event handler in tour view ✔️ (Workaround)
- authorize friend to stamp for me ✔️
- are you sure when deleting stampings ✔️
- support maps.me navigation ✔️
  - handle navigation on desktop ❌
- refactor scroll container on POI card / nearby stamps ✔️
- delete stamping from poi card ✔️
- Password User filter seems to not work on profile page (stamped by me)
- move GoogleMaps geo location API key / call into backend 

## Intermediate Fixes

- store group in url for reload
- click interaction on tour map is missing

## MVP 2

- friends can edit my tour + edit as own tour
- more graceful failing of edit tour and don't allow in the first place 
- share tour with preselected group?
- badges on profile page
- last stamped on profile
- stamp tour with one button and stamp for whole group
- open individual travel time in maps or hiking app like komoot
- add images & descriptions to stamps
- refactor starting algorithm
  - nearest
  - from stamp
  - from my location
- Update color schema of app to match background of mascot
- look into sapui5 vs openui5 (openUi5 does not have GeoMap) ✔️
- look into problem with 24 remaining routes
- export live data to dummy data
- fix handler to be normally performant: this.after('READ', `Stampboxes` -> use joins to load only needed group information
- Profile page ✔️
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
- compliant map server ~ (Current is okay for personal project, user MapBox later)
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
