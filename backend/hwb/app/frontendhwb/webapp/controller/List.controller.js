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
                // ListItem set to true
                var obj = oSelectedItem.getBindingContext().getObject();
                let oModel = this.getView().getModel();
                if (oEvent.getParameter("selected")) {
                    let ID = obj.ID;
                    let mParameters = {
                        success: () => MessageToast.show("Saved Stamping") || oModel.refresh(),
                        // give message and reset ui to keep it consistent with backend
                        error: () => MessageToast.show("An Error Occured") || oSelectedItem.setSelected(false)
                    }
                    oModel.create("/Stampings", {
                        "stamp": {
                            ID
                        }
                    }, mParameters);
                } else {
                    let StampingId = obj.StampingId;
                    let mParameters = {
                        success: () => MessageToast.show("Saved Stamping") || oModel.refresh(),
                        // give message and reset ui to keep it consistent with backend
                        error: () => MessageToast.show("An Error Occured") || oSelectedItem.setSelected(true)
                    }
                    oModel.remove(`/Stampings(${StampingId})`, mParameters);
                }
            },

            onStampingsUpdateFinished: function (event) {
                this.selectWhere(context => context.getProperty("hasVisited"));
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