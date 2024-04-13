sap.ui.define([
        "sap/ui/core/mvc/Controller"
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller) {
        "use strict";
        const unstampedType = "Error";

        return Controller.extend("hwb.frontendhwb.controller.Map", {
            itemCache: [],
            onInit: function () {

            },

            onOpenRoutingDialog: async function() {
                var oView = this.getView();
            
                // Create dialog lazily
                if (!this.pDialog) {
                    this.pDialog = await this.loadFragment({
                        name: "hwb.frontendhwb.fragment.HikingRouteDialog"
                    });
                
                    this.pDialog.open();
                    oView.addDependent(this.pDialog);
                }
            
                // Reset model or create new one if needed
                var oModel = new sap.ui.model.json.JSONModel({
                    maxDepth: 8,
                    maxDuration: 36000,
                    maxDistance: 15000,
                    latitudeStart: '51.780277',
                    longitudeStart: '11.002212',
                    allowDriveInRoute: false,
                    minStampCount: 1
                });
                this.pDialog.setModel(oModel);
            
                this.pDialog.open();
            },

            onCancel: function(){
                this.pDialog.close();
            },

            onSubmitRouting: function() {
                this.pDialog.close();
                return;
                var oModel = this.pDialog.getModel();
                var sUrl = "/odata/v2/api/calculateHikingRoute?";
                sUrl += "maxDepth=" + oModel.getProperty("/maxDepth");
                sUrl += "&maxDuration=" + oModel.getProperty("/maxDuration");
                // Add other parameters similarly
            
                // Fetch data
                jQuery.ajax({
                    url: sUrl,
                    success: function(oData) {
                        var oResultModel = new sap.ui.model.json.JSONModel(oData.d.calculateHikingRoute.results);
                        this.getView().setModel(oResultModel, "results");
                    }.bind(this),
                    error: function() {
                        sap.m.MessageToast.show("Error fetching route data.");
                    }
                });
            
                this.pDialog.close();
            }
            
            
        });
    });