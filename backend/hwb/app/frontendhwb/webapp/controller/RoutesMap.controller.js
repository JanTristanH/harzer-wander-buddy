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
                this.bus.subscribe("idRoutesWayPointList", "onListSelect", this.onListSelect, this);
            },

            onSplitterRoutesDetailResize: function (oEvent) {
                let nNewSize = oEvent.getParameters().newSizes[1] - 200;
                this.getModel("local").setProperty("/wayPointScrollContainerHeight", nNewSize + "px");
            },

            onBackToList: function () {
                this.bus.publish("flexible", "setList")
            },

            onListSelect:function (params) {
                
            },

            onFormatTravelModeIcon: function (sTravelMode) {
                if (sTravelMode == "start"){
                    return "sap-icon://functional-location";
                } else if (sTravelMode == "drive") {
                    return "sap-icon://car-rental";
                }
                return "sap-icon://physical-activity"
                
            },

            formatDescription: function(duration, distance) {
                if (duration === 0 && distance === 0) {
                    return "";  // No description if both are 0
                }
                var formattedDuration = this.formatSecondsToTime(duration);
                var formattedDistance = this.formatMetersToKilometers(distance);
                return formattedDuration + " - " + formattedDistance + " - 0 HM";
            },

            onButtonShareTourPress: function(oEvent) {
                navigator
                .share({
                    title: document.title,
                    text: 'Harzer Wander Buddy',
                    url: window.location.href
                })
            },

            onButtonEditPress: function() {
                const oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/edit", true);
                this.getRouter().navTo("RoutesDetailEdit", {
                    idListTravelTimes: oLocalModel.getProperty("/sIdListTravelTimes")
                });
            },
            onButtonSavePress: function() {
                const oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/edit", false);
                this.getRouter().navTo("RoutesDetailEdit", {
                    idListTravelTimes: oLocalModel.getProperty("/sIdListTravelTimes")
                });
            }
        });
    });