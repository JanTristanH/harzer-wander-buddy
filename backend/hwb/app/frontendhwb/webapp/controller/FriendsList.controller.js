sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast"
], function (
    Controller,
    MessageToast
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.FriendsList", {

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

        onAcceptPendingFriendshipRequest: function (oEvent) {
            const oModel = this.getView().getModel();
            const ID = oEvent.getSource().getBindingContext().getProperty("ID")

            oModel.callFunction("/acceptPendingFriendshipRequest", {
                method: "POST",
                urlParameters: {
                    FriendshipID: ID
                },
                success: function () {
                    this.getView().getModel().refresh();
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    console.error("Error accepting friendship request:", oError);
                }
            });
        }
    });
});