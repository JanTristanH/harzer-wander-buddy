sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (
    Controller,
    MessageToast,
    Fragment
) {
    "use strict";

    return Controller.extend("hwb.frontendhwb.controller.Profile", {

        onInit: function () {
            Controller.prototype.onInit.apply(this, arguments);
            this.getRouter().getRoute("Profile").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            this.getModel("app").setProperty("/backendUrl", window.location.origin);
            const sUserID = oEvent.getParameter("arguments").userId;
            this.sPath = "/Users(guid'" + sUserID + "')";
            this.getView().bindElement(this.sPath);
        },

        onNameChange: function (oEvent) {
            this.submitChanges();
        },

        onDeleteProfileImage: function (oEvent) {
            this.getModel().setProperty(this.sPath + "/picture", null);
            this.submitChanges();
        },

        onUploadImageDialog: function () {
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
                    filename : oFileUploader.getValue(),
                    mimeType : oFileUploader.getMimeType()
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
        }

    });
});