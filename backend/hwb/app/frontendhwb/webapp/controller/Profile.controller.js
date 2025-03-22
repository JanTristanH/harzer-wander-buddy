sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (
    Controller,
    MessageToast,
    Fragment,
    Filter,
    FilterOperator
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.Profile", {

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);
            this.getRouter().getRoute("Profile").attachPatternMatched(this._onRouteMatched, this);
            if (!this.getModel("app").getProperty("/aSelectedGroupIds")) {
                this.getModel("app").setProperty("/aSelectedGroupIds", []);
            }
            this.getModel("app").setProperty("/selectedFilterKeyProfile", "all");
        },

        _onRouteMatched: function (oEvent) {
            this.getModel("app").setProperty("/backendUrl", window.location.origin);
            const sUserID = oEvent.getParameter("arguments").userId;
            this.sPath = "/Users('" + sUserID + "')";
            this.sUserID = sUserID;
            this.getModel().invalidateEntityType("api.Stampboxes"); // force refresh of list
            this.getView().bindElement({
                path: this.sPath,
                events: {
                    dataReceived: function () {
                        this.updateTableFilters();
                    }.bind(this)
                }
            });

            this.initAcceptButton();
            this.bindStampForMeSwitch()

            const oFilter = new Filter("fromUser_ID", FilterOperator.EQ, sUserID);
            const oFriendListBinding = this.byId("idFriendsListProfile").getBinding("items");
            oFriendListBinding.filter([oFilter]);

            this.getModel().refresh();
        },

        initAcceptButton: function () {
            var oAppModel = this.getModel("app");
            var sCurrentUserPrincipal = oAppModel.getProperty("/currentUser/ID");
        
            // If user ID is null, attach a change handler
            if (!sCurrentUserPrincipal) {
                oAppModel.bindProperty("/currentUser/ID").attachChange(function () {
                    var sNewUserId = oAppModel.getProperty("/currentUser/ID");
                    if (sNewUserId) {
                        this._readPendingFriendshipRequests(sNewUserId);
                    }
                }.bind(this));
            } else {
                this._readPendingFriendshipRequests(sCurrentUserPrincipal);
            }
        
            // Reset pending requests indicator
            oAppModel.setProperty("/bHasPendingFriendshipRequests", false);
        },
        
        _readPendingFriendshipRequests: function (sUserId) {
            this.getModel().read('/PendingFriendshipRequests', {
                filters: [
                    new Filter("fromUser_ID", FilterOperator.EQ, sUserId),
                    new Filter("toUser_ID", FilterOperator.EQ, this.sUserID)
                ],
                parameters: { expand: 'fromUser,toUser' },
                success: function (oData) {
                    if (oData.results.length > 0) {
                        this.getModel("app").setProperty("/bHasPendingFriendshipRequests", true);
                        this.getModel("app").setProperty("/sPendingFriendshipRequestID", oData.results[0].ID);
                    }
                }.bind(this)
            });
        },

        onFriendSelectionChange: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext();
            oListItem.setSelected(false);
            const userId = oContext.getObject().toUser_ID;
            this.getRouter().navTo("Profile", { userId });
        },

        onAcceptPendingFriendshipRequest: function (oEvent) {
            const oModel = this.getView().getModel();
            const ID = this.getModel("app").getProperty("/sPendingFriendshipRequestID");

            oModel.callFunction("/acceptPendingFriendshipRequest", {
                method: "POST",
                urlParameters: {
                    FriendshipID: ID
                },
                success: function () {
                    this.initAcceptButton();
                    this.getModel().refresh();
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    MessageToast.show(this.getText("error"));
                    console.error("Error accepting friendship request:", oError);
                }
            });
        },

        updateTableFilters: function () {
            const currentUser = this.getModel("app").getProperty("/currentUser");
            const aSelectedGroup = [currentUser.ID, this.sUserID];

            // Create binding filter for selected groups
            let oFilter = new Filter("groupFilterStampings", FilterOperator.NE, [...new Set(aSelectedGroup)].join(','));

            // Apply filter to binding
            const oBinding = this.byId("idStampingsProfileTable").getBinding("items");
            if (oBinding) {
                oBinding.filter(aSelectedGroup.length > 1 ? oFilter : null);
            }
        },

        onNameChange: function (oEvent) {
            this.submitChanges();
        },

        onDeleteProfileImage: function (oEvent) {
            this.getModel().setProperty(this.sPath + "/picture", null);
            this.submitChanges();
        },

        onUploadImageDialog: function () {
            if (this.sUserID != this.getModel("app").getProperty("/currentUser/ID")) {
                return;
            }
            if (!this._oDialogImageUpload) {
                this._pDialogImageUpload = Fragment.load({
                    id: this.getView().getId(),
                    name: "hwb.frontendhwb.fragment.EditProfileImage",
                    controller: this
                });
            }
            this._pDialogImageUpload.
                then(function (oDialog) {
                    this._oDialogImageUpload = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.bindElement(this.sPath);
                    oDialog.open();
                }.bind(this));
        },

        onCloseImageUploadDialog: function () {
            this._oDialogImageUpload.close();
            this._clearFileUploader();
        },

        _clearFileUploader: function () {
            const oFileUploader = this.byId("fileUploader");
            if (!!oFileUploader) {
                oFileUploader.clear();
            }
        },

        onUploadComplete: function (oEvent) {
            this._oDialogImageUpload.setBusy(false);
            const statusCode = oEvent.getParameter("status");
            if (statusCode !== 204) {
                MessageToast.show(this.getText("error"));
            } else {
                MessageToast.show(this.getText("uploadSuccess"));
                this.onCloseImageUploadDialog();
                this.submitChanges(); // persist updated picture url
            }
        },

        onTypeMissmatch: function () {
            MessageToast.show(this.getText("fileTypeNotSupportedMessage"));
        },

        onUploadPress: function (oEvent) {
            const oFileUploader = this.getView().byId("fileUploader");
            if (!oFileUploader.getValue()) {
                const oI18nModel = this.getModel("i18n");
                MessageToast.show(oI18nModel.getProperty("chooseAFileFirst"));
                return;
            }
            this._oDialogImageUpload.setBusy(true);
            // create new entity as a put target
            this.getModel().createEntry("/Attachments", {
                properties: {
                    filename: oFileUploader.getValue(),
                    mimeType: oFileUploader.getMimeType()
                },
                success: function (oData) {
                    this.getModel("app").setProperty("/MediaID", oData.ID);
                    oFileUploader.upload();
                    const sFullPictureUrl = this.getModel("app").getProperty("/backendUrl") + "/odata/v2/api/Attachments/" + oData.ID + "/content";
                    this.getModel().setProperty(this.sPath + "/picture", sFullPictureUrl);
                }.bind(this),
                error: function () {
                    this._oDialogImageUpload.setBusy(false);
                    MessageToast.show(this.getText("error"));
                }.bind(this)
            });

            this.submitChanges();
        },

        submitChanges: function () {
            this.getModel().submitChanges({
                success: function () {
                    MessageToast.show(this.getText("saved"));
                    this.getModel("app").setProperty("/currentUser/picture", this.getModel().getProperty(this.sPath + "/picture"));
                }.bind(this),
                error: function () {
                    MessageToast.show(this.getText("error"));
                }.bind(this)
            });
        },

        // Table relevant methods
        onStampNavigatePress: function (oEvent) {
            const sId = oEvent.getSource().data("ID");
            this.getRouter().navTo("MapWithPOI", { idPOI: sId });
        },

        onStampingsTableUpdateFinished: function (oEvent) {
            let count = 0;
            const aItems = oEvent.getSource().getItems();
            for (let i = 0; i < aItems.length; i++) {
                if (aItems[i].getBindingContext().getProperty("stampedUserIds").includes(this.sUserID)) {
                    count++;
                }
            }
            this.getModel("app").setProperty("/stampedCount", count);
        },

        onFormatSelectedForUser: function (aSelectedGroupIds, sID) {
            if (!sID) {
                const oContext = this.getView().getBindingContext();
                sID = oContext?.getProperty("ID");
            }
            if (!sID || !Array.isArray(aSelectedGroupIds) || aSelectedGroupIds.length === 0) {
                return false;
            }

            return aSelectedGroupIds.includes(sID);
        },

        onFormatAddToGroupVisible: function () {
            const aGroup = this.getModel("app").getProperty("/aSelectedGroupIds");
            return !aGroup.includes(this.sUserID);
        },

        onAddToGroupSelection: function () {
            this.oMyAvatar = this.byId("container-hwb.frontendhwb---Profile--idMyAvatar");

            this._oPopover.openBy(this.oMyAvatar);
            const oComboBox = this.byId("container-hwb.frontendhwb---Profile--idGroupsMultiComboBox");
            oComboBox.addSelectedKeys([this.sUserID])
        },

        onNavToFriendPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                MessageToast.show("No friend context found.");
                return;
            }

            const userId = oContext.getObject().toUser_ID;
            this.getRouter().navTo("Profile", { userId });
        },

        onAddFriend: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                MessageToast.show(this.getText("error"));
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
                success: function (oData) {
                    this.getModel().refresh();
                    MessageToast.show(this.getText("friendshipCreated"));
                    this.getModel().refresh();
                    this.byId("idIsAllowedToStampForFriendSwitch")
                        .bindProperty("state", { path: `/Friendships(guid'${oData.ID}')/isAllowedToStampForFriend`});
                }.bind(this),
                error: function (oError) {
                    // Handle error
                    MessageToast.show(this.getText("errorCreatingFriendship"));
                    console.error("Error creating friendship:", oError);
                }.bind(this)
            });
        },

        bindStampForMeSwitch: function() {
            const sCurrentUserId = this.getModel("app").getProperty("/currentUser/ID");
            this.getModel().read("/Friendships", {
                filters: [
                        new Filter("toUser_ID", FilterOperator.EQ, this.sUserID),
                        new Filter("fromUser_ID", FilterOperator.EQ, sCurrentUserId)
                    ],
                success: function(oData) {
                   if (oData.results.length > 0) {
                        this.byId("idIsAllowedToStampForFriendSwitch")
                            .bindProperty("state", { path: `/Friendships(guid'${oData.results[0].ID}')/isAllowedToStampForFriend`});
                    }
                }.bind(this)
            })
        },

        onAllowedToStampSwitchChange: function() {
            this.getModel().submitChanges({
                success: () => this.getModel().refresh()
            });
        },

        onFormatListItemVisible: function(selectedFilterKeyProfile, stampedUserIds) {
            const sCurrentUserId = this.getModel("app").getProperty("/currentUser/ID")
            switch (selectedFilterKeyProfile) {
                case undefined:
                case "all":
                    return true;
                case "stamped":
                    return stampedUserIds.includes(this.sUserID);
                case "unstamped":
                    return !stampedUserIds.includes(this.sUserID);
                case "stampedMe":
                    return stampedUserIds.includes(sCurrentUserId);
                case "unstampedMe":
                    return !stampedUserIds.includes(sCurrentUserId);
                case "stampedBoth":
                    return stampedUserIds.includes(this.sUserID) && stampedUserIds.includes(sCurrentUserId);
                case "unstampedBoth":
                    return !stampedUserIds.includes(this.sUserID) && !stampedUserIds.includes(sCurrentUserId)
                default:
                    return false;
            }
        }
    });
});