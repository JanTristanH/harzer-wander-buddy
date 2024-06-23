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
            onInit: function () {
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(1000);
            },

            onGeoMapZoomChanged: function (oEvent) {
                let nZoomLevel = oEvent.getParameter("zoomLevel");
                let aItems = this.getView().byId("idAllPointsOfInterestsSpots").getItems();
                let bLabelsHidden = aItems.length ? aItems[0].getProperty("labelText") : true;
                if (nZoomLevel < 11 && bLabelsHidden) {
                    //for everything smaller than 11, hide labels
                    this.onToggleLables();
                } else if (nZoomLevel > 11 && !bLabelsHidden) {
                    // restore labels
                    this.onToggleLables();
                }
                // keep as is for 11
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
            onToggleLables: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();
                let aItems = this.getView().byId("idAllPointsOfInterestsSpots").getItems();
                if ( aItems.length && aItems[0].getProperty("labelText")) {
                    aItems.map(e => e.setProperty("labelText", ""))
                } else {
                    this.getView().getModel().refresh();
                    this.itemCache = [];
                }
                //TODO save labeltext to local set and make them displayable again
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
            }
        });
    });