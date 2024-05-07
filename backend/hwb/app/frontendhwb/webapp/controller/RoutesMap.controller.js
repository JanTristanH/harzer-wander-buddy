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
                this.bus.subscribe("list", "onListSelect", this.onListSelect, this);
            },

            onAfterRendering: function() {
                setTimeout(() => {
                    let map = this.byId("RoutesMapId").byId("map");
                    
                    map.setInitialPosition(
                        this.getView().getModel("local").oData.hikingRoutes[0].path[1].positionString.split(';0')[0]);
                }, 1000);

            },
            onBackToList: function () {
                this.bus.publish("flexible", "setList")
            },
            onListSelect:function (params) {
                
            }
        });
    });