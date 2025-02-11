sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
], function(
	Controller
) {
	"use strict";

    return Controller.extend("hwb.frontendhwb.controller.FriendsList", {
        onCreateDummyFriendship: function() {
            const oModel = this.getView().getModel();
            let dummyID = "66e7278f-a6cd-407d-ac74-d015a66bc095";
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
                    ID
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