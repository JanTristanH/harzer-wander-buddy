sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/XMLView",
    "sap/f/library",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, XMLView, fioriLibrary, MessageToast, Filter, FilterOperator) {
        "use strict";
        var autocomplete; //inspired by https://github.com/costa-satsati/addressautocomplete/
        var LayoutType = fioriLibrary.LayoutType;

        return Controller.extend("hwb.frontendhwb.controller.RoutesInner", {
            itemCache: [],
            _oMap: {},

            onInit: function () {
                this.getView().setModel(new JSONModel(), "local");
                
                this.oFlexibleColumnLayout = this.byId("fcl");
                this.bus = this.getOwnerComponent().getEventBus();
                this.bus.subscribe("flexible", "setList", this.setList, this);
                
                //Open routing dialog when opening this view
                // this.getRouter().getRoute("Routes").attachPatternMatched(this.onOpenRoutingDialog, this);
                this.getRouter().getRoute("RoutesDetailTransient").attachPatternMatched(this.onDetailRouteMatched, this);
                this.getRouter().getRoute("RoutesDetailEdit").attachPatternMatched(this.onDetailRouteEditMatched, this);
                this.getRouter().getRoute("RoutesDetail").attachPatternMatched(this.onDetailRoutePersistedMatched, this);
            },
            onDetailRoutePersistedMatched: function (oEvent) {
                let oModel = this.getView().getModel();
                let oLocalModel = this.getView().getModel("local");

                // Create promises for the read operations
                let stampboxesPromise = new Promise(function (resolve, reject) {
                    oModel.read("/Stampboxes", {
                        urlParameters: {
                            "$top": 500
                        },
                        success: function (oData) {
                            resolve(oData);
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });

                let parkingSpotsPromise = new Promise(function (resolve, reject) {
                    oModel.read("/ParkingSpots", {
                        urlParameters: {
                            "$top": 500
                        },
                        success: function (oData) {
                            resolve(oData);
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });

                // Wait for both requests to finish
                Promise.all([stampboxesPromise, parkingSpotsPromise])
                    .then(function () {
                        // Continue once both requests are successful
                        this.onDetailRouteEditMatchedInner(oEvent);
                        oLocalModel.setProperty("/edit", false);
                    }.bind(this))
                    .catch(function (oError) {
                        // Handle any errors here
                        console.error("Error reading Stampboxes or ParkingSpots:", oError);
                    });
            },

            onDetailRouteEditMatched: function (oEvent) {
                this.onDetailRoutePersistedMatched(oEvent);
                setTimeout(() => this.getModel("local").setProperty("/edit", true), 1500);
            },

            onDetailRouteEditMatchedInner: function (oEvent) {
                let oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/edit", true);
                this.onDetailRouteMatched(oEvent);
                var sTourId = oEvent.getParameter("arguments").TourId;
                //TODO show detail page for persisted tour
                if (sTourId && oLocalModel.getProperty(`/Tours(${sTourId})`)) {
                    this._showDetailViewForIdList(sTourId);
                } else {
                    this.getModel().read(`/Tours(${sTourId})`, {
                        success: function (oData, response) {
                            // Check if the deferred entity needs to be loaded separately
                            // load in two steps as expand is currently broken
                            if (oData.path && oData.path.__deferred) {
                                this.getModel().read(`/Tour2TravelTime`, {
                                    urlParameters: { 
                                        "$expand": "travelTime",
                                        "$orderby": "rank desc"
                                    },
                                    filters: [
                                        new Filter("tour_ID", FilterOperator.EQ, sTourId)
                                    ],
                                    success: function (oRelatedData, oResponse) {
                                        // Set the related data in the local model or handle as needed
                                        oData.path = oRelatedData.results
                                            .map(path => {
                                                const tt = path.travelTime;
                                                const poi = this._getPoiById(tt.toPoi);
                                                
                                                tt.name = poi ? poi.name : this.getText("start");
                                                tt.duration = tt.durationSeconds;
                                                tt.distance = tt.distanceMeters;
                                        
                                                return tt;
                                            });
                                    
                                        oLocalModel.setProperty(`/Tours(${oData.ID})`, oData);

                                        // Show details for the main entity
                                        this._showDetailViewForIdList(oData.ID);
                                    }.bind(this),
                                    error: function (oError) {
                                        MessageToast.show("Error loading deferred entity!");
                                        console.error(oError);
                                    }
                                });
                            }
                        }.bind(this),
                        error: function (oError) {
                            MessageToast.show("Error saving the tour!");
                            console.error(oError);
                        }
                    });
                }
                this.getModel("local").setProperty("/sIdListTravelTimes", sTourId);
            },

            onDetailRouteMatched: function (oEvent) {
                // Get the route parameters
                var oArguments = oEvent.getParameter("arguments");
                var idListTravelTimes = oArguments.idListTravelTimes;
                if (idListTravelTimes) {
                    this._showDetailViewForIdList(idListTravelTimes);
                }
                this.getModel("local").setProperty("/sIdListTravelTimes", idListTravelTimes);
            },

            _showDetailViewForIdList: function (sIdListTravelTimes) {
                // load id to model
                let oLocalModel = this.getView().getModel("local");
                let oTour = oLocalModel.getProperty(`/Tours(${sIdListTravelTimes})`)
                if (!oTour) {
                    this.getModel().callFunction("/getTourByIdListTravelTimes", {
                        method: "GET",
                        urlParameters: { idListTravelTimes: sIdListTravelTimes },
                        success: function (oData) {
                            // todo harmonize in backend
                            oData.getTourByIdListTravelTimes.path = oData.getTourByIdListTravelTimes.path.map(obj => ({
                                id: obj.ID,
                                fromPoi: obj.fromPoi,
                                name: obj.name,
                                poi: obj.toPoi,
                                duration: obj.durationSeconds,
                                distance: obj.distanceMeters,
                                travelMode: obj.travelMode,
                                toPoiType: obj.toPoiType,
                                positionString: obj.positionString
                            }));
                            oLocalModel.setProperty(`/Tours(${sIdListTravelTimes})`, oData.getTourByIdListTravelTimes);
                            this._showDetailViewForIdList(sIdListTravelTimes);
                        }.bind(this)
                    });
                } else {
                    // open Detail with correct data
                    oLocalModel.setProperty("/oSelectedTour", oTour);
                    oLocalModel.setProperty("/routes", this._mapTravelTimeToPOIList(oTour.path));
                    oLocalModel.setProperty("/stampCount", oTour.stampCount);
                    oLocalModel.setProperty("/distance", oTour.distance);
                    oLocalModel.setProperty("/duration", oTour.duration);
                    oLocalModel.setProperty("/name", oTour.name);
                    oLocalModel.setProperty("/wayPointScrollContainerHeight", "400px");

                    let sStartOfTour = this._getStartOfTour(oTour);
                    oLocalModel.setProperty("/centerPosition", sStartOfTour);
                    this.setDetailPage(sStartOfTour);

                    setTimeout(() => {
                        //TODO attach to fitting event
                        this.setDetailPage(sStartOfTour)
                    }, 100);
                }
            },

            _mapTravelTimeToPOIList: function (aPath) {
                if (!Array.isArray(aPath)) {
                    return [];
                }
                if (aPath.filter(p => p.id == "start").length != 0) {
                    return aPath;
                }
                let toPoi = aPath[0].fromPoi;
                aPath.unshift({
                    "id": "start",
                    "name": this._getPoiById(toPoi)?.name || this.getText("start"),
                    //"fromPoi": "1e4b7315-a596-4e73-95b6-92fbf79a92a1",
                    "toPoi": toPoi,
                    "duration": 0,
                    "distance": 0,
                    "travelMode": "start",
                    "toPoiType": "start",
                    "rank": 0
                });

                let rank = 2048;
                aPath.reverse();
                aPath = aPath.map(p => {
                    p.rank = rank;
                    rank = rank * 2;
                    return p;
                });
                aPath.reverse();
                return aPath;
            },

            _getStartOfTour: function (oTour) {
                let sPositionString = oTour.path[1].positionString
                if (!Array.isArray(oTour.path) || !sPositionString) {
                    return ("10.445580000000064;51.80594")
                }
                return sPositionString.split(';0')[0];

            },

            setList: function () {
                this.oFlexibleColumnLayout.setLayout(LayoutType.OneColumn);
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(1000);
            },

            onOpenRoutingDialog: async function () {
                var oView = this.getView();

                // Create dialog lazily
                if (!this.pDialog) {
                    this.pDialog = await this.loadFragment({
                        name: "hwb.frontendhwb.fragment.HikingRouteDialog"
                    });


                    this.pDialog.open();

                    oView.addDependent(this.pDialog);
                    this.onAfterRenderingFragment();

                    // create routing model
                    var oModel = new JSONModel({
                        maxDepth: 15,
                        maxDuration: new Date(1 * 60 * 60 * 1000), // TODO timezone dependant 
                        maxDistance: 15,
                        latitudeStart: '',
                        longitudeStart: '',
                        allowDriveInRoute: true,
                        minStampCount: 1
                    });
                    this.pDialog.setModel(oModel);
                }


                this.pDialog.open();
                this.onAfterRenderingFragment();
            },

            onCancel: function () {
                this.pDialog.close();
            },

            onSubmitRouting: function () {
                var oModel = this.getView().getModel(); // Get the OData model
                var oDialogModel = this.pDialog.getModel();

                // Define the function import URL and parameters
                var sFunctionName = "/calculateHikingRoute";
                var oParams = {
                    maxDepth: oDialogModel.getProperty("/maxDepth"),
                    maxDuration: oDialogModel.getProperty("/maxDuration"),
                    maxDistance: oDialogModel.getProperty("/maxDistance") * 1000,
                    latitudeStart: oDialogModel.getProperty("/latitudeStart"),
                    longitudeStart: oDialogModel.getProperty("/longitudeStart"),
                    allowDriveInRoute: oDialogModel.getProperty("/allowDriveInRoute"),
                    minStampCount: oDialogModel.getProperty("/minStampCount")
                };
                oParams.maxDuration = Math.round(oParams.maxDuration.getTime() / 1000) + 3600; //TODO timezone
                // Call the function import
                oModel.callFunction(sFunctionName, {
                    method: "GET",
                    urlParameters: oParams,
                    success: function (oData) {
                        this.byId("idIconTabBarMulti").setSelectedKey("iconTabFilterCalculatedRoutes");

                        this.setDetailPage();
                        // Additional success handling
                        let oLocalModel = this.getView().getModel("local"),
                            results = oData.calculateHikingRoute.results,
                            oInitiallySelectedTour = results[0];
                        oLocalModel.setProperty("/hikingRoutes", results);

                        // Map results of calculation to Tour property of model, refactor later
                        this._writeHikingRoutesAsToursToModel(results, oLocalModel);

                        this.pDialog.close();
                        if (!!results.length) {
                            this.byId("idTourCalculateButton").setVisible(true);
                            sap.m.MessageToast.show(this.getModel("i18n").getProperty("routeCalculatedSuccessfully"));
                            this.getRouter().navTo("RoutesDetailTransient", {
                                idListTravelTimes: oInitiallySelectedTour.id
                            });
                        } else {
                            sap.m.MessageToast.show(this.getModel("i18n").getProperty("noRoutesFound"));
                        }
                    }.bind(this),
                    error: function (oError) {
                        sap.m.MessageToast.show(this.getModel("i18n").getProperty("someThingWentWrong"));
                        // Additional error handling
                        this.pDialog.close();
                    }
                });
            },
            _writeHikingRoutesAsToursToModel: function (aHikingRoutes, oModel) {
                for (let oRoute of aHikingRoutes) {
                    oModel.setProperty(`/Tours(${oRoute.id})`, oRoute);
                }
            },

            onSelectionChangeTour: function (oEvent) {
                let TourId = oEvent.getParameter("selectedItem").getKey()
                    || this.getRouter().getRouteInfoByHash(this.getRouter().getHashChanger().getHash()).arguments.TourId;
                this.getRouter().navTo("RoutesDetail", {
                    TourId
                });
            },

            onSelectionChange: function (oEvent) {
                let idListTravelTimes = oEvent.getParameter("selectedItem").getKey();
                this.getRouter().navTo("RoutesDetailTransient", {
                    idListTravelTimes
                });
            },

            setDetailPage: function (sCenterPosition) {
                this._loadView({
                    id: "midView",
                    viewName: "hwb.frontendhwb.view.RoutesMap"
                }).then(function (detailView) {
                    let oLocalModel = this.getView().getModel("local");
                    oLocalModel.setProperty("/edit", false);
                    detailView.setModel("local", oLocalModel);
                    //get global Id via debugging for example in locate me function
                    this.oFlexibleColumnLayout.addMidColumnPage(detailView);
                    this.oFlexibleColumnLayout.setLayout(LayoutType.TwoColumnsMidExpanded);
                    this._oMap = sap.ui.getCore().byId("midView--RoutesMapId--map");
                    if (this._oMap && sCenterPosition) {
                        this._oMap.setCenterPosition(sCenterPosition);
                        let oNestedController = sap.ui.getCore().byId("midView--RoutesMapId").getController()
                        oNestedController.onSpotClick = () => { };
                        oNestedController.onSpotContextMenu = () => { };
                    } else if (sCenterPosition) {
                        setTimeout(() => {
                            //TODO attach to fitting event
                            this.setDetailPage(sCenterPosition)
                        }, 100);
                    }
                }.bind(this));
            },
            // Helper function to manage the lazy loading of views
            _loadView: function (options) {
                var mViews = this._mViews = this._mViews || Object.create(null);
                if (!mViews[options.id]) {
                    mViews[options.id] = this.getOwnerComponent().runAsOwner(function () {
                        return XMLView.create(options);
                    });
                }
                return mViews[options.id];
            },

            onUseCurrentLocation: function () {
                this.byId('idAutocompleteInput').setBusy(true);
                this._geolocate();
            },

            onAfterRenderingFragment: function () {
                autocomplete = new google.maps.places.Autocomplete(
                    (this.byId('idAutocompleteInput').getDomRef('inner')), {
                    types: ['geocode']
                });
                autocomplete.addListener('place_changed', function () {
                    // Get the place details from the autocomplete object.
                    var place = autocomplete.getPlace();
                    this.pDialog.getModel().setProperty("/latitudeStart", place.geometry.location.lat());
                    this.pDialog.getModel().setProperty("/longitudeStart", place.geometry.location.lng());

                    // // Get each component of the address from the place details
                    // // and fill the corresponding field on the form.
                    // addressModel = this.getView().getModel("addressModel");
                    // for (var i = 0; i < place.address_components.length; i++) {
                    //     var addressType = place.address_components[i].types[0];
                    //     if (addressMapping[addressType]) {
                    //         var val = place.address_components[i]["short_name"];
                    //         addressModel.setProperty("/"+addressMapping[addressType],val);
                    //     }
                    // }
                }.bind(this));
                // this._geolocate();
            },

            /** 
             * Private method to prompt for location
             * @constructor 
             */
            _geolocate: function () {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        this.byId('idAutocompleteInput').setBusy(false);
                        var geolocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        var circle = new google.maps.Circle({
                            center: geolocation,
                            radius: position.coords.accuracy
                        });
                        autocomplete.setBounds(circle.getBounds());
                        this.pDialog.getModel().setProperty("/latitudeStart", geolocation.lat);
                        this.pDialog.getModel().setProperty("/longitudeStart", geolocation.lng);
                        this.byId('idAutocompleteInput').setValue("Aktueller Standort 📍")
                    }.bind(this));
                }
            }
        });
    });