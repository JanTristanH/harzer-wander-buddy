sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Fragment, Filter, FilterOperator, MessageToast, JSONModel) {
        "use strict";
        const unstampedType = "Error";
        const stampedType = "Success";

        return Controller.extend("hwb.frontendhwb.controller.MapInner", {
            itemCache: [],
            _aParkingSpaceCache: [],
            _aStampedCache: [],
            _aUnStampedCache: [],

            _oMap: {},
            onInit: function () {
                this._oMap = this.byId("map");
                if (!this.getModel("local")) {
                    var oModel = new sap.ui.model.json.JSONModel();
                    oModel.setData({
                        UserLocationLat: 0,
                        UserLocationLng: 0,
                        centerPosition: "10.30147999999997;51.7462"
                    });
                    this.getView().setModel(oModel, "local");
                }
                this.getRouter().getRoute("MapWithPOI").attachPatternMatched(this.onMapWithPOIRouteMatched, this);
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(1000);
            },

            onGeoMapZoomChanged: function (oEvent) {
                let nZoomLevel = oEvent.getParameter("zoomLevel");
                this.onToggleLables(nZoomLevel >= 14);
            },

            onPressOpenFiltersMenu: function (oEvent) {
                var oButton = oEvent.getSource(),
                    oView = this.getView();

                // create popover
                if (!this._pPopover) {
                    this._pPopover = Fragment.load({
                        id: oView.getId(),
                        name: "hwb.frontendhwb.fragment.MapFilters",
                        controller: this
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }
                this._pPopover.then(function (oPopover) {
                    oPopover.openBy(oButton);
                });
            },

            onToggleLabelsCheckBox: function (oEvent) {
                this.onToggleLables(oEvent.getSource().getSelected());
            },

            onNotVisitedStampsCheckkBoxSelect: function (oEvent) {
                this.toggleUnStampedVisibility(oEvent.getSource().getSelected());
            },

            onVisitedStampsCheckkBoxSelect: function (oEvent) {
                this.toggleStampedVisibility(oEvent.getSource().getSelected());
            },
            onToggleLables: function (bVisible) {

                let aItems = [...this.byId("idAllPointsOfInterestsSpots").getItems()];
                const oParkingSpots = this.byId("idParkingSpotsSpots");
                oParkingSpots ? aItems.push(...oParkingSpots.getItems()) : null;

                aItems.forEach(e => {
                    let sText = e.getProperty("labelText");
                    sText = bVisible ? e.data("labelTextHidden") : "";
                    e.setProperty("labelText", sText);
                });
            },
            _createInitialItemCache: function () {
                //TODO this has to be reset on model Change urgh
                this.itemCache = this.getView().byId("idAllPointsOfInterestsSpots").getItems();
            },
            _getItemCache: function () {
                return this.itemCache;
            },
            _clearItemCache: function () {
                this.itemCache = [];
            },
            _resetItemsForSpots: function (spots) {
                spots.removeAllItems();
                this._getItemCache().forEach(item => {
                    spots.addItem(item);
                });
            },
            onToggleStampedSpots: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();

                let spots = this.getView().byId("idAllPointsOfInterestsSpots");
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") !== unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowGreens: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();

                let spots = this.getView().byId("idAllPointsOfInterestsSpots")
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") === unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowAllPress: function () {
                this.byId("idToggleLabelCheckBox").setSelected(true);
                this.byId("idToggleStampedCheckBox").setSelected(true);
                this.byId("idToggleUnstampedCheckBox").setSelected(true);
                this.byId("idParkingSpaceCheckBox").setSelected(true);
                this.onToggleLables(true);
                this.toggleStampedVisibility(true);
                this.toggleUnStampedVisibility(true);
                this.toggleParkingSpaceVisibility(true);
            },

            onParkingSpaceCheckBox: function (oEvent) {
                this.toggleParkingSpaceVisibility(oEvent.getSource().getSelected());
            },

            toggleParkingSpaceVisibility: function (bVisible) {
                let oSpots = this.byId("idParkingSpotsSpots");
                //create cache with unmodified items if not existent
                if (this._aParkingSpaceCache.length == 0) {
                    this._aParkingSpaceCache = oSpots.getItems();
                }

                if (bVisible) {
                    //show parking
                    this._aParkingSpaceCache.forEach(item => oSpots.addItem(item));
                } else {
                    //hide parking spaces
                    oSpots.getItems().forEach(e => oSpots.removeItem(e));
                }
            },

            toggleStampedVisibility: function (bVisible) {
                let oSpots = this.getView().byId("idAllPointsOfInterestsSpots");
                //create cache with unmodified items if not existent
                if (this._aStampedCache.length == 0) {
                    this._aStampedCache = oSpots.getItems().filter(e => e.getProperty("type") === stampedType);
                }

                if (bVisible) {
                    //show stamped
                    this._aStampedCache.forEach(item => oSpots.addItem(item));
                } else {
                    //hide stamped
                    oSpots.getItems().filter(e => e.getProperty("type") === stampedType).forEach(e => oSpots.removeItem(e));
                }
            },

            toggleUnStampedVisibility: function (bVisible) {
                let oSpots = this.getView().byId("idAllPointsOfInterestsSpots");
                //create cache with unmodified items if not existent
                if (this._aUnStampedCache.length == 0) {
                    this._aUnStampedCache = oSpots.getItems().filter(e => e.getProperty("type") === unstampedType);
                }

                if (bVisible) {
                    //show stamped
                    this._aUnStampedCache.forEach(item => oSpots.addItem(item));
                } else {
                    //hide stamped
                    oSpots.getItems().filter(e => e.getProperty("type") === unstampedType).forEach(e => oSpots.removeItem(e));
                }
            },

            onLocateMePress: function () {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        function (position) {
                            let oUserLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            let oLocalModel = this.getModel("local");
                            oLocalModel.setProperty("/UserLocationLat", oUserLocation.lat);
                            oLocalModel.setProperty("/UserLocationLng", oUserLocation.lng);
                            this._oMap.setCenterPosition(`${oUserLocation.lng};${oUserLocation.lat}`);
                        }.bind(this),
                        function (oError) {
                            //TODO handele error 
                            debugger
                        },
                        { timeout: 3000 });
                } else {
                    //TODO handle not available
                    debugger
                }
            },

            onFormatBoxType: function (oStampings) {
                if (oStampings.length) {
                    return 'Success';
                }
                return 'Error';
            },

            onSpotContextMenu: function (oEvent) {
                let sStampNumber = oEvent.getSource().getText();
                const sLink = `https://www.harzer-wandernadel.de/?s=${sStampNumber}`;
                window.open(sLink, '_blank').focus();
            },

            onSearchFieldSuggest: function (oEvent) {
                const oSearchField = oEvent.getSource();
                const sValue = oEvent.getParameter("suggestValue").toLowerCase();
                let aFilters = [];
                for (const sWord of sValue.split(" ")) {
                    aFilters.push(new Filter("name", FilterOperator.Contains, sWord));
                    aFilters.push(new Filter("name", FilterOperator.Contains, sWord.charAt(0).toUpperCase() + sWord.slice(1)));

                }
                const oFinalFilter = new Filter({
                    filters: aFilters,
                    and: false,
                });

                this.getModel().read("/AllPointsOfInterest", {
                    filters: [oFinalFilter],
                    success: function (oData) {
                        this.getModel("local").setProperty("/suggestionItems", oData.results.slice(0, 10));
                        oSearchField.suggest();
                    }.bind(this),
                })
            },

            onSearchFieldSearch: function (oEvent) {
                var oItem = oEvent.getParameter("suggestionItem");
                if (oItem) {
                    this._oMap.setCenterPosition(oItem.getKey());
                } else {
                    MessageToast.show("Bitte einen Ort aus der Liste auswählen!");
                }
            },

            onMapWithPOIRouteMatched: function (oEvent) {
                let sCurrentSpotId = oEvent.getParameter("arguments").idPOI;
            
                // Define the callback function to handle the render event
                const fnRenderHandler = () => {
                    let aItems = [...this.byId("idAllPointsOfInterestsSpots").getItems()];
                    const oParkingSpots = this.byId("idParkingSpotsSpots");
            
                    if (oParkingSpots) {
                        aItems.push(...oParkingSpots.getItems());
                    }
            
                    const oSpot = aItems.find(e => e.data("id") === sCurrentSpotId);
            
                    if (oSpot) {
                        // Detach the render event once the spot is found
                        this._oMap.detachEvent("render", fnRenderHandler);
                        this.onSpotClick({ getSource: function () { return oSpot; } }, true);
                    }
                };
            
                // Attach the render event to wait until the control is rendered
                this._oMap.attachEvent("render", fnRenderHandler);
            },

            onSpotClick: function (oEvent, bSuppressNavigation) {
                const oSplitter = sap.ui.getCore().byId("container-hwb.frontendhwb---Map--idSplitter");
                if (oSplitter.getContentAreas().length > 1) {
                    // if more than 1 exists, the info card is open and can be recreated
                    // this also resets the location of the splitter
                    const oLastContentArea = oSplitter.getContentAreas().pop();
                    oSplitter.removeContentArea(oLastContentArea);
                    oLastContentArea.destroy();
                    this._pSPOIInforCard = null;
                    setTimeout(() => this.onSpotClick(oEvent), 0);
                    return;
                }

                let oView = this.getView();
                if (!this._pSPOIInforCard) {
                    this._pSPOIInforCard = Fragment.load({
                        id: oView.getId(),
                        name: "hwb.frontendhwb.fragment.POIInfoCard",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                const oSpot = oEvent.getSource();
                let sCurrentSpotId = oSpot.data("id");
                let localModel = this.getModel("local");
                localModel.setProperty("/sCurrentSpotId", sCurrentSpotId);
                localModel.setProperty("/title", oSpot.data("labelTextHidden"));
                localModel.setProperty("/description", oSpot.data("description"));
                localModel.setProperty("/bStampingVisible", this.stringToBoolean(oSpot.data("stamp")));
                localModel.setProperty("/bStampingEnabled", oSpot.getType() == "Error");
                localModel.setProperty("/sSelectedSpotLocation", oSpot.getPosition());
                this._oMap.setCenterPosition(oSpot.getPosition());

                if(!bSuppressNavigation) {
                    this.getRouter().navTo("MapWithPOI", { idPOI: sCurrentSpotId });
                }

                this._pSPOIInforCard.then(oInfoCard => {
                    oSplitter.addContentArea(oInfoCard);
                    oSplitter.resetContentAreasSizes();
                });
            },

            formatStampButtonIcon: function (bStampingEnabled) {
                // disabled = already stamped -> no quick stamp
                if (bStampingEnabled) {
                    return "sap-icon://checklist-item";
                } else {
                    return "sap-icon://checklist-item-2";
                }
            },
            onButtonStampPress: function (oEvent) {
                debugger
                const oModel = this.getModel(),
                localModel = this.getModel("local");
                let ID = localModel.getProperty("/sCurrentSpotId");
                let mParameters = {
                    success: () => {
                        oEvent.getSource().setIcon("sap-icon://checklist-item-2");
                        oEvent.getSource().setEnabled(false);
                        MessageToast.show("Saved Stamping");
                        oModel.refresh();
                    },
                    // give message and reset ui to keep it consistent with backend
                    error: () => MessageToast.show("An Error Occured")
                }
                oModel.create("/Stampings", {
                    "stamp": {
                        ID
                    }
                }, mParameters);
            },

            onButtonOpenWithMapsAppPress: function () {
                const sLocation = this.getModel("local").getProperty("/sSelectedSpotLocation");
                const lat = sLocation.split(";")[1];
                const long = sLocation.split(";")[0];
                if /* if we're on iOS, open in Apple Maps */
                    (/iPad|iPhone|iPod/.test(navigator.userAgent))
                    window.open(`maps://maps.google.com/maps?daddr=${lat},${long}&amp;ll=`); else /* else use Google */
                    window.open(`https://maps.google.com/maps?daddr=${lat},${long}&amp;ll=`);
            }
        });
    });