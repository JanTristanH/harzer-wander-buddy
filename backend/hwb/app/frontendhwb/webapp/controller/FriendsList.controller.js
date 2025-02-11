sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
], function(
	Controller
) {
	"use strict";

    return Controller.extend("hwb.frontendhwb.controller.FriendsList", {
        onCreateDummyFriendship: function() {
            const oModel = this.getView().getModel();
            let dummyID = "576fb3a8-a62c-4fb4-ba2a-2a59fce0767a";
            oModel.create("/Friendships", {
                fromUser: { "ID": dummyID},
                toUser: {"ID": dummyID}
            });
        },

        onAcceptPendingFriendshipRequest: function(oEvent) {
            const oModel = this.getView().getModel();
            const ID = oEvent.getSource().getBindingContext().getProperty("ID")

            oModel.callFunction("/acceptPendingFriendshipRequest", {
                method: "POST",
                urlParameters: {
                    FriendshipID: ID
                },
                success: function() {
                    this.getView().getModel().refresh();
                }.bind(this),
                error: function(oError) {
                    // Handle error
                    console.error("Error accepting friendship request:", oError);
                }
            });
        }
    });
});