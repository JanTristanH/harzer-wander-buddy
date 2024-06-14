sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast"
], function (Controller,
	Fragment,
	MessageToast) {
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
            this.oSpot = oEvent.getSource();
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

        onGeoMapContextMenu: function (oEvent) {
            debugger
            alert("Right click at: " + oEvent.getParameter("pos"));
        },

        onDeleteButtonPress: function () {
            let oModel = this.getView().getModel();
            this.getView().setBusy(true);
            oModel.callFunction("/DeleteSpotWithRoutes", {
                method: "POST",
                urlParameters: {
                    SpotId : this.oSpot.getText()
                },
                success: this.showMessage("Spot sammt Routen gelöscht"),
                error: this.showError.bind(this)
            });
        },
        showMessage: function (sMessage) {
            return function() {
                MessageToast.show(sMessage)
                this.getView().setBusy(false);
            }.bind(this);
        },

        showError: function (oError) {
            this.getView().setBusy(false);
            MessageToast.show(JSON.stringify(oError));
        }
    });
});