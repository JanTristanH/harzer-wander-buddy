sap.ui.define([
        "sap/ui/core/mvc/Controller",
        'sap/m/MessageToast'
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, MessageToast) {
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
                var oSelectedItem = oEvent.getParameter("listItem");
                if (oEvent.getParameter("selected")) {
                    // ListItem set to true
                    var obj = oSelectedItem.getBindingContext().getObject();
                    let oModel = this.getView().getModel();
                    let mParameters = {
                        success: () => MessageToast.show("Saved Stamping"),
                        // give message and reset ui to keep it consistent with backend
                        error: () => MessageToast.show("An Error Occured") || oSelectedItem.setSelected(false)
                    }
                    let ID = obj.ID;
                    oModel.create("/Stampings", {
                        "stamp": {
                            ID
                        }
                    }, mParameters);
                } else {
                    // ListItem set to false
                    MessageToast.show("Removing Stamps is not implemented yet");
                    oSelectedItem.setSelected(true);
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