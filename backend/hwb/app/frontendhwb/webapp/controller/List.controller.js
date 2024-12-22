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
                        success: () => MessageToast.show(this.getText("savedStamping")) || oModel.refresh(),
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
                        success: () => MessageToast.show(this.getText("deletedStamping")) || oModel.refresh(),
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
                    let oTable = this.byId("StampingsTable");
                    const aSelectedItems = oTable.getSelectedItems();
                    let iSelectedCount = aSelectedItems.length;

                    const aStampedNumbers = aSelectedItems.map(item => item.getCells()[1].getText());

                    oDialog.setModel(new JSONModel({
                        iSelectedCount,
                        "iRiserProgressCount": this.getRiserProgressCount(aStampedNumbers),
                        "aRequiredStampsRiser": this.getRequiredStampsRiser(),
                        "iBoarderProgressCount": this.getBoarderProgressCount(aStampedNumbers),
                        "aRequiredStampsBoarder": this.getRequiredStampsBoarder(),
                        "iGoetheProgressCount": this.getGoetheProgressCount(aStampedNumbers),
                        "aRequiredStampsGoethe": this.getRequiredStampsGoethe(),
                        "iWitchProgressCount": this.getWitchTrailPercentage(aStampedNumbers),
                        "aRequiredStampsWitchTrail": this.getRequiredStampsWithTrail(),
                    }), "localDialog")
                    oDialog.open(oDialog);
                });
            },



            //SX-Zwei-Länder-Eiche
            //SX-Jungborn
            //SX-Drei-Länder-Stein
            aBorderRequiredStamps: [1, 2, 3, 4, 9, 10, 11, 18, 19, 46, 90, 136, 156, 159, 164, 165, 166, 167, 168, 170].map(s => "" + s),
            getBoarderProgressCount: function (aStampedNumbers) {
                const applicableStampings = aStampedNumbers.filter(stamped => this.aBorderRequiredStamps.includes(stamped));
                return applicableStampings.length;
            },

            getRequiredStampsBoarder: function () {
                return this.aBorderRequiredStamps.map(s => this.getStampByNumber(s)).map(o => {
                    return {
                        ID: o.ID,
                        name: o.name,
                        number: o.number,
                        visited: o.Stampings.__list.length != 0
                    }
                });
            },

            aGoetheRequiredStamps: [9, 13, 14, 31, 38, 41, 42, 62, 69, 71, 78, 80, 85, 88, 91, 95, 99, 101, 105, 116, 117, 129, 132, 136, 140, 144, 155, 188].map(s => "" + s),

            getGoetheProgressCount: function (aStampedNumbers) {
                const applicableStampings = aStampedNumbers.filter(stamped => this.aGoetheRequiredStamps.includes(stamped));
                return applicableStampings.length;
            },

            getRequiredStampsGoethe: function () {
                return this.aGoetheRequiredStamps.map(s => this.getStampByNumber(s)).map(o => {
                    return {
                        ID: o.ID,
                        name: o.name,
                        number: o.number,
                        visited: o.Stampings.__list.length != 0
                    }
                });
            },

            aWitchTrailRequiredStamps: [69, 140, 9, 13, 17, 22, 40, 41, 42, 52, 60, 62, 63, 123, 128, 133, 136, 137, 155, 178].map(s => "" + s),
            getWitchTrailPercentage: function (aStampedNumbers) {
                let aWitchTrailRequiredStampsWithoutSpecific = this.aWitchTrailRequiredStamps.filter(s => s != "69" && s != "140");
                debugger;
                const applicableStampings = aStampedNumbers
                    
                    .filter(stamped => aWitchTrailRequiredStampsWithoutSpecific.includes(stamped));

                let sStampedForRequiredCount = Math.min(applicableStampings.length, 9);
                if (aStampedNumbers.includes("69")) {
                    sStampedForRequiredCount++;
                }
                if (aStampedNumbers.includes("140")) {
                    sStampedForRequiredCount++;
                }
                return sStampedForRequiredCount;
            },

            getRequiredStampsWithTrail: function () {
                return this.aWitchTrailRequiredStamps.map(s => this.getStampByNumber(s)).map(o => {
                    if (o.number == "69" || o.number == "140") {
                        o.name = `${o.name} ${this.getText("required")}`;
                    }

                    return {
                        ID: o.ID,
                        name: o.name,
                        number: o.number,
                        visited: o.Stampings.__list.length != 0
                    }
                });
            },

            aRiserRequiredStamps: [37, 39, 60, 61, 85, 91, 107, 113, 126, 127, 128, 133, 137, 146, 155, 172, 175, 179, 190, 193, 194, 217, 222].map(s => "" + s),

            getRiserProgressCount: function (aStampedNumbers) {
                let nStampedCount = aStampedNumbers.length;
                nStampedCount = Math.min(nStampedCount, 111);

                const applicableStampings = aStampedNumbers.filter(stamped => this.aRiserRequiredStamps.includes(stamped));
                const missingRequiredCount = this.aRiserRequiredStamps.length - applicableStampings.length;

                return nStampedCount - missingRequiredCount;
            },

            getRequiredStampsRiser: function () {
                return this.aRiserRequiredStamps.map(s => this.getStampByNumber(s)).map(o => {
                    return {
                        ID: o.ID,
                        name: o.name,
                        number: o.number,
                        visited: o.Stampings.__list.length != 0
                    }
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

            min: function (iCurrent, iMax) {
                return Math.min(iCurrent, iMax);
            },
            calculateValueColor: function (iCurrent, iMax) {
                let nPercentage = (iCurrent / iMax) * 100;
                return this.calculateValueColorPercentage(nPercentage);
            },
            calculateValueColorPercentage: function (nPercentage) {
                // Determine color based on percentage
                if (nPercentage >= 100) {
                    return "Good"; // Green for 100%
                } else if (nPercentage == 0) {
                    return "None"; // Grey for 0%
                } else {
                    return "rgb(50, 120, 190)"; // Blue otherwise
                }
            },

            onStampNavigatePress: function (oEvent) {
                const sId = oEvent.getSource().data("ID");
                this.getRouter().navTo("MapWithPOI", { idPOI: sId });
            }

        });
    });