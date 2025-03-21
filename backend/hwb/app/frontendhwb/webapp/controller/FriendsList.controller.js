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

            if(sFriendshipId) {

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

            // Determine binding path and header text based on the search value.
            let sPath = sValue === "" ? "/MyFriends" : "/Users";
            let sTitle = sValue === "" ? this.getText("friendListHeader") : this.getText("wanderbuddies");
            oList.setHeaderText(sTitle);

            // Ensure the fragment template is loaded (it returns a Promise if not already loaded).
            Promise.resolve(this._oFriendListItemTemplate).then(function(oTemplate) {
                // Bind the aggregation using a factory function that clones the common fragment.
                oList.bindAggregation("items", {
                    path: sPath,
                    factory: function(sId, oContext) {
                        return oTemplate.clone(sId);
                    }
                });

                // Apply filter only if there is a search value.
                if (sValue !== "") {
                    var oBinding = oList.getBinding("items");
                    if (oBinding) {
                        oBinding.filter([
                            new Filter("name", FilterOperator.Contains, sValue)
                        ]);
                    }
                }
            });
        },

    });
});