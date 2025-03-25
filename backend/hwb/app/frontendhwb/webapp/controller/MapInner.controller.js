sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Fragment, Filter, FilterOperator, MessageToast, JSONModel, Sorter) {
        "use strict";
        let isDragging = false;
        return Controller.extend("hwb.frontendhwb.controller.MapInner", {
            itemCache: [],
            _aParkingSpaceCache: [],
            _aStampedCache: [],
            _aUnStampedCache: [],

            _oMap: {},
            onInit: function () {
                Controller.prototype.onInit.apply(this, arguments);
                this.getModel().setSizeLimit(1000);
                this.initializeAppModelForMap();

                this._oMap = this.byId("map");
                if (!this._oMap) {
                    return;
                }
                if (!this.getModel("local")) {
                    var oModel = new JSONModel();
                    oModel.setData({
                        UserLocationLat: 0,
                        UserLocationLng: 0,
                        centerPosition: "10.615779999999972;51.80054",
                        TravelTimes: [{}]
                    });
                    this.getView().setModel(oModel, "local");
                    this._oMap.setCenterPosition(oModel.getProperty("/centerPosition"));
                }
                this.getRouter().getRoute("MapWithPOI").attachPatternMatched(this.onMapWithPOIRouteMatched, this);
                this.getRouter().getRoute("Map").attachPatternMatched(this.onMapRouteMatched, this);
                //check localstorage last center position and set it
                let sLastCenterPosition = sessionStorage.getItem("lastCenterPosition");
                if (sLastCenterPosition) {
                    this._oMap.setCenterPosition(sLastCenterPosition);
                    // create current location marker
                    this.onLocateMePress(null, false);
                } else {
                    this.onLocateMePress(null, true);
                }
            },

            onAfterRendering: function () {
                this._initBottomSheetDrag();
            },

            onShowBottomSheet: function () {
                const sheet = this.byId("bottomSheet").getDomRef();
                // Make it visible in SAPUI5
                this.byId("bottomSheet").setVisible(true);

                document.body.style.overflow = "hidden";
                // Slide it up into view
                sheet.style.transform = "translateY(0)";
            },

            onCloseBottomSheet: function () {
                const sheet = this.byId("bottomSheet").getDomRef();
                // Slide it down off-screen
                sheet.style.transform = "translateY(100%)";

                // After the transition, hide it
                setTimeout(() => {
                    bottomSheet.style.display = "none";
                    document.body.style.overflow = "auto";
                    bottomSheet.style.bottom = "-100%";
                }, 300);
            },

            _initBottomSheetDrag: function () {
                const bottomSheet = document.querySelector(".bottom-sheet");
                const sheetHeader = document.querySelector(".sheet-header");
                const dragHandle = document.querySelector(".drag-handle");
                const closeBtn = document.querySelector(".close-btn");
            
                let startY, startBottom;
            
                // Mouse events
                sheetHeader.addEventListener("mousedown", startDraggingMouse);
                dragHandle.addEventListener("mousedown", startDraggingMouse);
                document.addEventListener("mouseup", stopDragging);
                document.addEventListener("mousemove", dragMouse);
            
                // Touch events
                sheetHeader.addEventListener("touchstart", startDraggingTouch, { passive: false });
                dragHandle.addEventListener("touchstart", startDraggingTouch, { passive: false });
                document.addEventListener("touchend", stopDragging);
                document.addEventListener("touchmove", dragTouch, { passive: false });
            
                closeBtn.addEventListener("click", hideBottomSheet);
            
                function startDraggingMouse(e) {
                    e.preventDefault();
                    isDragging = true;
                    startY = e.clientY;
                    startBottom = parseInt(getComputedStyle(bottomSheet).bottom);
                }
            
                function dragMouse(e) {
                    if (!isDragging) return;
                    const deltaY = e.clientY - startY;
                    bottomSheet.style.bottom = Math.max(startBottom - deltaY, 0) + "px";
                }
            
                function startDraggingTouch(e) {
                    e.preventDefault();
                    isDragging = true;
                    startY = e.touches[0].clientY;
                    startBottom = parseInt(getComputedStyle(bottomSheet).bottom);
                }
            
                function dragTouch(e) {
                    if (!isDragging) return;
                    const deltaY = e.touches[0].clientY - startY;
                    bottomSheet.style.bottom = Math.max(startBottom - deltaY, 0) + "px";
                }
            
                function stopDragging() {
                    isDragging = false;
                }
            
                function hideBottomSheet() {
                    bottomSheet.style.display = "none";
                    document.body.style.overflow = "auto";
                    bottomSheet.style.bottom = "-100%";
                }
            },            

            attachGroupChange: function () {
                this.getModel("app").attachPropertyChange((oEvent) => {
                    if (oEvent.getParameter("path") == "/aSelectedGroupIds") {
                        this.applyGroupFilter();
                    }
                });
            },

            applyGroupFilter: function () {
                // Retrieve the updated property from the model
                let aSelectedGroup = this.getModel("app").getProperty("/aSelectedGroupIds") || [];
                aSelectedGroup = JSON.parse(JSON.stringify(aSelectedGroup)); // create copy
                let currentUser = this.getModel("app").getProperty("/currentUser");
                aSelectedGroup.push(currentUser.ID);

                // Create binding filter for selected groups
                let oFilter = new Filter("groupFilterStampings", FilterOperator.NE, aSelectedGroup.join(','));

                // Apply filter to binding
                const oBinding = this.byId("idAllPointsOfInterestsSpots").getBinding("items");
                if (oBinding) {
                    oBinding.filter(aSelectedGroup.length > 1 ? oFilter : null);
                }
            },

            onGeoMapZoomChanged: function (oEvent) {
                let nZoomLevel = oEvent.getParameter("zoomLevel");
                this.getModel("app").setProperty("/zoomlevel", parseInt(nZoomLevel, 10));
                // save zoom level in session storage
                sessionStorage.setItem("lastZoomLevel", nZoomLevel);
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

            onShowAllPress: function () {
                this.getModel("app").setProperty("bShowLabels", true);
                this.getModel("app").setProperty("bShowParkingSpots", true);
                this.getModel("app").setProperty("/bShowStampedSpots", true);
                this.getModel("app").setProperty("/bShowUnStampedSpots", true);
            },

            onLocateMePress: function (oEvent, bMoveToLocation = true) {
                if (navigator.geolocation) {
                    MessageToast.show(this.getText("locatingMe"));
                    navigator.geolocation.getCurrentPosition(
                        function (position) {
                            let oUserLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            if (oUserLocation.lat == 0 && oUserLocation.lng == 0) {
                                MessageToast.show(this.getText("errorLocateMe"));
                                return;
                            }
                            let oLocalModel = this.getModel("local");
                            oLocalModel.setProperty("/UserLocationLat", oUserLocation.lat);
                            oLocalModel.setProperty("/UserLocationLng", oUserLocation.lng);
                            this._oMap.setInitialPosition(`${oUserLocation.lng};${oUserLocation.lat};0`);
                            if (bMoveToLocation) {
                                oLocalModel.setProperty("/centerPosition", `${oUserLocation.lng};${oUserLocation.lat}`);
                                this._oMap.zoomToGeoPosition(oUserLocation.lng, oUserLocation.lat, this.nZoomLevelLabelThreshold);
                            }
                        }.bind(this),
                        function (oError) {
                            MessageToast.show(this.getText("errorLocateMe"));
                        }.bind(this),
                        { timeout: 7500 });
                } else {
                    MessageToast.show(this.getText("errorLocatorNotSupported"));
                }
            },

            onFormatBoxType: function (oBox, bShowStampedSpots, bShowUnStampedSpots, hasVisited) {
                const bShouldDisplayByFilter = (hasVisited && bShowStampedSpots) || (!hasVisited && bShowUnStampedSpots);
                if (!bShouldDisplayByFilter) {
                    return 'Hidden'
                }
                if (oBox.groupSize == oBox.totalGroupStampings) {
                    return 'Success';
                } else if (oBox.totalGroupStampings == 0) {
                    return 'Error';
                } else {
                    return 'Warning';
                }
            },

            onFormatLabelText: function (sName, nZoomLevel, bShowLabels, bShowSpot, sId, sSelectedId) {
                const bShowText = sId == sSelectedId || (bShowSpot && bShowLabels && nZoomLevel >= 16);
                return bShowText ? sName : "";
            },

            onFormatStampLabelText: function (sName, nZoomLevel, bShowLabels, bShowStampedSpots, bShowUnStampedSpots, hasVisited, sId, sSelectedId) {
                const bShouldDisplayByFilter = (hasVisited && bShowStampedSpots) || (!hasVisited && bShowUnStampedSpots);
                const isSelected = sId == sSelectedId;
                return isSelected || (bShouldDisplayByFilter && bShowLabels && nZoomLevel >= 16) ? sName : "";
            },

            onFormatBooleanToSemanticType: function (bVisible, nZoomLevel) {
                return bVisible && nZoomLevel >= 13 ? 'Default' : 'Hidden';
            },

            onFormatParkingText: function (nZoomLevel, sText) {
                return nZoomLevel >= 11 ? sText : '';
            },

            onFormatSpotScale: function (sSpotID, sSelectedID) {
                if (sSpotID == sSelectedID) {
                    return "1.4;1.4;1";
                }
                return "1;1;1";
            },

            onSpotContextMenu: function (oEvent) {
                if (this.getRouter().getHashChanger().hash.includes("tour")) {
                    return;
                }
                this.onButtonOpenExternalPress(oEvent);
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
                    sorters: [new Sorter('orderBy')],
                    urlParameters: {
                        $top: 10
                    },
                    success: function (oData) {
                        this.getModel("local").setProperty("/suggestionItems", oData.results);
                        oSearchField.suggest();
                    }.bind(this),
                })
            },

            onSearchFieldSearch: function (oEvent) {
                const oItem = oEvent.getParameter("suggestionItem");
                const oSearchField = oEvent.getSource();
                if (oItem) {
                    oSearchField._blur();
                    this.getRouter().navTo("MapWithPOI", { idPOI: oItem.getKey() });
                } else {
                    MessageToast.show(this.getText("selectPointFromList"));
                }
            },

            onMapRouteMatched: function (oEvent) {
                this.applyGroupFilter();
                this.getModel("local").setProperty("/sCurrentSpotId", "");
                this.onButtonClosePress();
            },

            onMapWithPOIRouteMatched: function (oEvent) {
                let sCurrentSpotId = oEvent.getParameter("arguments").idPOI;
                this.getModel("local").setProperty("/sCurrentSpotId", sCurrentSpotId);

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
                this.byId("bottomSheet").setVisible(true);

                const bottomSheet =
                    document.querySelector(".bottom-sheet");

                bottomSheet.style.display = "block";
                document.body.style.overflow = "hidden";
                bottomSheet.style.bottom = "0";

                // if (this.getRouter().getHashChanger().hash.includes("tour")) {
                //     return;
                // }
                // const oSpot = oEvent.getSource();
                // const aCords = oSpot.getPosition().split(";");
                // const nCurrentZoomLevel = this.getModel("app").getProperty("/zoomlevel")
                // const nNewZoomLevel = nCurrentZoomLevel <= this.nZoomLevelClickThreshold ? this.nZoomLevelClickThreshold + 3 : nCurrentZoomLevel;
                // this._oMap.zoomToGeoPosition(aCords[0], aCords[1], nNewZoomLevel);

                // const oSplitter = this.byId("idSplitter");
                // if (!oSplitter) return;
                // debugger
                // if (oSplitter.getContentAreas().length > 1) {
                //     // if more than 1 exists, the info card is open and can be recreated
                //     // this also resets the location of the splitter
                //     const oLastContentArea = oSplitter.getContentAreas().pop();
                //     oSplitter.removeContentArea(oLastContentArea);
                //     oLastContentArea.destroy();
                //     this._pSPOIInforCard = null;
                //     setTimeout(() => this.onSpotClick(oEvent), 0);
                //     return;
                // }

                // let oView = this.getView();
                // if (!this._pSPOIInforCard) {
                //     this._pSPOIInforCard = Fragment.load({
                //         id: oView.getId(),
                //         name: "hwb.frontendhwb.fragment.POIInfoCard",
                //         controller: this
                //     }).then(function (oDialog) {
                //         oView.addDependent(oDialog);
                //         return oDialog;
                //     });
                // }

                // let localModel = this.getModel("local");
                // const oPoiObject = oSpot.getBindingContext().getObject();
                // let sCurrentSpotId = oPoiObject.ID;
                // localModel.setProperty("/sCurrentSpotId", sCurrentSpotId);
                // localModel.setProperty("/title", oPoiObject.name);
                // localModel.setProperty("/description", oPoiObject.description);
                // localModel.setProperty("/bStampingVisible", !!oPoiObject.number);
                // localModel.setProperty("/bStampingEnabled", !oPoiObject.hasVisited);
                // localModel.setProperty("/sSelectedSpotLocation", `${oPoiObject.longitude};${oPoiObject.latitude}`);
                // localModel.setProperty("/oCurrentSpot", this._getPoiById(sCurrentSpotId));

                // this._loadRelevantTravelTimesForPoi(sCurrentSpotId, localModel);

                // if (!bSuppressNavigation) {
                //     this.getRouter().navTo("MapWithPOI", { idPOI: sCurrentSpotId });
                // }

                // this._pSPOIInforCard.then(oInfoCard => {
                //     oInfoCard.setModel("local", localModel);
                //     oSplitter.addContentArea(oInfoCard);
                //     //oSplitter.resetContentAreasSizes();
                // });
            },

            _loadRelevantTravelTimesForPoi: function (sCurrentSpotId, localModel) {
                // Define the filters for the read request
                let aFilters = [
                    new sap.ui.model.Filter("fromPoi", sap.ui.model.FilterOperator.EQ, sCurrentSpotId),
                    new sap.ui.model.Filter("travelMode", sap.ui.model.FilterOperator.EQ, "walk"),
                    new sap.ui.model.Filter("distanceMeters", sap.ui.model.FilterOperator.LT, 10000)
                ];

                // Define the sorter for ordering by distanceMeters in ascending order
                let aSorters = [
                    new sap.ui.model.Sorter("distanceMeters", false) // `false` means ascending order
                ];

                // Execute the read request with filters, sorters, and $top to limit to 5 results
                this.getModel().read("/TravelTimes", {
                    filters: aFilters,
                    sorters: aSorters,
                    urlParameters: {
                        "$top": 5 // Limit to top 5 results
                    },
                    success: function (oData) {
                        let oLocalModel = this.getModel("local");
                        if (oData && oData.results) {
                            oLocalModel.setProperty("/TravelTimes", oData.results);
                        } else {
                            oLocalModel.setProperty("/TravelTimes", []);
                        }

                        // Get the list control
                        let oList = this.byId("idTravelTimesList");

                        // Remove all current items before adding the new ones
                        oList?.removeAllItems();

                        // Add items to the list manually using the addItem method
                        oData.results.forEach(oItemData => {
                            let oListItem = new sap.m.StandardListItem({
                                title: this._getPoiById(oItemData.toPoi)?.name || "",
                                description: `${this.formatMetersToKilometers(oItemData.distanceMeters)} - ${this.formatSecondsToTime(oItemData.durationSeconds)}`,
                                icon: "sap-icon://task",
                                type: "Navigation",
                                press: this.onNearbyPress.bind(this)
                            });

                            // Adding Custom Data
                            oListItem.addCustomData(new sap.ui.core.CustomData({
                                key: "poiId",
                                value: oItemData.toPoi
                            }));

                            oList?.addItem(oListItem);
                        });
                    }.bind(this),
                    error: function (oError) {
                        // Handle error - log or display an error message
                        console.error("Error loading travel times:", oError);
                    }
                });
            },

            onButtonOpenExternalPress: function (oEvent) {
                let localModel = this.getModel("local");
                let oStamp = this._getPoiById(localModel.getProperty("/sCurrentSpotId"));
                const sLink = `https://www.harzer-wandernadel.de/?s=${oStamp.name}`;
                window.open(sLink, '_blank').focus();
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
                const oModel = this.getModel(),
                    localModel = this.getModel("local");
                let ID = localModel.getProperty("/sCurrentSpotId");
                let mParameters = {
                    success: () => {
                        oEvent.getSource().setIcon("sap-icon://checklist-item-2");
                        oEvent.getSource().setEnabled(false);
                        MessageToast.show(this.getText("savedStamping"));
                        this.applyGroupFilter();
                    },
                    error: () => MessageToast.show(this.getText("error"))
                }
                oModel.create("/Stampings", {
                    "stamp": {
                        ID
                    }
                }, mParameters);
            },

            onNavigateWithGoogleMaps: function () {
                const sLocation = this.getModel("local").getProperty("/sSelectedSpotLocation");
                const lat = sLocation.split(";")[1];
                const long = sLocation.split(";")[0];
                window.open(`https://maps.google.com/maps?daddr=${lat},${long}&amp;ll=`);
            },

            onNavigateWithNative: function () {
                const sLocation = this.getModel("local").getProperty("/sSelectedSpotLocation");
                const lat = sLocation.split(";")[1];
                const long = sLocation.split(";")[0];
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

                const url = isIOS
                    ? `maps://maps.apple.com/?daddr=${lat},${long}`
                    : `geo:${lat},${long}?q=${lat},${long}`;

                window.open(url, '_self');
            },

            onButtonClosePress: function (oEvent) {
                this.getRouter().navTo("Map");
                this.byId("bottomSheet").setVisible(false);
                // const oSplitter = this.byId("idSplitter");
                // var aContentAreas = oSplitter.getContentAreas()
                // if (aContentAreas.length > 1) {

                //     var oLastContentArea = aContentAreas.pop();
                //     oSplitter.removeContentArea(oLastContentArea);
                //     oLastContentArea.destroy();
                //     this._pSPOIInforCard = null;
                //     oSplitter.resetContentAreasSizes();
                // }
            },

            onNearbyPress: function (oEvent) {
                const idPOI = oEvent.getSource().data().poiId;
                this.getRouter().navTo("MapWithPOI", { idPOI });
            },

            onGeoMapCenterChanged: function (oEvent) {
                //set last center position in local storage
                sessionStorage.setItem("lastCenterPosition", oEvent.getParameter("centerPoint"));
            },

            onOpenGroupManagement: function (oEvent) {
                this.oMyAvatar = this.byId("idCurrentUserAvatarMapInner--idMyAvatar");
                this._oPopover.openBy(this.oMyAvatar ?? oEvent.getSource());
            }
        });
    });