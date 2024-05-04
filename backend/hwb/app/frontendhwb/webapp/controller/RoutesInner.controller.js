sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel) {
        "use strict";
        var autocomplete; //inspired by https://github.com/costa-satsati/addressautocomplete/

        return Controller.extend("hwb.frontendhwb.controller.RoutesInner", {
            itemCache: [],
            onAfterRendering: function () {
            },

            onOpenRoutingDialog: async function () {
                var oView = this.getView();

                // Create dialog lazily
                if (!this.pDialog) {
                    this.pDialog = await this.loadFragment({
                        name: "hwb.frontendhwb.fragment.HikingRouteDialog"
                    });


                    this.pDialog.open();

                    oView.addDependent(this.pDialog);
                    this.onAfterRenderingFragment();
                }

                // Reset model or create new one if needed
                var oModel = new sap.ui.model.json.JSONModel({
                    maxDepth: 8,
                    maxDuration: 36000,
                    maxDistance: 15000,
                    latitudeStart: '',
                    longitudeStart: '',
                    allowDriveInRoute: true,
                    minStampCount: 1
                });
                this.pDialog.setModel(oModel);

                this.pDialog.open();
                this.onAfterRenderingFragment();
            },

            onCancel: function () {
                this.pDialog.close();
            },

            onSubmitRouting: function () {
                var oModel = this.getView().getModel(); // Get the OData model
                var oDialogModel = this.pDialog.getModel();

                // Define the function import URL and parameters
                var sFunctionName = "/calculateHikingRoute";
                var oParams = {
                    maxDepth: oDialogModel.getProperty("/maxDepth"),
                    maxDuration: oDialogModel.getProperty("/maxDuration"),
                    maxDistance: oDialogModel.getProperty("/maxDistance"),
                    latitudeStart: oDialogModel.getProperty("/latitudeStart"),
                    longitudeStart: oDialogModel.getProperty("/longitudeStart"),
                    allowDriveInRoute: oDialogModel.getProperty("/allowDriveInRoute"),
                    minStampCount: oDialogModel.getProperty("/minStampCount")
                };
                // Call the function import
                oModel.callFunction(sFunctionName, {
                    method: "GET",
                    urlParameters: oParams,
                    success: function (oData, oResponse) {
                        sap.m.MessageToast.show("Route calculated successfully!");
                        // Additional success handling
                        let oLocalModel = new sap.ui.model.json.JSONModel({
                            hikingRoutes: oData.calculateHikingRoute.results
                        });
                        this.getView().setModel(oLocalModel, "local");
                        this.pDialog.close();
                        if (!!oData.calculateHikingRoute.results.length) {

                            this.getView().byId("idRouteList").setSelectedKey(oData.calculateHikingRoute.results[0].id);
                            this.getView().byId("idRoutingMap").setInitialPosition(
                                oData.calculateHikingRoute.results[0].path[1].positionString.split(';0')[0]);

                            oLocalModel.setProperty("/routes", oData.calculateHikingRoute.results[0].path);
                        } else {
                            sap.m.MessageToast.show("No routes found! :(");
                        }
                    }.bind(this),
                    error: function (oError) {
                        sap.m.MessageToast.show("Failed to calculate route.");
                        // Additional error handling
                        this.pDialog.close();
                    }
                });
            },

            onSelectionChange: function (oEvent) {
                let oLocalModel = this.getView().getModel("local");
                let selectedRoute = oLocalModel.getProperty("/hikingRoutes")
                    .filter(r => r.id == oEvent.getParameter("selectedItem").getKey())[0];

                oLocalModel.setProperty("/routes", selectedRoute.path);

                this.getView().byId("idRoutingMap").setCenterPosition(
                    selectedRoute.path[1].positionString.split(';0')[0]);

                if (this.getView().getModel("device").getProperty("/system/phone")) {
                    this.onToggleList();
                }

            },

            onToggleList: function () {
                let bVisible = this.getView().byId("idRouteList").getVisible();
                this.getView().byId("idRouteList").setVisible(!bVisible);
            },

            onUseCurrentLocation: function () {
                this._geolocate();
            },

            onAfterRenderingFragment: function () {
                autocomplete = new google.maps.places.Autocomplete(
                    (this.byId('autocomplete').getDomRef('inner')), {
                    types: ['geocode']
                });
                autocomplete.addListener('place_changed', function () {
                    // Get the place details from the autocomplete object.
                    var place = autocomplete.getPlace();
                    this.pDialog.getModel().setProperty("/latitudeStart", place.geometry.location.lat());
                    this.pDialog.getModel().setProperty("/longitudeStart", place.geometry.location.lng());

                    // // Get each component of the address from the place details
                    // // and fill the corresponding field on the form.
                    // addressModel = this.getView().getModel("addressModel");
                    // for (var i = 0; i < place.address_components.length; i++) {
                    //     var addressType = place.address_components[i].types[0];
                    //     if (addressMapping[addressType]) {
                    //         var val = place.address_components[i]["short_name"];
                    //         addressModel.setProperty("/"+addressMapping[addressType],val);
                    //     }
                    // }
                }.bind(this));
                this._geolocate();
            },

            /** 
             * Private method to prompt for location
             * @constructor 
             */
            _geolocate: function () {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        var geolocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        var circle = new google.maps.Circle({
                            center: geolocation,
                            radius: position.coords.accuracy
                        });
                        autocomplete.setBounds(circle.getBounds());
                        this.pDialog.getModel().setProperty("/latitudeStart", geolocation.lat);
                        this.pDialog.getModel().setProperty("/longitudeStart", geolocation.lng);
                        this.byId('autocomplete').setValue("Aktueller Standort 📍")
                    }.bind(this));
                }
            }
        });
    });