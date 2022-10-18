sap.ui.define([
        "sap/ui/core/mvc/Controller"
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.List", {
            onInit: function () {
                this.disableSelectAll();
            },
            disableSelectAll() {
                // hacky workaround, use custom control later:
                //https://stackoverflow.com/questions/51324035/how-to-hide-select-all-checkbox-from-table
                this._myDelegate = {
                    onAfterRendering: function () {
                        if (typeof this._getSelectAllCheckbox === "function" && this._getSelectAllCheckbox().isA("sap.m.CheckBox")) {
                            this._getSelectAllCheckbox().setVisible(false);
                        }
                    }
                };
                let oTable = this.getView().byId("StampingsTable");
                oTable.addEventDelegate(this._myDelegate, oTable);
            }
        });
    });