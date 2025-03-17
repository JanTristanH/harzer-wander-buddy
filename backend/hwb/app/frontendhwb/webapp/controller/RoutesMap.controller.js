sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
    "sap/m/ColumnListItem",
    "sap/m/MessageToast",
    "sap/f/AvatarGroupItem",
    "sap/ui/unified/Menu",
    "sap/ui/unified/MenuItem",
    "sap/ui/core/Popup",
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, ColumnListItem, MessageToast, AvatarGroupItem, Menu, MenuItem, Popup,) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.RoutesMap", {
            bPersistedDisplayed: true,
            onInit: function () {
                this.getRouter().getRoute("RoutesDetailTransient").attachPatternMatched(this.onRoutesDetailTransientRouteMatched, this);
                this.getRouter().getRoute("RoutesDetail").attachPatternMatched(this.onRoutesDetailMatched, this);
                this.getRouter().getRoute("RoutesDetailEdit").attachPatternMatched(this.onRoutesDetailEditMatched, this);
                this.bus = this.getOwnerComponent().getEventBus();
                this.bus.subscribe("idRoutesWayPointList", "onListSelect", this.onListSelect, this);
            },

            onSearchFieldSearch: function(oEvent) {
                const oPoi = this._getPoiById(oEvent.getParameter("suggestionItem").getKey());
                this._getMap().zoomToGeoPosition(oPoi.longitude, oPoi.latitude, this.nZoomLevelLabelThreshold);
            },

            onSpotClick: function(oEvent) {
                if (this.getModel("app").getProperty("/edit")) {
                    var oMenu = new Menu();
                    oMenu.addItem(
                        new MenuItem({
                            text: this.getModel("i18n").getProperty("addToEndOfTour"),
                            select: function (oMenuEvent) {
                                debugger
                                this.onAddToEndOfTour(oEvent.getSource().data().id);
                            }.bind(this)
                        })
                    );

                    //TODO this works on mobile but not on desktop
                    oMenu.open(false, oEvent.getSource(), Popup.Dock.CenterCenter, Popup.Dock.CenterCenter);
                }
            },

            onSpotContextMenu: function (oEvent) {
                if (this.getModel("app").getProperty("/edit")) {
                    if (oEvent.getParameter("menu")) {
                        var oMenu = oEvent.getParameter("menu");
                        if (oMenu.getItems().length == 0) {
                            oMenu.addItem(
                                new MenuItem({
                                    text: this.getModel("i18n").getProperty("addToEndOfTour"),
                                    select: function (oMenuEvent) {
                                        this.onAddToEndOfTour(oEvent.getSource().data().id);
                                    }.bind(this)
                                })
                            );
                        }
                        oEvent.getSource().openContextMenu(oMenu);
                    }
                }
            },

            onAddToEndOfTour: function (sId) {
                const path = this.getModel("local").getProperty("/oSelectedTour/path");
                
                const oNewPathEntry = {
                    rank: path[path.length - 1]?.rank / 2 || 1024,
                    ID: Math.floor(Math.random() * 1024) + 1,
                    toPoi: sId,
                    name: this._getPoiById(sId).name
                };
                path.push(oNewPathEntry);

                this.getModel("local").setProperty("/oSelectedTour/path", path );
                this._persistTourCopy(sId);
            },

            _getMap() {
                return this.byId("midView--RoutesMapId--map");
            },

            onRoutesDetailMatched: function () {
                this.bPersistedDisplayed = true;
            },

            onRoutesDetailTransientRouteMatched: function (oEvent) {
                this.bPersistedDisplayed = false;
                this.TourId = oEvent.getParameter("arguments").TourId;
            },

            onSplitterRoutesDetailResize: function (oEvent) {
                let nNewSize = oEvent.getParameters().newSizes[1] - 225;
                this.getModel("local").setProperty("/wayPointScrollContainerHeight", nNewSize + "px");
            },

            onBackToList: function () {
                this.getRouter().navTo("Routes");
            },

            onListSelect: function (params) {

            },

            onFormatTravelModeIcon: function (sTravelMode) {
                if (sTravelMode == "start") {
                    return "sap-icon://functional-location";
                } else if (sTravelMode == "drive") {
                    return "sap-icon://car-rental";
                }
                return "sap-icon://physical-activity"

            },

            formatDescription: function (duration, distance) {
                if (duration === 0 && distance === 0) {
                    return "";  // No description if both are 0
                }
                var formattedDuration = this.formatSecondsToTime(duration);
                var formattedDistance = this.formatMetersToKilometers(distance);
                return formattedDuration + " - " + formattedDistance; 
            },

            formatElevationDescription: function (elevationGain, elevationLoss) {
                return `↑ ${this.formatCleanMeter(elevationGain)} - ↓ ${this.formatCleanMeter(elevationLoss)}`;
            },

            onButtonShareTourPress: function (oEvent) {
                navigator
                    .share({
                        title: document.title,
                        text: 'Harzer Wanderbuddy',
                        url: window.location.href
                    })
            },

            onButtonEditPress: function () {
                var oModel = this.getModel();
                const oLocalModel = this.getView().getModel("local");

                let TourId = this.TourId || this.getRouter().getRouteInfoByHash(this.getRouter().getHashChanger().getHash()).arguments.TourId;
                if (this.bPersistedDisplayed && TourId) {
                    this.getRouter().navTo("RoutesDetailEdit", {
                        TourId
                    });
                } else {
                    // Prepare the payload
                    var oPayload = {
                        "name": "Neue Tour",
                        "idListTravelTimes": oLocalModel.getProperty("/sIdListTravelTimes"),
                        // TODO those will be calculated by backend
                        "duration": oLocalModel.getProperty("/oSelectedTour/duration"),
                        "distance": oLocalModel.getProperty("/oSelectedTour/distance"),
                        "stampCount": oLocalModel.getProperty("/oSelectedTour/stampCount")
                    };

                    // Call function
                    oModel.create("/Tours", oPayload, {
                        success: function (oData, response) {
                            oLocalModel.setProperty(`/Tours(${oData.ID})`, oData);
                            MessageToast.show(this.getText("tourSaved"));

                            this.getRouter().navTo("RoutesDetailEdit", {
                                TourId: oData.ID
                            });
                            location.reload();

                        }.bind(this),
                        error: function (oError) {
                            MessageToast.show(this.getText("error"));
                            console.error(oError);
                        }
                    });
                }
            },

            onButtonSavePress: function () {
                const oLocalModel = this.getView().getModel("local");
                this.getRouter().navTo("RoutesDetail", {
                    TourId: oLocalModel.getProperty("/sIdListTravelTimes")
                });
            },

            onDropSelectedProductsTable: function (oEvent) {
                let ranking = {
                    Initial: 0,
                    Default: 1024,
                    Before: function (iRank) {
                        return iRank + 1024;
                    },
                    Between: function (iRank1, iRank2) {
                        // limited to 53 rows
                        return (iRank1 + iRank2) / 2;
                    },
                    After: function (iRank) {
                        return iRank / 2;
                    }
                };

                var oDraggedItem = oEvent.getParameter("draggedControl");
                var oRanking = ranking;
                var iNewRank = oRanking.Default;
                var oDroppedItem = oEvent.getParameter("droppedControl");

                if (oDroppedItem instanceof ColumnListItem) {
                    // get the dropped row data
                    var sDropPosition = oEvent.getParameter("dropPosition");
                    var iDroppedItemRank = parseInt(oDroppedItem.getCells()[0].getText());
                    var oDroppedTable = oDroppedItem.getParent();
                    var iDroppedItemIndex = oDroppedTable.indexOfItem(oDroppedItem);

                    // find the new index of the dragged row depending on the drop position
                    var iNewItemIndex = iDroppedItemIndex + (sDropPosition === "After" ? 1 : -1);
                    var oNewItem = oDroppedTable.getItems()[iNewItemIndex];
                    if (!oNewItem) {
                        // dropped before the first row or after the last row

                        iNewRank = oRanking[sDropPosition](iDroppedItemRank);
                    } else {
                        // dropped between first and the last row
                        let iOtherRank = parseInt(oNewItem.getCells()[0].getText());
                        iNewRank = oRanking.Between(iDroppedItemRank, iOtherRank);
                    }
                }
                // set the rank property and update the model to refresh the bindings
                const oLocalModel = this.getModel("local");
                let sId = oDraggedItem.getCells()[1].getText();
                let aUpdatedRoutes = oLocalModel.getProperty('/oSelectedTour/path').map(r => {
                    if (r.ID == sId) {
                        r.rank = iNewRank;
                    }
                    return r;
                })
                oLocalModel.setProperty(`/oSelectedTour/path`, aUpdatedRoutes);

                // Reapply the sorter to trigger refresh of the table
                const oTable = this.byId("idEditRouteTable");
                const oBinding = oTable.getBinding("items");
                const oSorter = new sap.ui.model.Sorter({
                    path: "rank",
                    descending: true
                });
                oBinding.sort(oSorter);
                this._persistTour(oTable);
            },

            _persistTour: function (oTable) {
                const sNameBefore = this.getModel("local").getProperty("/oSelectedTour/name");
                let aRoutesSortedByRank = this.getModel("local").getProperty("/oSelectedTour/path")
                    .filter(r => !!r.ID)
                    .sort((a, b) => {
                        return b.rank - a.rank;  // This will sort in descending order
                    });
                if (aRoutesSortedByRank.length > 1) {

                    // create sensible POI list
                    let aResultListPois = [];
                    aResultListPois.push(aRoutesSortedByRank[0].fromPoi);
                    aRoutesSortedByRank.forEach(r => {
                        aResultListPois.push(r.toPoi);
                    });
                    // send list to backend and refresh
                    aRoutesSortedByRank = aRoutesSortedByRank.map(r => r.toPoi);
                    const sPOIList = aRoutesSortedByRank.filter(p => !!p).join(";");
                    if (!sPOIList.includes(";")) {
                        // only one POI in list, no calculation needed
                        return;
                    }
                    const sTourID = this.getModel("local").getProperty("/oSelectedTour/ID");
                    this.getModel().callFunction("/updateTourByPOIList", {
                        method: "POST",
                        urlParameters: {
                            POIList: sPOIList,
                            TourID: sTourID
                        },
                        success: function (oData, response) {
                            // Handle the successful response here
                            MessageToast.show(this.getText("tourSaved"));
                            const oLocalModel = this.getModel("local");
                            let oTour = oData.updateTourByPOIList;
                            oTour.name = sNameBefore;
                            oLocalModel.setProperty("/oSelectedTour", oTour);
                            this.loadTourTravelTime(sTourID, function (travelTimeData) {
                                oLocalModel.setProperty(`/oSelectedTour/path`, this._mapTravelTimeToPOIList(travelTimeData));
                            }.bind(this));                            
                        }.bind(this),
                        error: function (oError) {
                            // Handle errors here
                            MessageToast.show(this.getText("error"));
                            console.error(oError);
                        }
                    });
                } else {
                    console.info("no calculation needed");
                }
            },

            onNameInputChange: function (oEvent) {
                let sNewName = oEvent.getSource().getValue();
                let oSelectedTour = this.getModel("local").getProperty("/oSelectedTour");

                let sPath = "/Tours(guid'" + oSelectedTour.ID + "')";
                let oData = {
                    name: sNewName
                };
                this.getModel().update(sPath, oData, {
                    success: function () {
                        this.getModel("local").getProperty("/oSelectedTour/name", sNewName);
                        MessageToast.show(this.getText("saved"));
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show(this.getText("error"));
                    }.bind(this)
                });
            },

            onButtonDeletePress: function () {
                const sIDTourToDelete = this.getModel("local").getProperty("/oSelectedTour").ID;
                this.getModel().remove(`/Tours(guid'${sIDTourToDelete}')`, {
                    success: function () {
                        MessageToast.show(this.getText("tourDeletedSuccessfully"));
                        this.getRouter().navTo("Routes");
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show(this.getText("error"));
                        console.error(oError);
                    }.bind(this)
                });

            },

            onAddWayPointButtonPress: function (oEvent) {
                let aRoutes = this.getModel("local").getProperty("/oSelectedTour/path");
                let rank = aRoutes[aRoutes.length - 1]?.rank / 2 || 1024
                aRoutes.push({ rank, ID: Math.floor(Math.random() * 1024) + 1 });
                this.getModel("local").setProperty("/oSelectedTour/path", aRoutes)
            },

            onDeleteWayPointButtonPress: function (oEvent) {
                let aRoutes = this.getModel("local").getProperty("/oSelectedTour/path");
                const oSource = oEvent.getSource();
                let idToRemove = oSource.getParent().getCells()[1].getText();
                aRoutes = aRoutes.filter(r => r.ID !== idToRemove);
                this.getModel("local").setProperty("/oSelectedTour/path", aRoutes)
                this._persistTour(this.byId("idEditRouteTable"));
            },

            onSuggestionItemSelected: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                let aRoutes = this.getModel("local").getProperty("/oSelectedTour/path");
                var sChangedRouteId = oEvent.getSource().getParent().getCells()[1].getText();

                if (oSelectedItem) {
                    var aCustomData = oSelectedItem.getCustomData();

                    // Loop through custom data to find the one with key 'ID'
                    aCustomData.forEach(function (oCustomData) {
                        if (oCustomData.getKey() === "ID") {
                            var sID = oCustomData.getValue();

                            aRoutes = aRoutes.map(r => {
                                if (r.ID == sChangedRouteId) {
                                    r.toPoi = sID;
                                }
                                return r;
                            })
                        }
                    });

                    this.getModel("local").setProperty("/oSelectedTour/path", aRoutes)
                    this._persistTour(this.byId("idEditRouteTable"));
                }
            },

            onUpButtonPress: function (oEvent) {
                this._moveItem(oEvent, -1);
            },

            onDownButtonPress: function (oEvent) {
                this._moveItem(oEvent, 1);
            },

            _moveItem: function (oEvent, direction) {
                let oItemPressed = oEvent.getSource().getParent();
                oItemPressed.rank = oItemPressed.getCells()[0].getText();
                oItemPressed.ID = oItemPressed.getCells()[1].getText();
                const oTable = this.byId("idEditRouteTable");
                let aItems = oTable.getItems();
                let oSwitchingItem = this._getSwitchingItem(aItems, oItemPressed, direction);

                if (!oSwitchingItem) {
                    return;
                }

                oSwitchingItem.rank = oSwitchingItem.getCells()[0].getText();
                oSwitchingItem.ID = oSwitchingItem.getCells()[1].getText();

                // Swap ranks
                this._swapRanks(oItemPressed, oSwitchingItem);

                // Update the model with the new ranks
                this._updateModel(oItemPressed, oSwitchingItem);

                // Reapply the sorter to trigger refresh of the table
                this._refreshTable(oTable);
            },

            _getSwitchingItem: function (aItems, oItemPressed, direction) {
                const currentIndex = aItems.findIndex(item => item.rank == oItemPressed.rank);
                const targetIndex = currentIndex + direction;

                if (targetIndex >= 0 && targetIndex < aItems.length) {
                    return aItems[targetIndex];
                }
                return null;
            },

            _swapRanks: function (oItem1, oItem2) {
                let tempRank = oItem1.rank;
                oItem1.rank = oItem2.rank;
                oItem2.rank = tempRank;
            },

            _updateModel: function (oItem1, oItem2) {
                const oLocalModel = this.getModel("local");
                let aUpdatedRoutes = oLocalModel.getProperty('/oSelectedTour/path').map(r => {
                    if (r.ID === oItem1.ID) {
                        r.rank = oItem1.rank;
                    }
                    if (r.ID === oItem2.ID) {
                        r.rank = oItem2.rank;
                    }
                    return r;
                });
                oLocalModel.setProperty(`/oSelectedTour/path`, aUpdatedRoutes);
            },

            _refreshTable: function (oTable) {
                const oBinding = oTable.getBinding("items");
                const oSorter = new sap.ui.model.Sorter({
                    path: "rank",
                    descending: true
                });
                oBinding.sort(oSorter);
                this._persistTour(oTable);
            },

            onWaypointListSelectionChange: function (oEvent) {
                let sClickedPath = oEvent.getSource().getSelectedContextPaths()[0];
                let oItem = this.getModel("local").getProperty(sClickedPath);
                let oPoi = this._getPoiById(oItem.toPoi || oItem.fromPoi 
                    || oItem.poi // calculated routes
                );
                this._getMap().setCenterPosition(`${oPoi.longitude};${oPoi.latitude}`);
            },

            formatStampButtonIcon: function (sID) {
                let hasVisited = this.getModel().getProperty(`/Stampboxes(guid'${sID}')/hasVisited`);
                if (hasVisited) {
                    return "sap-icon://checklist-item-2";
                } else {
                    return "sap-icon://checklist-item";
                }
            },
            formatStampButtonEnabled: function (sID) {
                return !this.getModel().getProperty(`/Stampboxes(guid'${sID}')/hasVisited`);
            },

            formatStampButtonVisible: function (sID) {
                return !!this.getModel().getProperty(`/Stampboxes(guid'${sID}')`);
            },

            onStampGroupPress: function (oEvent) {
                const ID = oEvent.getSource().getCustomData()[0].getValue();
                this.getModel("local").setProperty("/sCurrentSpotId", ID);
                Controller.prototype.onStampGroupPress.apply(this, arguments);
            },

            onButtonStampPress: function (oEvent) {
                let oModel = this.getModel();
                let ID = oEvent.getSource().getCustomData()[0].getValue();
                let mParameters = {
                    success: () => {
                        oEvent.getSource().setIcon("sap-icon://checklist-item-2");
                        oEvent.getSource().setEnabled(false);
                        MessageToast.show(this.getText("savedStamping"));
                        oModel.refresh();
                    },
                    // give message and reset ui to keep it consistent with backend
                    error: () => MessageToast.show(this.getText("error"))
                }
                oModel.create("/Stampings", {
                    "stamp": {
                        ID
                    }
                }, mParameters);

            },

            onNavigateWithGoogleMaps: function (oEvent) {
                const poi = this._getPoiById(oEvent.getSource().getCustomData()[0].getValue());
                window.open(`https://maps.google.com/maps?daddr=${poi.latitude},${poi.longitude}&amp;ll=`);
            },

            onNavigateWithNative: function (oEvent) {
                const poi = this._getPoiById(oEvent.getSource().getCustomData()[0].getValue());
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

                const url = isIOS
                    ? `maps://maps.apple.com/?daddr=${poi.latitude},${poi.longitude}`
                    : `geo:${poi.latitude},${poi.longitude}?q=${poi.latitude},${poi.longitude}`;
            
                window.open(url, '_self');
            },            

            formatAvatarGroupItems: function (aUsers) {
                if (!aUsers || !Array.isArray(aUsers)) {
                    return [];
                }
            
                return aUsers.map(user => {
                    return new AvatarGroupItem({
                        initials: this.onFormatInitialsByName(user.name),
                        fallbackIcon: "sap-icon://person-placeholder",
                        src: user.picture || "",
                        tooltip: user.name || "Unknown"
                    });
                });
            },

            _persistTourCopy: function (sId) {
                const sNameBefore = this.getModel("local").getProperty("/oSelectedTour/name");
                let aRoutesSortedByRank = this.getModel("local").getProperty("/oSelectedTour/path")
                    .filter(r => !!r.ID)
                    .sort((a, b) => {
                        return b.rank - a.rank;  // This will sort in descending order
                    });
                if (aRoutesSortedByRank.length > 0) {

                    // create sensible POI list
                    let aResultListPois = [];
                    aResultListPois.push(aRoutesSortedByRank[0].fromPoi);
                    aRoutesSortedByRank.forEach(r => {
                        aResultListPois.push(r.toPoi);
                    });


                    // send list to backend and refresh
                    aRoutesSortedByRank = aRoutesSortedByRank.map(r => r.toPoi);
                    // ADD NEW POI
                    if(sId) {
                        aRoutesSortedByRank.push(sId);
                    }
                    // END CHANGE
                    const sPOIList = aRoutesSortedByRank.filter(p => !!p).join(";");
                    if (!sPOIList.includes(";")) {
                        // only one POI in list, no calculation needed
                        return;
                    }
                    const sTourID = this.getModel("local").getProperty("/oSelectedTour/ID");
                    this.getModel().callFunction("/updateTourByPOIList", {
                        method: "POST",
                        urlParameters: {
                            POIList: sPOIList,
                            TourID: sTourID
                        },
                        success: function (oData, response) {
                            // Handle the successful response here
                            MessageToast.show(this.getText("tourSaved"));
                            const oLocalModel = this.getModel("local");
                            let oTour = oData.updateTourByPOIList;
                            oTour.name = sNameBefore;
                            oLocalModel.setProperty("/oSelectedTour", oTour);
                            this.loadTourTravelTime(sTourID, function (travelTimeData) {
                                oLocalModel.setProperty(`/oSelectedTour/path`, this._mapTravelTimeToPOIList(travelTimeData));
                            }.bind(this));
                        }.bind(this),
                        error: function (oError) {
                            // Handle errors here
                            MessageToast.show(this.getText("error"));
                            console.error(oError);
                        }
                    });
                } else {
                    console.info("no calculation needed");
                }
            },

        });
    });