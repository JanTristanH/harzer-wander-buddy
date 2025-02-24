sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (
    Controller,
    MessageToast,
    Filter,
    FilterOperator,
    Fragment
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.Profile", {

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);
            this.getRouter().getRoute("Profile").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var sUserID = oEvent.getParameter("arguments").userId;
            this.getView().bindElement({ path: "/Users(guid'" + sUserID + "')" });
        },

        onNameChange: function (oEvent) {
            this.getModel().submitChanges( {
                success: function () {
                    MessageToast.show(this.getText("saved"));
                }.bind(this),
                error: function () {
                    MessageToast.show(this.getText("error"));
                }.bind(this)
            });
        }

    });
});