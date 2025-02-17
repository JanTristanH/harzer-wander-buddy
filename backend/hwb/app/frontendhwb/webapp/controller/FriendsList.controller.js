sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (
    Controller,
    MessageToast,
    Filter,
    FilterOperator
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.FriendsList", {

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);
            var oList = this.byId("idFriendsList");
            // If the list has items from the XML view, clone the first one as the template.
            if (oList && oList.getItems().length > 0) {
                this._oFriendTemplate = oList.getItems()[0].clone();
            }
        },

        onAfterRendering: function () {
            this.getView().byId("navButtonFriendsId").setType("Emphasized");
        },

        onCreateDummyFriendship: function () {
            const oModel = this.getView().getModel();
            let currentUser = this.getModel("app").getProperty("/currentUser");
            let currentUserID = currentUser.ID;
            oModel.create("/Friendships", {
                fromUser: { "ID": currentUserID },
                toUser: { "ID": currentUserID }
            }, {
                success: function () {
                    this.byId("friendsListId").getBinding("items").refresh();
                    MessageToast.show(this.getText("friendshipCreated"));
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    MessageToast.show(this.getText("errorCreatingFriendship"));
                    console.error("Error creating friendship:", oError);
                }.bind(this)
            });
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

            // Access the model and remove the entity.
            var oModel = this.getView().getModel();
            oModel.remove(`/Friendships(${sFriendshipId})`, {
                success: function () {
                    MessageToast.show(this.getText("friendRemoved"));
                    this.getModel().refresh();
                }.bind(this),
                error: function (oError) {
                    MessageToast.show(this.getText("errorRemovingFriend"));
                }
            });
        },

        onAcceptPendingFriendshipRequest: function (oEvent) {
            const oModel = this.getView().getModel();
            const ID = oEvent.getSource().getBindingContext().getProperty("ID")

            oModel.callFunction("/acceptPendingFriendshipRequest", {
                method: "POST",
                urlParameters: {
                    FriendshipID: ID
                },
                success: function () {
                    this.getModel().refresh();
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    console.error("Error accepting friendship request:", oError);
                }
            });
        },

        onSearchFieldLiveChange: function (oEvent) {
            const sValue = oEvent.getParameter("newValue");
            const oList = this.byId("idFriendsList");
            // Determine the binding path based on the search value.
            let sPath = sValue === "" ? "/MyFriends" : "/Users";
            let sTitle = sValue === "" ? this.getText("friendListHeader") : this.getText("wanderbuddies");

            oList.setHeaderText(sTitle);
            // Rebind the aggregation with a factory function.
            oList.bindAggregation("items", {
                path: sPath,
                factory: function (sId, oContext) {
                    // Create friend info: avatar and name.
                    var oAvatar = new sap.m.Avatar({
                        src: "{picture}",
                        displaySize: "S",
                        class: "sapUiSmallMarginEnd"
                    });
                    var oNameText = new sap.m.Text({
                        text: "{name}",
                        class: "sapUiTinyMargin"
                    });
                    var oInfoHBox = new sap.m.HBox({
                        alignItems: "Center",
                        items: [oAvatar, oNameText]
                    });

                    // Create Add Friend button.
                    var oAddFriendButton = new sap.m.Button({
                        icon: "sap-icon://add",
                        type: "Transparent",
                        press: function (oEvent) {
                            this.onAddFriend(oEvent);
                        }.bind(this),
                        customData: [
                            new sap.ui.core.CustomData({
                                key: "ID",
                                value: "{localDialog>ID}",
                                writeToDom: true
                            })
                        ]
                    });
                    // Bind the "visible" property so that it shows only when not a friend.
                    oAddFriendButton.bindProperty("visible", {
                        parts: [{ path: "isFriend" }],
                        formatter: function (bIsFriend) {
                            return !bIsFriend;
                        }
                    });

                    // Create Remove Friend button.
                    var oRemoveFriendButton = new sap.m.Button({
                        icon: "sap-icon://delete",
                        type: "Transparent",
                        press: function (oEvent) {
                            this.onRemoveFriend(oEvent);
                        }.bind(this),
                        class: "sapUiTinyMarginBegin",
                        customData: [
                            new sap.ui.core.CustomData({
                                key: "ID",
                                value: "{localDialog>ID}",
                                writeToDom: true
                            })
                        ]
                    });
                    // Bind the "visible" property so that it shows only when already a friend.
                    oRemoveFriendButton.bindProperty("visible", {
                        path: "isFriend",
                        formatter: function (bIsFriend) {
                            return !!bIsFriend;
                        }
                    });

                    var oButtonsHBox = new sap.m.HBox({
                        items: [oAddFriendButton, oRemoveFriendButton]
                    });

                    // Create the main HBox that contains the friend info and the buttons.
                    var oMainHBox = new sap.m.HBox({
                        justifyContent: "SpaceBetween",
                        alignItems: "Center",
                        width: "100%",
                        items: [oInfoHBox, oButtonsHBox]
                    });

                    return new sap.m.CustomListItem(sId, {
                        content: oMainHBox
                    });
                }.bind(this)
            });

            // Apply the filter only when there is a search value.
            if (sValue !== "") {
                var oBinding = oList.getBinding("items");
                if (oBinding) {
                    oBinding.filter([
                        new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, sValue)
                    ]);
                }
            }
        }

    });
});