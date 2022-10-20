# harzer-wander-buddy

Harzer Wander Buddy for stamp collecting

## Purpose

This app is intended to help plan your route and collect all 222 stamps.

## Start backend

1. move to backend/hwb
2. run npm i
3. run cds watch

> Information on the `@sap/cap-cds` license [here](https://answers.sap.com/questions/13018451/cap-runtime-license.html)

## Start frontend with ui5 cli

1. move to frontend-hwb
2. optionally adjust the backend url if working from BAS
3. run `npm start-local`

## Start frontend with approuter

1. move to frontend/approuter
2. run npm i
3. create a file called default-env.json with the content below
4. run npm start

```json
{
  "destinations": [{
    "name": "api",
    "url": "https://port4004-workspaces-ws-mfhnb.us10.trial.applicationstudio.cloud.sap"
  }]
}
```

> this starts the ui5 app served via an approuter

### Feature Backlog

1. Filtering on Map view -> Goethe weg usw.
2. Object Page
3. Parking Spot integration
4. Navigation to maps
5. Tour creation: have a mask and enpoint to calculate tours based on parameters
6. Admin Master data app -> new Stamps & moving
7. Deal with legacy Stamps & check for deveation on HWN site
8. History view
9. Routen speichern
