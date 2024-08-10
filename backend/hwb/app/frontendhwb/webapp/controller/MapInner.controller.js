sap.ui.define([
    "hwb/frontendhwb/controller/BaseController",
    "sap/ui/core/Fragment"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Fragment) {
        "use strict";
        const unstampedType = "Error";

        return Controller.extend("hwb.frontendhwb.controller.MapInner", {
            itemCache: [],
            _aParkingSpaceCache: [],
            onInit: function () {
                if (!this.getModel("local")) {
                    var oModel = new sap.ui.model.json.JSONModel();
                    oModel.setData({
                        UserLocationLat: 0,
                        UserLocationLng: 0
                    });
                    this.getView().setModel(oModel, "local");
                }
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(1000);
            },

            onGeoMapZoomChanged: function (oEvent) {
                let nZoomLevel = oEvent.getParameter("zoomLevel");
                this.onToggleLables(nZoomLevel >= 14);
            },

            onPressOpenFiltersMenu: function (oEvent) {
                var oButton = oEvent.getSource(),
                    oView = this.getView();

                // create popover
                if (!this._pPopover) {
                    this._pPopover = Fragment.load({
                        id: oView.getId(),
                        name: "hwb.frontendhwb.fragment.MapFilters",
                        controller: this
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }
                this._pPopover.then(function (oPopover) {
                    oPopover.openBy(oButton);
                });
            },

            onToggleLabelsCheckBox: function (oEvent) {
                this.onToggleLables(oEvent.getSource().getSelected());
            },
            onToggleLables: function (bVisible) {

                let aItems = [...this.byId("idAllPointsOfInterestsSpots").getItems()];
                const oParkingSpots = this.byId("idParkingSpotsSpots");
                oParkingSpots ? aItems.push(...oParkingSpots.getItems()) : null;

                aItems.forEach(e => {
                    let sText = e.getProperty("labelText");
                    sText = bVisible ? e.data("labelTextHidden") : "";
                    e.setProperty("labelText", sText);
                });
            },
            _createInitialItemCache: function () {
                //TODO this has to be reset on model Change urgh
                this.itemCache = this.getView().byId("idAllPointsOfInterestsSpots").getItems();
            },
            _getItemCache: function () {
                return this.itemCache;
            },
            _clearItemCache: function () {
                this.itemCache = [];
            },
            _resetItemsForSpots: function (spots) {
                spots.removeAllItems();
                this._getItemCache().forEach(item => {
                    spots.addItem(item);
                });
            },
            onToggleStampedSpots: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();

                let spots = this.getView().byId("idAllPointsOfInterestsSpots");
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") !== unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowGreens: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();

                let spots = this.getView().byId("idAllPointsOfInterestsSpots")
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") === unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowAll: function () {
                let spots = this.getView().byId("idAllPointsOfInterestsSpots")
                this._resetItemsForSpots(spots);
            },

            onParkingSpaceCheckBox: function (oEvent) {
                this.toggleParkingSpaceVisibility(oEvent.getSource().getSelected());
            },

            toggleParkingSpaceVisibility: function (bVisible) {
                let oSpots = this.byId("idParkingSpotsSpots");
                //create cache with unmodified items if not existent
                if (this._aParkingSpaceCache.length == 0) {
                    this._aParkingSpaceCache = oSpots.getItems();
                }

                if (bVisible) {
                    //show parking
                    this._aParkingSpaceCache.forEach(item => oSpots.addItem(item));
                } else {
                    //hide parking spaces
                    oSpots.getItems().forEach(e => oSpots.removeItem(e));
                }
            },

            onLocateMePress: function () {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        let oUserLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        let oLocalModel = this.getModel("local");
                        oLocalModel.setProperty("/UserLocationLat", oUserLocation.lat);
                        oLocalModel.setProperty("/UserLocationLng", oUserLocation.lng);
                    }.bind(this));
                }
            },

            onFormatBoxType: function (oStampings) {
                if (oStampings.length) {
                    return 'Success';
                }
                return 'Error';
            },

            onSpotContextMenu: function (oEvent) {
                let sStampNumber = oEvent.getSource().getText();
                const sLink = `https://www.harzer-wandernadel.de/?s=${sStampNumber}`;
                window.open(sLink, '_blank').focus();
            }
        });
    });