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
                
                // fetch without model as it does not provide error if not authorized
                fetch("/odata/v2/api/getCurrentUser", {
                    credentials: "include"
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Not authorized");
                    }
                    return response.json();
                })
                .then(data => {
                    this.getModel("app").setProperty("/currentUser", data);
                })
                .catch(err => {
                    console.error("Manual fetch failed:", err);
                    const sServerUrl =  this.getModel().sServiceUrl;
                    const loginUrl = sServerUrl.split("/odata/v2/api" )[0] + "/login";

                    window.location.href = loginUrl;

                });
                

                document.getElementById("busyIndicator").style.display = "none";
            }
        });
    }
);