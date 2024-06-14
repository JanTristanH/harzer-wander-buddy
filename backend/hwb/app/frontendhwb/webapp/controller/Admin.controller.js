sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
], function(
	Controller
) {
	"use strict";

	return Controller.extend("hwb.frontendhwb.controller.Admin", {

        onAfterRendering: function () {
            let oButton = this.getView().byId("idRoutePlanenAdminButton");
            oButton ? oButton.setType("Emphasized") : null;
        },

        onFormatTypeByName: function (name) {
            if(name.includes("Stempelstelle")){
                return "Success";
            }
            return "Default";
        },

        onNumberSpotClick: function (oEvent) {
            debugger
            alert("HI");
        },

        onGeoMapContextMenu: function(oEvent){
            debugger
            alert("Right click at: " + oEvent.getParameter("pos"));
        }
	});
});