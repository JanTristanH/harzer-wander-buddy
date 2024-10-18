sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent"
], function (Controller, History, UIComponent) {

    "use strict";
    return Controller.extend("hwb.frontendhwb.controller.BaseController", {

        stringToBoolean: function (str) {
            return str === "true";
        },

        onButtonSharePress: function () {
            navigator
            .share({
                title: document.title,
                text: 'Harzer Wander Buddy',
                url: window.location.href
            })
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        getText: function(sKey) {
            return this.getModel("i18n").getResourceBundle().getText(sKey);
        },

        onNavBack: function () {
            var oHistory, sPreviousHash;
            oHistory = History.getInstance();
            sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("appHome", {}, true /*no history*/);
            }
        },

        onNavToMap: function () {
            this.getRouter().navTo("Map");
        },
        onNavToRouting: function () {
            this.getRouter().navTo("Routes");
        },
        onNavToList: function (params) {
            this.getRouter().navTo("Main");
        },

        onButtonAdminMapPress: function () {
            this.getRouter().navTo("Admin");
        },

        onFormatRouteLineDash: function (travelMode) {
            if (travelMode == "walk") {
                return "9;9"; //dotted line
            }
            return ""; //normal line
        },

        formatMetersToKilometers: function (iMeters) {
            if (!iMeters && iMeters !== 0) {
                return "";
            }

            var kilometers = iMeters / 1000;
            return kilometers.toFixed(2) + " km"; // Show 2 decimal places
        },

        formatSecondsToTime: function (iSeconds) {
            if (!iSeconds && iSeconds !== 0) {
                return "";
            }

            var hours = Math.floor(iSeconds / 3600);
            var minutes = Math.floor((iSeconds % 3600) / 60);
            var seconds = iSeconds % 60;

            var formattedTime = "";

            if (hours > 0) {
                formattedTime += hours + "h ";
            }

            if (minutes > 0 || hours > 0) { // Include minutes if there are hours
                formattedTime += minutes + "m ";
            }

            return formattedTime.trim(); // Remove any trailing whitespace
        },

    });
});