sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/ui/vbm/Spot",
    "sap/m/MessageBox",
    'sap/ui/model/Filter', 'sap/ui/model/FilterOperator',
    "sap/ui/model/json/JSONModel",
	"sap/ui/comp/smartmultiedit/Container",
], function (Controller,
    Fragment,
    MessageToast,
    Spot,
    MessageBox,
    Filter, FilterOperator, JSONModel) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.Admin", {

        sCurrentSpotId: "",

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);

            this.getView().setModel(new JSONModel(), "local");
        },

        onAfterRendering: function () {
            let oButton = this.getView().byId("idRoutePlanenAdminButton");
            oButton ? oButton.setType("Emphasized") : null;
            this.getView().getModel().setSizeLimit(1000);
        },

        onFormatTypeByName: function (name) {
            if (this.isStampBoxByName(name)) {
                return "Success";
            }
            return "Default";
        },

        isStampBoxByName: function (name) {
            return name.includes("Stempelstelle");
        },

        onNumberSpotClick: function (oEvent) {
            this.sCurrentSpotId = oEvent.getSource().data("id");
            const oView = this.getView();

            // create popover
            if (!this._pSpotDialog) {
                this._pSpotDialog = Fragment.load({
                    id: oView.getId(),
                    name: "hwb.frontendhwb.fragment.admin.SpotDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pSpotDialog.then(oDialog => {
                this.byId("idCurrentIdLabel").setText("Id: " + this.sCurrentSpotId);
                let sSpotName = this.getModel().getProperty(`/AllPointsOfInterest(guid'${this.sCurrentSpotId}')/name`);
                this.byId("idNameInput").setValue(sSpotName ? sSpotName : "Parkplatz");
                let sDescription = this.getModel().getProperty(`/AllPointsOfInterest(guid'${this.sCurrentSpotId}')/description`);
                this.byId("idDescriptionInput").setValue(sDescription ? sDescription : "Parkplatz");
                oDialog.open(oDialog);
            });
        },

        onCloselButtonSpotActionPress: function () {
            this._pSpotDialog.then(d => d.close());
        },

        onShowRoutesButtonPress: function(){
            this.onSpotContextMenu(null, this.sCurrentSpotId);
        },

        onSpotContextMenu: function (oEvent, id) {
            const sSourceId = id ? id :  oEvent.getSource().data("id");
            this.getModel().read("/TravelTimes", {
                filters: [new Filter({
                    path: "fromPoi",
                    operator: FilterOperator.EQ,
                    value1: sSourceId
                })],
                success: function (oData) {
                    let oLocalModel = this.getView().getModel("local");
                    oLocalModel.setProperty("/oSelectedTour/path", oData.results);
                }.bind(this)
            })
        },

        onGeoMapContextMenu: function (evt) {
            let oAnchorSpot = sap.ui.getCore().byId("idTemporarySpot");
            if (!oAnchorSpot) {
                oAnchorSpot = new Spot({
                    id: "idTemporarySpot",
                    click: this.onNumberSpotClick.bind(this),
                    labelText: "temporärer Spot"
                });
                this.getView().byId("idAllPointsOfInterestsSpotsAdmin").addItem(oAnchorSpot);
            }
            oAnchorSpot.setPosition(evt.getParameter("pos"));

        },

        onDeleteButtonPress: function () {
            if (!this.sCurrentSpotId) {
                // move temporary spot out of sensible viewport
                sap.ui.getCore().byId("idTemporarySpot").setPosition("0;0;0");
                this.onCloselButtonSpotActionPress();
                return;
            }
            let oModel = this.getView().getModel();
            this.getView().setBusy(true);
            oModel.callFunction("/DeleteSpotWithRoutes", {
                method: "POST",
                urlParameters: {
                    SpotId: this.sCurrentSpotId
                },
                success: this.showMessage("Spot sammt Routen gelöscht: "),
                error: this.showError.bind(this)
            });
        },
        showMessage: function (sMessage) {
            return function (oData) {
                let extra = oData.DeleteSpotWithRoutes ? oData.DeleteSpotWithRoutes : "";
                MessageToast.show(sMessage + extra);
                this.getView().setBusy(false);
                this.getModel().refresh();
                this.onCloselButtonSpotActionPress();
            }.bind(this);
        },

        showError: function (oError) {
            this.getView().setBusy(false);
            MessageToast.show(JSON.stringify(oError));
        },

        onSaveButtonSpotActionPress: function () {
            if (!this.sCurrentSpotId) {
                this.saveTemporarySpot();
            } else {
                this.updateExisting();
            }
        },

        saveTemporarySpot: function () {
            const aCords = sap.ui.getCore().byId("idTemporarySpot").getPosition().split(";");

            const oData = {
                "longitude": aCords[0],
                "latitude": aCords[1],
                "name": this.byId("idNameInput").getValue(),
                "description": this.byId("idDescriptionInput").getValue()
            };
            this.getModel().create("/ParkingSpots", oData, {
                success: this.showMessage("Parkplatz angelgt!"),
                error: this.showError.bind(this)
            });
        },

        updateExisting: function () {
            const oPoi = this.getModel().getProperty(`/AllPointsOfInterest(guid'${this.sCurrentSpotId}')`);
            let sPath = this.isStampBoxByName(oPoi.name) ? "/Stampboxes" : "/ParkingSpots";
            sPath += `(guid'${this.sCurrentSpotId}')`;

            const oData = {
                "name": this.byId("idNameInput").getValue(),
                "description": this.byId("idDescriptionInput").getValue()
            };

            this.getModel().update(sPath, oData, {
                success: this.showMessage("Spot geupdated!"),
                error: this.showError.bind(this)
            });
        },
        onFormatPoiName: function (name) {
            if(name.includes("Stempelstelle")){
                return name.split(" ")[1];
            }
            return 'P';
        },

        onOpenExternalButtonPress: function() {
            let sName = this.getModel().getProperty(`/AllPointsOfInterest(guid'${this.sCurrentSpotId}')/name`)
            const sLink = `https://www.harzer-wandernadel.de/?s=${sName}`;
            window.open(sLink, '_blank').focus();
        },

        onCheckAllRoutesButtonPress: function () {
            const nearestNeighborsCount = 5;
            let oModel = this.getView().getModel();
            this.getView().setBusy(true);
            oModel.callFunction("/getMissingTravelTimesCount", {
                urlParameters: {
                    n: nearestNeighborsCount
                },
                success: function (oData) {
                    this.getView().setBusy(false);
                    MessageBox.confirm(`Es wurden ${oData.getMissingTravelTimesCount} fehlende Routen festgestellt.\n Erneut prüfen ${oData.getMissingTravelTimesCount} fehlende Routen hinzufügen? Es können Kosten anfallen.`, {
                        onClose: function (oEvent) {
                            if (oEvent == "OK") {
                                this.getView().setBusy(true);
                                oModel.callFunction("/calculateTravelTimesNNearestNeighbors", {
                                    urlParameters: {
                                        n: nearestNeighborsCount
                                    },
                                    success: function (oData) {
                                        this.getView().setBusy(false);
                                        MessageToast.show(`Es wurden ${oData.calculateTravelTimesNNearestNeighbors} Routen ergänzt.`)
                                    }.bind(this),
                                    error: this.showError.bind(this)
                                });
                            }
                        }.bind(this)
                    });

                }.bind(this),
                error: this.showError.bind(this)
            });

        }
    });
});