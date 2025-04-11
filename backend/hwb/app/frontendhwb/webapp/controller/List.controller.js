sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    'sap/m/MessageToast',
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, MessageToast, Fragment, JSONModel, Filter, FilterOperator, MessageBox) {
        "use strict";

        return Controller.extend("hwb.frontendhwb.controller.List", {
            onInit: function () {
                Controller.prototype.onInit.apply(this, arguments);
                this.disableSelectAll();
                this.attachGroupChange();
                this.getModel("app").setProperty("/selectedFilterKey", "all");
            },

            onAfterRendering: function () {
                this.getView().byId("navButtonListId").setType("Emphasized");
            },

            attachGroupChange: function () {
                this.getModel("app").attachPropertyChange((oEvent) => {
                    if (oEvent.getParameter("path") == "/aSelectedGroupIds") {
                        this.applyGroupFilter();
                    }
                });
            },

            applyGroupFilter: function() {
                // Retrieve the updated property from the model
                let aSelectedGroup = this.getModel("app").getProperty("/aSelectedGroupIds") || [];
                aSelectedGroup = JSON.parse(JSON.stringify(aSelectedGroup)); // create copy
                let currentUser = this.getModel("app").getProperty("/currentUser");
                aSelectedGroup.push(currentUser.ID);

                // Create binding filter for selected groups
                let oFilter = new Filter("groupFilterStampings", FilterOperator.NE, aSelectedGroup.join(','));

                // Apply filter to binding
                const oBinding = this.byId("StampingsTable").getBinding("items");
                if (oBinding) {
                    oBinding.filter(aSelectedGroup.length > 1 ? oFilter : null);
                }
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
                var iSelectedCount = oTable.getSelectedItems().length ?? 0;
                this.getModel("app").setProperty("/selectedCount", iSelectedCount);
            },

            onSelectionChange: function (oEvent) {
                this.updateStampCount();
            
                var oSelectedItem = oEvent.getParameter("listItem");
                var obj = oSelectedItem.getBindingContext().getObject();
                let oModel = this.getView().getModel();
            
                if (oEvent.getParameter("selected")) {
                    let ID = obj.ID;
                    let mParameters = {
                        success: () => MessageToast.show(this.getText("savedStamping")) || oModel.refresh(),
                        error: () => MessageToast.show("An Error Occurred") || oSelectedItem.setSelected(false)
                    };
                    oModel.create("/Stampings", { "stamp": { ID } }, mParameters);
            
                } else {
                    let oStamping = this.getModel().getProperty("/" + oSelectedItem.getBindingContext().getProperty("Stampings")[0]);
                    let StampingId = oStamping.ID;
            
                    MessageBox.confirm(this.getResourceBundle().getText("confirmDeletionOfX", oSelectedItem.getBindingContext().getProperty("name")), {
                        icon: MessageBox.Icon.WARNING,
                        title: this.getText("confirmDeletionTitle"),
                        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                        emphasizedAction: MessageBox.Action.NO,
                        onClose: (oAction) => {
                            if (oAction === MessageBox.Action.YES) {
                                // ✅ User confirmed, proceed with deletion
                                let mParameters = {
                                    success: () => {
                                        MessageToast.show(this.getText("deletedStamping"));
                                        oModel.invalidate();
                                    },
                                    error: () => MessageToast.show("An Error Occurred") || oSelectedItem.setSelected(true)
                                };
                                oModel.remove(`/Stampings(${StampingId})`, mParameters);
                            } else {
                                // ✅ User canceled, revert selection
                                oSelectedItem.setSelected(true);
                            }
                        }
                    });
                }
            },            

            onStampingsUpdateFinished: function (event) {
                this.selectWhere(context => context.getProperty('hasVisited'));
                this.updateStampCount()
            },

            selectWhere: function (keysAreMatching) {
                const table = this.byId("StampingsTable");
                table.getItems().forEach(element => {
                    if (keysAreMatching(element.getBindingContext())) {
                        table.setSelectedItemById(element.getId())
                    }
                });
                return table
            },

            onListItemPress: function(oEvent) {
                const sId = oEvent.getSource().getBindingContext().getProperty("ID")
                this.getRouter().navTo("MapWithPOI", { idPOI: sId });
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

                    const aStampedNumbers = aSelectedItems.map(item => item.getCells()[0].getText());

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

                return Math.max(nStampedCount - missingRequiredCount, 0);
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
                if (nPercentage >= 100) {
                  return "#4caf50"; // Green for 100% (Success)
                } else if (nPercentage === 0) {
                  return "#9e9e9e"; // Grey for 0% (Neutral)
                } else {
                  return "#3278be"; // Blue for partial progress
                }
            },              

            onStampNavigatePress: function (oEvent) {
                const sId = oEvent.getSource().data("ID");
                this.getRouter().navTo("MapWithPOI", { idPOI: sId });
            },

            onFormatColumnVisibility: function (nIndex, aSelectedGroupIds) {
                const result = aSelectedGroupIds?.length >= parseInt(nIndex) + 1;
                if (result) {
                    const sID = aSelectedGroupIds[nIndex];
                    this.addColumnName(nIndex, sID);
                }
                return result;
            },

            addColumnName: function (nIndex, sID) {
                const aFilters = [new Filter("ID", FilterOperator.EQ, sID)];
                this.getModel().read("/Users", {
                    filters: aFilters,
                    success: function (oData) {
                        this.getModel("app").setProperty("/userName" + nIndex, oData.results[0].name);
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show(this.getText("error"));
                    }
                });
            },

            onFormatListItemVisible: function (sKey, bHasVisited) {
                if(!sKey || sKey == "all") {
                    return true;
                }
                if(sKey == "stamped" && bHasVisited) {
                    return true;
                }
                if(sKey == "unstamped" && !bHasVisited) {
                    return true;
                }
                return false;
            },

            onFormatGroupSelected: function (index, aSelectedGroupIds, stampedUserIds) {
                if (!aSelectedGroupIds || !aSelectedGroupIds.length) {
                    return false;
                }
                const sID = aSelectedGroupIds[index];
                return stampedUserIds.includes(sID);
            },
        });
    });