sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent"
  ], function(Controller, History, UIComponent) {
  
    "use strict";
    return Controller.extend("hwb.frontendhwb.controller.BaseController", {
  
        getRouter : function () {
            return UIComponent.getRouterFor(this);
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

        onNavToMap: function() {
            
            this.getRouter().navTo("Map");
        },
        onNavToRouting: function () {
            this.getRouter().navTo("Routes");
        },
        onNavToList: function (params) {
            this.getRouter().navTo("Main");
        },

        onButtonAdminMapPress: function(){
            this.getRouter().navTo("Admin");
        }
  
    });
  });