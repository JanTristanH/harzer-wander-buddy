sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/ColumnListItem",
    "sap/m/MessageToast"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, ColumnListItem, MessageToast) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.RoutesMap", {
            bPersistedDisplayed: true,
            onInit: function () {
                this.getRouter().getRoute("RoutesDetailTransient").attachPatternMatched(this.onRoutesDetailTransientRouteMatched, this);
                this.getRouter().getRoute("RoutesDetail").attachPatternMatched(this.onRoutesDetailMatched, this);
                this.bus = this.getOwnerComponent().getEventBus();
                this.bus.subscribe("idRoutesWayPointList", "onListSelect", this.onListSelect, this);
            },

            onRoutesDetailMatched: function () {
                this.bPersistedDisplayed = true;
            },

            onRoutesDetailTransientRouteMatched: function (oEvent) {
                this.bPersistedDisplayed = false;
                this.TourId = oEvent.getParameter("arguments").TourId;
            },

            onSplitterRoutesDetailResize: function (oEvent) {
                let nNewSize = oEvent.getParameters().newSizes[1] - 250;
                this.getModel("local").setProperty("/wayPointScrollContainerHeight", nNewSize + "px");
            },

            onBackToList: function () {
                this.bus.publish("flexible", "setList")
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
                return formattedDuration + " - " + formattedDistance + " - 0 HM";
            },

            onButtonShareTourPress: function (oEvent) {
                navigator
                    .share({
                        title: document.title,
                        text: 'Harzer Wander Buddy',
                        url: window.location.href
                    })
            },

            onButtonEditPress: function () {
                var oModel = this.getModel();
                const oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/edit", true);

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
                        "duration": oLocalModel.getProperty("/duration"),
                        "distance": oLocalModel.getProperty("/distance"),
                        "stampCount": oLocalModel.getProperty("/stampCount")
                    };

                    // Call function
                    oModel.create("/Tours", oPayload, {
                        success: function (oData, response) {
                            oLocalModel.setProperty(`/Tours(${oData.ID})`, oData);
                            sap.m.MessageToast.show("Post successful!");

                            this.getRouter().navTo("RoutesDetailEdit", {
                                TourId: oData.ID
                            });

                        }.bind(this),
                        error: function (oError) {
                            sap.m.MessageToast.show("Error saving the tour!");
                            console.error(oError);
                        }
                    });
                }
            },
            onButtonSavePress: function () {
                const oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/edit", false);
                this.getRouter().navTo("RoutesDetailEdit", {
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
                let aUpdatedRoutes = oLocalModel.getProperty('/routes').map(r => {
                    if (r.ID == sId) {
                        r.rank = iNewRank;
                    }
                    return r;
                })
                oLocalModel.setProperty(`/routes`, aUpdatedRoutes);

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
                let aRoutesSortedByRank = this.getModel("local").getProperty("/routes").sort((a, b) => {
                    return b.rank - a.rank;  // This will sort in descending order
                });
                // create sensible POI list
                let aResultListPois = [];
                aResultListPois.push(aRoutesSortedByRank[0].fromPoi);
                aRoutesSortedByRank.forEach(r => {
                    aResultListPois.push(r.toPoi);
                });
                // send list to backend and refresh
                aRoutesSortedByRank = aRoutesSortedByRank.map(r => r.toPoi);
                const sPOIList = aRoutesSortedByRank.join(";");
                const sTourID = this.getModel("local").getProperty("/oSelectedTour/ID");
                this.getModel().callFunction("/updateTourByPOIList", {
                    method: "POST",
                    urlParameters: {
                        POIList: sPOIList,
                        TourID: sTourID
                    },
                    success: function(oData, response) {
                        // Handle the successful response here
                        MessageToast.show("POI List fetched successfully.");
                        console.log(oData);
                    },
                    error: function(oError) {
                        // Handle errors here
                        MessageToast.show("Error fetching POI List.");
                        console.error(oError);
                    }
                });
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
                        MessageToast.show(this.getText("saved"));
                    },
                    error: function (oError) {
                        MessageToast.show(this.getText("error"));
                    }
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
                    }
                });

            },

		onDeleteWayPointButtonPress: function(oEvent) {
			debugger
            let aRoutes = this.getModel("local").getProperty("/routes");
            const oSource = oEvent.getSource();
            let idToRemove = oSource.getParent().getCells()[1].getText();
            aRoutes = aRoutes.filter( r => r.ID !== idToRemove);
            this.getModel("local").setProperty("/routes", aRoutes)
            this._persistTour(this.byId("idEditRouteTable"));
		}
        });
    });