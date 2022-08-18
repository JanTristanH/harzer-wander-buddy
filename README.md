# harzer-wander-buddy
Harzer Wander Buddy for stamp collecting

## Purpose

This app is intended to help plan your route and collect all 222 stamps.

## Start backend

1. move to backend/hwb
2. run npm i
3. run cds watch

## Start frontend

1. move to frontend/approuter
2. run npm i
3. create a file called default-env.json with the following content
```json
{
  "destinations": [{
    "name": "api",
    "url": "https://port4004-workspaces-ws-mfhnb.us10.trial.applicationstudio.cloud.sap"
  }]
}
```

4. run npm start

> this starts the ui5 app served via an approuter

