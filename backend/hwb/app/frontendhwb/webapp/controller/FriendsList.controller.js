sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (
    Controller,
    MessageToast,
    Filter,
    FilterOperator,
    Fragment
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.FriendsList", {

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);
            // Load the fragment once and store as a template for list items.
            if (!this._oFriendListItemTemplate) {
                this._oFriendListItemTemplate = Fragment.load({
                    id: this.getView().getId(),
                    name: "hwb.frontendhwb.fragment.FriendListItem",
                    controller: this
                });
            }
        },
    
        onAfterRendering: function () {
            this.byId("navButtonFriendsId").setType("Emphasized");
    
            const sCurrentUserID = this.getModel("app").getProperty("/currentUser/ID");
            if(!sCurrentUserID) {
                setTimeout(this.onAfterRendering.bind(this), 250);
                return;
            }
            const oFilter = new Filter("fromUser_ID", FilterOperator.EQ, sCurrentUserID);

            const oBinding = this.byId("idPendingFriendshipRequestsList").getBinding("items");
            oBinding.filter([oFilter]);
        },

        onAddFriend: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            if (!oContext) {
                MessageToast.show("No friend context found.");
                return;
            }

            // Retrieve the friend data and prepare the payload.
            var oFriendData = oContext.getObject();
            let currentUser = this.getModel("app").getProperty("/currentUser");
            let currentUserID = currentUser.ID;

            this.getModel().create("/Friendships", {
                fromUser: { "ID": currentUserID },
                toUser: { "ID": oFriendData.ID }
            }, {
                success: function () {
                    this.getModel().refresh();
                    MessageToast.show(this.getText("friendshipCreated"));
                    this.getModel().refresh();
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    MessageToast.show(this.getText("errorCreatingFriendship"));
                    console.error("Error creating friendship:", oError);
                }.bind(this)
            });
        },

        onRemoveFriend: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            
            if (!oContext) {
                MessageToast.show("No friend context found.");
                return;
            }
        
            // Get the binding path for the selected friend.
            var sFriendshipId = oContext.getObject().FriendshipID;
        
            if (sFriendshipId) {
                // Create the confirmation dialog
                var oDialog = new sap.m.Dialog({
                    title: this.getText("confirmRemoveAction"),
                    type: "Message",
                    content: new sap.m.Text({
                        text: this.getText("confirmRemoveFriendMessage")
                    }),
                    beginButton: new sap.m.Button({
                        text: this.getText("remove"),
                        press: function () {
                            var oModel = this.getView().getModel();
                            oModel.remove(`/Friendships(${sFriendshipId})`, {
                                success: function () {
                                    MessageToast.show(this.getText("friendRemoved"));
                                    this.getModel().refresh();
                                }.bind(this),
                                error: function (oError) {
                                    MessageToast.show(this.getText("errorRemovingFriend"));
                                }.bind(this)
                            });
        
                            oDialog.close();
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: this.getText("cancel"),
                        press: function () {
                            oDialog.close();
                        }
                    })
                });
        
                // Open the dialog
                oDialog.open();
            } else {
                MessageToast.show(this.getText("errorRemovingFriend"));
            }
        },

        onNavToFriendPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext() ?? oEvent.getParameter("listItem").getBindingContext();
            if (!oContext) {
                MessageToast.show("No friend context found.");
                return;
            }

            const userId = oContext.getObject().ID;
            this.getRouter().navTo("Profile", { userId });
        },

        onFriendSelectionChange: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext();
            oListItem.setSelected(false);
            const userId = oContext.getObject().ID;
            this.getRouter().navTo("Profile", { userId });
        },

        onAcceptPendingFriendshipRequest: function (oEvent) {
            const oModel = this.getView().getModel();
            const oBindingContext = oEvent.getSource().getBindingContext();
            const ID = oBindingContext.getProperty("ID");

            // Open a confirmation dialog to accept or decline the request
            var oDialog = new sap.m.Dialog({
                title: this.getText("confirmFrienshipAction"),
                type: "Message",
                content: new sap.m.Text({
                    text: this.getText("confirmAcceptRequestMessage")
                }),
                beginButton: new sap.m.Button({
                    text: this.getText("accept"),
                    type: "Emphasized",
                    press: function () {
                        oModel.callFunction("/acceptPendingFriendshipRequest", {
                            method: "POST",
                            urlParameters: {
                                FriendshipID: ID
                            },
                            success: function () {
                                this.getModel().refresh();
                                sap.m.MessageToast.show(this.getText("friendshipRequestAccepted"));
                            }.bind(this),
                            error: function (oError) {
                                console.error("Error accepting friendship request:", oError);
                                sap.m.MessageToast.show(this.getText("error"));
                            }.bind(this)
                        });
        
                        oDialog.close();
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: this.getText("decline"),
                    press: function () {
                        oModel.remove(`/PendingFriendshipRequests(${ID})`, {
                            success: function () {
                                sap.m.MessageToast.show(this.getText("friendshipRequestDeclined"));
                            }.bind(this),
                            error: function (oError) {
                                console.error("Error declining friendship request:", oError);
                                sap.m.MessageToast.show(this.getText("error"));
                            }.bind(this)
                        });
        
                        oDialog.close();
                    }
                })
            });
        
            // Open the dialog
            oDialog.open();
        },

        onUpdateFinished: function(oEvent) {
            var oBinding = oEvent.getSource().getBinding("items");
            var oIconTabFilter = this.byId("pendingFriendshipRequestsIconTabFilter");

            var sText = this.getText("pendingFriendshipRequests") + ` (${oBinding.getLength()})`;
            oIconTabFilter.setText(sText);
        },

        onSearchFieldLiveChange: function (oEvent) {
            const sValue = oEvent.getParameter("newValue");
            const oList = this.byId("idFriendsList");

            // Determine binding path and header text based on the search value.
            let sPath = sValue === "" ? "/MyFriends" : "/Users";
            let sTitle = sValue === "" ? this.getText("friendListHeader") : this.getText("wanderbuddies");
            oList.setHeaderText(sTitle);


            Promise.resolve(this._oFriendListItemTemplate).then(function(oTemplate) {
                oList.bindAggregation("items", {
                    path: sPath,
                    factory: function(sId, oContext) {
                        return oTemplate.clone(sId);
                    }
                });

                // Apply filter only if there is a search value.
                if (sValue !== "") {
                    const oBinding = oList.getBinding("items");
                    if (oBinding) {
                        const oFilter1 = new Filter("name", FilterOperator.Contains, sValue);
                        const oFilter2 = new Filter("name", FilterOperator.Contains, sValue.toLowerCase());
                        const capitalizeFirstLetter = sValue.charAt(0).toUpperCase() + sValue.slice(1);
                        const oFilter3 = new Filter("name", FilterOperator.Contains, capitalizeFirstLetter);


                        // Combine them with an OR condition
                        const oFinalFilter = new Filter({
                            filters: [oFilter1, oFilter2, oFilter3],
                            and: false
                        });

                        oBinding.filter(oFinalFilter);
                    }
                }
            });
        },

    });
});