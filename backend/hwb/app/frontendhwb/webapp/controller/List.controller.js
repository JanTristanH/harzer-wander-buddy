sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    'sap/m/MessageToast',
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, MessageToast, Fragment, JSONModel) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.List", {

            //SX-Zwei-Länder-Eiche
            //SX-Jungborn
            //SX-Drei-Länder-Stein
            aBorderRoute: [1, 2, 3, 9, 10, 11, 19, 46, 90, 156, 159, 164, 166, 167, 168],
            aGoethe: [9, 13, 14, 31, 38, 41, 42, 62, 69, 71, 78, 80, 85, 88, 91, 95, 99, 101, 105, 116, 117, 129, 132, 136, 140, 144, 155, 188],

            aWitchTrail: [9, 13, 17, 22, 40, 41, 42, 52, 60, 62, 63, 69, 123, 128, 133, 136, 137, 140, 155, 178],
            aWitchTrailAdditional: [69, 140],
            onInit: function () {
                this.disableSelectAll();
            },
            onAfterRendering: function () {
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

            updateStampCount: function () {
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
            },
            onLogoutPress: function () {
                window.location.href = "/logout";
            },

            onShowBagdesButtonPress: function (oEvent) {
                const oView = this.getView();

                // create popover
                if (!this.pBadgeProgressDialog) {
                    this.pBadgeProgressDialog = Fragment.load({
                        id: oView.getId(),
                        name: "hwb.frontendhwb.fragment.BadgeProgressDialog",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this.pBadgeProgressDialog.then(oDialog => {
                    var oTable = this.byId("StampingsTable");
                    var iSelectedCount = oTable.getSelectedItems().length;


                    oDialog.setModel(new JSONModel({
                        iSelectedCount,
                        "iBoarderPercentage": 0,
                        "sBoarderValueColor": "Neutral",
                        "iGoethePercentage": 0,
                        "sGoetheValueColor": "Neutral",
                        "iWithTrailPercentage": 0,
                        "sWithTrailValueColor": "Neutral",
                    }), "localDialog")
                    oDialog.open(oDialog);
                });
            },

            onCloseButtonPress: function (oEvent) {
                this.pBadgeProgressDialog.then(d => d.close());
            },

            calculatePercentage: function (iCurrent, iMax) {
                if (!iCurrent || !iMax || iMax <= 0) {
                    return 0; // Return 0 if invalid input
                }
                return Math.min((iCurrent / iMax) * 100, 100); // Ensure percentage doesn't exceed 100
            },

            calculateValueColor: function (iCurrent, iMax) {
                let nPercentage = (iCurrent / iMax) * 100;
                // Determine color based on percentage
                if (nPercentage >= 100) {
                    return "Good"; // Green for 100%
                } else {
                    return "Neutral"; // Grey otherwise
                }
            }

        });
    });