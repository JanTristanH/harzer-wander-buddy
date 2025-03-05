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
        },

        _onRouteMatched: function (oEvent) {
            this.getModel("app").setProperty("/backendUrl", window.location.origin);
            const sUserID = oEvent.getParameter("arguments").userId;
            this.sPath = "/Users(guid'" + sUserID + "')";
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
            this.getModel().refresh();
            
        },

        updateTableFilters: function () {
            const currentUser = this.getModel("app").getProperty("/currentUser");
            const aSelectedGroup = [currentUser.principal, this.getModel().getProperty(this.sPath + "/principal")];

            // Create binding filter for selected groups
            let oFilter = new Filter("groupFilterStampings", FilterOperator.NE, [...new Set(aSelectedGroup)].join(','));

            // Apply filter to binding
            const oBinding = this.byId("idStampingsProfileTable").getBinding("items");
            if (oBinding) {
                oBinding.filter(aSelectedGroup.length > 1 ?  oFilter : null);
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
                this.getModel("app").setProperty("/currentUser/picture", this.getModel().getProperty(this.sPath + "/picture"));
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
            const sPrincipal = this.getModel().getProperty(this.sPath + "/principal");
            let count = 0;
            const aItems = oEvent.getSource().getItems();
            for (let i = 0; i < aItems.length; i++) {
                if (aItems[i].getBindingContext().getProperty("stampedUserIds").includes(sPrincipal)) {
                    count++;
                }
            }
            this.getModel("app").setProperty("/stampedCount", count);
        },

        onFormatSelectedForUser: function (aSelectedGroupIds, sPrincipal) {
            if (!sPrincipal) {
                const oContext = this.getView().getBindingContext();
                sPrincipal = oContext?.getProperty("principal");
            }
            if (!sPrincipal || !Array.isArray(aSelectedGroupIds) || aSelectedGroupIds.length === 0) {
                return false;
            }

            return aSelectedGroupIds.includes(sPrincipal);
        },

        onFormatAddToGroupVisible: function () {
            const aGroup = this.getModel("app").getProperty("/aSelectedGroupIds");
            const sPrincipal = this.getModel().getProperty(this.sPath + "/principal");
            return !aGroup.includes(sPrincipal);
        },

        onAddToGroupSelection: function () {
            const sPrincipal = this.getModel().getProperty(this.sPath + "/principal");
            this.oMyAvatar = this.byId("container-hwb.frontendhwb---Profile--idMyAvatar");

            this._oPopover.openBy(this.oMyAvatar);
            const oComboBox = this.byId("container-hwb.frontendhwb---Profile--idGroupsMultiComboBox");
            oComboBox.addSelectedKeys([sPrincipal])
        }

    });
});