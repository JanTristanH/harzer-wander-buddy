sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
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
            onAfterRendering: function(){
                this.getView().byId("navButtonListId").setType("Emphasized");
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

            updateStampCount: function(){
                var oTable = this.byId("StampingsTable");
                var iSelectedCount = oTable.getSelectedItems().length;
                var oSelectedCountLabel = this.byId("selectedCount");
                oSelectedCountLabel.setText("Erwanderte Stempel: " + iSelectedCount); // Update the text of the label
            },

            onSelectionChange: function (oEvent) {

                this.updateStampCount()

                // Update Backend
                var oSelectedItem = oEvent.getParameter("listItem");
                // ListItem set to true
                var obj = oSelectedItem.getBindingContext().getObject();
                let oModel = this.getView().getModel();
                debugger
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
                    let oStamping = this.getModel().getProperty("/" + oSelectedItem.getBindingContext().getProperty("Stampings")[0]);
                    let StampingId = oStamping.ID;
                    let mParameters = {
                        success: () => MessageToast.show("Saved Stamping") || oModel.refresh(),
                        // give message and reset ui to keep it consistent with backend
                        error: () => MessageToast.show("An Error Occured") || oSelectedItem.setSelected(true)
                    }
                    oModel.remove(`/Stampings(${StampingId})`, mParameters);
                }
            },

            onStampingsUpdateFinished: function (event) {
                this.selectWhere(context => context.getProperty('Stampings').length);
                this.updateStampCount()
            },

            selectWhere: function (keysAreMatching) {
                const table = this.byId("StampingsTable");
                let that = this;
                table.getItems().forEach(element => {
                    if (keysAreMatching(element.getBindingContext())) {
                        table.setSelectedItemById(element.getId())
                    }
                });
                return table
            }
        });
    });