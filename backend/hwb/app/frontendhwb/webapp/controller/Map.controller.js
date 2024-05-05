sap.ui.define([
    "hwb/frontendhwb/controller/MapInner.controller",
    "sap/ui/core/Fragment"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Fragment) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.Map", {
            onAfterRendering: function () {
                this.getView().byId("navButtonMapId").setType("Emphasized");
            },
            onPressOpenFiltersMenu: function (oEvent) {
                var oButton = oEvent.getSource(),
                    oView = this.getView();

                // create popover
                if (!this._pPopover) {
                    this._pPopover = Fragment.load({
                        id: oView.getId(),
                        name: "hwb.frontendhwb.fragment.MapFilters",
                        controller: this
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }
                this._pPopover.then(function (oPopover) {
                    oPopover.openBy(oButton);
                });
            }
        });
    });