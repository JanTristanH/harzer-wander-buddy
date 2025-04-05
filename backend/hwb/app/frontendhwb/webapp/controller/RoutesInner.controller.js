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
                Controller.prototype.onInit.apply(this, arguments);
                this.initializeAppModelForMap();

                this.getView().setModel(new JSONModel(), "local");

                this.oFlexibleColumnLayout = this.byId("fcl");

                this.getRouter().getRoute("Routes").attachPatternMatched(this.setList, this);
                this.getRouter().getRoute("RoutesDetailTransient").attachPatternMatched(this.onDetailRouteMatched, this);
                this.getRouter().getRoute("RoutesDetailEdit").attachPatternMatched(this.onDetailRouteEditMatched, this);
                this.getRouter().getRoute("RoutesDetail").attachPatternMatched(this.onDetailRoutePersistedMatched, this);
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(1000);
                this.attachGroupChange();
            },

            attachGroupChange: function () {
                this.getModel("app").attachPropertyChange((oEvent) => {
                    if (oEvent.getParameter("path") == "/aSelectedGroupIds") {
                        // Retrieve the updated property from the model
                        let aSelectedGroup = this.getModel("app").getProperty("/aSelectedGroupIds") || [];
                        aSelectedGroup = JSON.parse(JSON.stringify(aSelectedGroup));
                        let currentUser = this.getModel("app").getProperty("/currentUser");
                        aSelectedGroup.push(currentUser.ID);

                        // Create binding filter for selected groups
                        let oFilter = new Filter("groupFilterStampings", FilterOperator.NE, aSelectedGroup.join(','));

                        // Apply filter to binding
                        const oBinding = this.byId("idTourList").getBinding("items");
                        if (oBinding) {
                            oBinding.filter(aSelectedGroup.length > 1 ? oFilter : null);

                            oBinding.attachDataReceived((oEvent) => {
                                const updatedTours = oEvent.getParameter("data").results
                                // update localModel with AverageGroupStampings
                                let oLocalModel = this.getView().getModel("local");
                                updatedTours.forEach(tour => {
                                    let oTour = oLocalModel.getProperty(`/Tours(${tour.ID})`);
                                    if (oTour) {
                                        oTour.AverageGroupStampings = tour.AverageGroupStampings || 0;
                                        oTour.path = this._addStampedUsers(oTour.path);
                                        oLocalModel.setProperty(`/Tours(${tour.ID})`, oTour);
                                    }
                                });
                            });
                        }
                    }
                });
            },

            onDetailRoutePersistedMatched: function (oEvent) {
                let oModel = this.getView().getModel();
                this.getModel("app").setProperty("/edit", false);

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
                    }.bind(this))
                    .catch(function (oError) {
                        // Handle any errors here
                        console.error("Error reading Stampboxes or ParkingSpots:", oError);
                    });
            },

            onDetailRouteEditMatched: function (oEvent) {
                this.onDetailRoutePersistedMatched(oEvent);
                this.getModel("app").setProperty("/edit", true);
                
                this._retryUpdateSplitter(0); // Start retry mechanism
            },
            
            _retryUpdateSplitter: function (iAttempt) {
                let oSplitter = sap.ui.getCore().byId("midView--idRoutesDetailSplitter");
                
                // Maximum retry attempts to prevent infinite loops
                const MAX_RETRIES = 10;
                const RETRY_DELAY = 500; // 200ms between retries
            
                if (oSplitter) {
                    let aContents = oSplitter.getContentAreas();
                    if (aContents && aContents.length >= 2) {
                        aContents[0].setLayoutData(new sap.ui.layout.SplitterLayoutData({ size: "30%" }));
                        aContents[1].setLayoutData(new sap.ui.layout.SplitterLayoutData({ size: "70%" }));
                        console.log("Splitter updated successfully!");
                    } else if (iAttempt < MAX_RETRIES) {
                        console.warn(`Splitter update failed, retrying... Attempt: ${iAttempt + 1}`);
                        setTimeout(() => this._retryUpdateSplitter(iAttempt + 1), RETRY_DELAY * Math.pow(2, iAttempt)); // Exponential backoff
                    } else {
                        console.error("Failed to update Splitter after multiple attempts.");
                    }
                } else if (iAttempt < MAX_RETRIES) {
                    console.warn(`Splitter not found, retrying... Attempt: ${iAttempt + 1}`);
                    setTimeout(() => this._retryUpdateSplitter(iAttempt + 1), RETRY_DELAY * Math.pow(2, iAttempt));
                } else {
                    console.error("Splitter not found after multiple attempts.");
                }
            },            

            onDetailRouteEditMatchedInner: function (oEvent) {
                let oLocalModel = this.getView().getModel("local");
                this.onDetailRouteMatched(oEvent);
                var sTourId = oEvent.getParameter("arguments").TourId;
                //TODO show detail page for persisted tour
                if (sTourId && oLocalModel.getProperty(`/Tours(${sTourId})`)) {
                    this._showDetailViewForIdList(sTourId);
                } else {
                    this.getModel().read(`/Tours(guid'${sTourId}')`, {
                        success: function (oData, response) {
                            // Check if the deferred entity needs to be loaded separately
                            // load in two steps as expand is currently broken
                            if (oData.path && oData.path.__deferred) {
                                this.loadTourTravelTime(sTourId, function (travelTimeData) {
                                    oData.path = travelTimeData;
                                    oLocalModel.setProperty(`/Tours(${oData.ID})`, oData);
                                    this._showDetailViewForIdList(oData.ID);
                                }.bind(this));
                            }
                        }.bind(this),
                        error: function (oError) {
                            MessageToast.show(this.getText("errorLoadingTour"));
                            console.error(oError);
                        }.bind(this)
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
                                positionString: obj.positionString,
                                AverageGroupStampings: obj.AverageGroupStampings || 0,
                            }));
                            oLocalModel.setProperty(`/Tours(${sIdListTravelTimes})`, oData.getTourByIdListTravelTimes);
                            this._showDetailViewForIdList(sIdListTravelTimes);
                        }.bind(this)
                    });
                } else {
                    // open Detail with correct data

                    oLocalModel.setProperty("/oSelectedTour", oTour);
                    oLocalModel.setProperty("/oSelectedTour/path", this._mapTravelTimeToPOIList(oTour.path));
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

            _getStartOfTour: function (oTour) {
                let sPositionString = oTour.path[1]?.positionString
                if (!Array.isArray(oTour.path) || !sPositionString) {
                    return (this.fallBackCords)
                }
                return sPositionString.split(';0')[0];

            },

            setList: function () {
                this.oFlexibleColumnLayout.setLayout(LayoutType.OneColumn);
                this.getModel("app").setProperty("/edit", false);
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
                
                
                this.byId('idAutocompleteInput').setBusy(false);
                this.pDialog.open();
                this.onAfterRenderingFragment();
            },

            onCancel: function () {
                this.pDialog.close();
            },

            onSubmitRouting: function () {
                var oModel = this.getView().getModel(); // Get the OData model
                var oDialogModel = this.pDialog.getModel();

                let aSelectedGroup = this.getModel("app").getProperty("/aSelectedGroupIds") || [];
                aSelectedGroup = JSON.parse(JSON.stringify(aSelectedGroup)); // create copy
                let currentUser = this.getModel("app").getProperty("/currentUser");
                aSelectedGroup.push(currentUser.ID);

                // Define the function import URL and parameters
                var sFunctionName = "/calculateHikingRoute";
                var oParams = {
                    maxDepth: oDialogModel.getProperty("/maxDepth"),
                    maxDuration: oDialogModel.getProperty("/maxDuration"),
                    maxDistance: oDialogModel.getProperty("/maxDistance") * 1000,
                    latitudeStart: oDialogModel.getProperty("/latitudeStart"),
                    longitudeStart: oDialogModel.getProperty("/longitudeStart"),
                    allowDriveInRoute: oDialogModel.getProperty("/allowDriveInRoute"),
                    minStampCount: oDialogModel.getProperty("/minStampCount"),
                    groupFilterStampings: aSelectedGroup.join(',')
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
                            MessageToast.show(this.getText("noRoutesFound"));
                        }
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show(this.getText("someThingWentWrong"));
                        this.pDialog.close();
                    }.bind(this)
                });
            },

            _writeHikingRoutesAsToursToModel: function (aHikingRoutes, oModel) {
                for (let oRoute of aHikingRoutes) {
                    oModel.setProperty(`/Tours(${oRoute.id})`, oRoute);
                }
            },

            onToursListSelectionChange: function (oEvent) {
                let oSelectedItem = oEvent.getParameter("listItem");
                oSelectedItem.setSelected(false);
                let TourId = oSelectedItem.getCustomData().find(data => data.getKey() === "ID").getValue();

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
                    // TODO friends: navigating into a tour does not show icons correctly
                    detailView.setModel("local", oLocalModel);
                    //get global Id via debugging for example in locate me function
                    this.oFlexibleColumnLayout.addMidColumnPage(detailView);
                    this.oFlexibleColumnLayout.setLayout(LayoutType.TwoColumnsMidExpanded);
                    this._oMap = sap.ui.getCore().byId("midView--RoutesMapId--map");
                    
                    // TODO AHAAAAAAAAAAAAAAAAAAAAA whats going on here:
                    if (this._oMap && sCenterPosition) {
                        this._oMap.setCenterPosition(sCenterPosition);
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

            onButtonCreateTourPress: function (oEvent) {
                var oPayload = {
                    "name": "Neue Tour",
                    "idListTravelTimes": "",
                };

                // Call function
                this.getModel().create("/Tours", oPayload, {
                    success: function (oData, response) {
                        this.getModel("local").setProperty(`/Tours(${oData.ID})`, oData);
                        MessageToast.show(this.getText("tourSaved"));

                        this.getModel("app").setProperty("/edit", true);
                        this.getRouter().navTo("RoutesDetailEdit", {
                            TourId: oData.ID
                        });

                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show(this.getText("error"));
                        console.error(oError);
                    }
                });
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