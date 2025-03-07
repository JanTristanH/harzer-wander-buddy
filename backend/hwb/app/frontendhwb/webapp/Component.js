sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "hwb/frontendhwb/model/models"
],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("hwb.frontendhwb.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");

                let oModel = this.getModel();
                oModel.setSizeLimit(1000);
                oModel.read("/Stampboxes", {
                    urlParameters: { "$top": 500 }
                });
                oModel.read("/ParkingSpots", {
                    urlParameters: { "$top": 500 }
                });

                oModel.callFunction("/getCurrentUser", {
                    method: "GET",
                    success: function(oData) {
                        this.getModel("app").setProperty("/currentUser", oData);
                    }.bind(this),
                    error: function(oError) {
                        // Handle error
                        console.error("Error getting current user:", oError);
                    }
                });

                document.getElementById("busyIndicator").style.display = "none";
            }
        });
    }
);