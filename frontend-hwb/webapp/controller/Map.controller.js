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

            onInit: function () {

            },
            onToggleLables: function () {
                this.getView().byId("spots").getItems().map(e => e.setProperty("labelText", ""))
                //TODO save labeltext to local set and make them displayable again
            },
            onToggleStampedSpots: function () {
                let spots = this.getView().byId("spots")
                spots.getItems()
                    .filter(e => e.getProperty("type") == !unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            }
        });
    });