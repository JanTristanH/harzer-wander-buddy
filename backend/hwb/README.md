# Getting Started

## Todo

- implement api call to maps to get times (by travel type) ✔️
- berechnete Travel Times extern persistieren ✔️
- implement DFS to suggest routes ✔️
- UI für suggested routes -> General route planning & viewing ✔️
- dev deploy on domain ✔️
- Mobile optimization & UI overhaul with mobile optimization                          --> do this sooner? 
    - show user location on map
    - enhance List / route handling (show difference walk/drive & parking)
    - allow manual changes to routes
- Too many parking spaces obscure the relevant neighbor travel times.           --> Sort some out & add
- enhance data quality, parking spaces & routes
- Distanz < 10 km start n nächtste Nachbarn
- backup for user stamps (when using temporary sqlite)

## MVP 2

- shareability for routes
- cute mascot
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


Welcome to your new project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`package.json` | project metadata and configuration
`readme.md` | this getting started guide


## Next Steps

- Open a new terminal and run `cds watch` 
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start adding content, for example, a [db/schema.cds](db/schema.cds).


## Learn More

Learn more at https://cap.cloud.sap/docs/get-started/.
