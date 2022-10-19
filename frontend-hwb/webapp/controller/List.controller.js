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
            },

            onSelectionChange: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    // ListItem set to true
                    var oSelectedItem = oEvent.getParameter("listItem");
                    var obj = oSelectedItem.getBindingContext().getObject();
                    let oModel = this.getView().getModel();
                    let mParameters = {
                        success: () => alert("good"),
                        error: () => alert("bad")
                    }
                    let ID = obj.ID;
                    oModel.create("/Stampings", {
                        "stamp": {
                            ID
                        }
                    }, mParameters);
                    
                } else {
                // ListItem set to false
                alert(JSON.stringify("Not implemented yet"));
                }
            },

            onStampingsUpdateFinished: function (event) {
                this.selectWhere(context => context.getProperty("Stampings").length > 0);
            },

            selectWhere: function (keysAreMatching) {
                const table = this.byId("StampingsTable");

                table.getItems().forEach(element => {
                    if (keysAreMatching(element.getBindingContext())) {
                        table.setSelectedItemById(element.getId())
                    }
                });
                return table
            }
        });
    });