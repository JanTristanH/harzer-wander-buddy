sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/ui/unified/Menu",
    "sap/ui/unified/MenuItem",
    "sap/ui/vbm/Spot"
], function (Controller,
    Fragment,
    MessageToast,
    Menu,
    MenuItem,
    Spot) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.Admin", {

        onAfterRendering: function () {
            let oButton = this.getView().byId("idRoutePlanenAdminButton");
            oButton ? oButton.setType("Emphasized") : null;
            this.getView().getModel().setSizeLimit(1000);
        },

        onFormatTypeByName: function (name) {
            if (name.includes("Stempelstelle")) {
                return "Success";
            }
            return "Default";
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

            this._pSpotDialog.then(function (oDialog) {
                oDialog.open(oDialog);
            });
        },

        onCloselButtonSpotActionPress: function () {
            this._pSpotDialog.then(d => d.close());
        },

        onGeoMapContextMenu: function (evt) {
            let oAnchorSpot = sap.ui.getCore().byId("idTemporarySpot");
            debugger
            if (!oAnchorSpot) {
                oAnchorSpot = new Spot({
                    id: "idTemporarySpot",
                    click: this.onNumberSpotClick.bind(this),
                    labelText: "temporärer Spot"
                });
                this.getView().byId("idAllPointsOfInterestsSpots").addItem(oAnchorSpot);
            }
            oAnchorSpot.setPosition(evt.getParameter("pos"));

        },

        onDeleteButtonPress: function () {
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
                MessageToast.show(sMessage + oData.DeleteSpotWithRoutes)
                this.getView().setBusy(false);
                debugger
                this.getModel().refresh();
            }.bind(this);
        },

        showError: function (oError) {
            this.getView().setBusy(false);
            MessageToast.show(JSON.stringify(oError));
        }
    });
});