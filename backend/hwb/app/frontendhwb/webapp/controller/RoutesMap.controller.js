sap.ui.define([
    "hwb/frontendhwb/controller/BaseController"
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.RoutesMap", {
            onInit: function () {
                this.bus = this.getOwnerComponent().getEventBus();
                this.bus.subscribe("list", "onListSelect", this.onListSelect, this);
            },

            onBackToList: function () {
                this.bus.publish("flexible", "setList")
            },

            onListSelect:function (params) {
                
            },

            onFormatTravelModeIcon: function (sTravelMode) {
                if (sTravelMode == "drive"){
                    return "sap-icon://car-rental";
                }
                return "sap-icon://physical-activity"
                
            },

		onButtonShareTourPress: function(oEvent) {
            navigator
            .share({
                title: document.title,
                text: 'Harzer Wander Buddy',
                url: window.location.href
            })
		}
        });
    });