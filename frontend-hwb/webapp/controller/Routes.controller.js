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

            onOpenRoutingDialog: async function () {
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

            onCancel: function () {
                this.pDialog.close();
            },

            onSubmitRouting: function () {
                var oModel = this.getView().getModel(); // Get the OData model
                var oDialogModel = this.pDialog.getModel();

                // Define the function import URL and parameters
                var sFunctionName = "/calculateHikingRoute";
                var oParams = {
                    maxDepth: oDialogModel.getProperty("/maxDepth"),
                    maxDuration: oDialogModel.getProperty("/maxDuration"),
                    maxDistance: oDialogModel.getProperty("/maxDistance"),
                    latitudeStart: oDialogModel.getProperty("/latitudeStart"),
                    longitudeStart: oDialogModel.getProperty("/longitudeStart"),
                    allowDriveInRoute: oDialogModel.getProperty("/allowDriveInRoute"),
                    minStampCount: oDialogModel.getProperty("/minStampCount")
                };
                // Call the function import
                oModel.callFunction(sFunctionName, {
                    method: "GET",
                    urlParameters: oParams,
                    success: function (oData, oResponse) {
                        sap.m.MessageToast.show("Route calculated successfully!");
                        // Additional success handling
                        let oLocalModel = new sap.ui.model.json.JSONModel({
                            hikingRoutes: oData.calculateHikingRoute.results
                        });
                        this.getView().setModel(oLocalModel, "local");
                        this.pDialog.close();
                        
                        this.getView().byId("idRouteList").setSelectedKey(0);
                        this.getView().byId("idRoutingMap").setInitialPosition(
                            oData.calculateHikingRoute.results[0].path[1].positionString.split(';0')[0]);

                            oLocalModel.setProperty("/routes", oData.calculateHikingRoute.results[0].path);
                    }.bind(this),
                    error: function (oError) {
                        sap.m.MessageToast.show("Failed to calculate route.");
                        // Additional error handling
                        this.pDialog.close();
                    }
                });
            },

            onSelectionChange: function (oEvent) {
                let oLocalModel = this.getView().getModel("local");
                let selectedRoute = oLocalModel.getProperty("/hikingRoutes")
                    .filter(r => r.id == oEvent.getParameter("selectedItem").getKey())[0];

                oLocalModel.setProperty("/routes", selectedRoute.path);

                this.getView().byId("idRoutingMap").setInitialPosition(
                    selectedRoute.path[1].positionString.split(';0')[0]);

            },

            onToggleList: function(){
                let bVisible = this.getView().byId("idRouteList").getVisible();
                this.getView().byId("idRouteList").setVisible(!bVisible);
            }



        });
    });