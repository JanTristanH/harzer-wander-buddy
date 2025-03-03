sap.ui.define([
    "hwb/frontendhwb/controller/BaseController"
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.Routes", {
            onAfterRendering: function () {
                this.getView().byId("navButtonRoutesId").setType("Emphasized");
            }
        });
    });