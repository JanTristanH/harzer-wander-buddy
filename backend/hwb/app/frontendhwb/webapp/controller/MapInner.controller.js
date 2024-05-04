sap.ui.define([
        "hwb/frontendhwb/controller/BaseController",
    ],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller) {
        "use strict";
        const unstampedType = "Error";

        return Controller.extend("hwb.frontendhwb.controller.Map", {
            itemCache: [],
            onInit: function () {
            },
            onAfterRendering: function () {
                this.getView().getModel().setSizeLimit(5000);
            },
            onToggleLables: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();
                let aItems = this.getView().byId("spots").getItems();
                if(aItems[0].getProperty("labelText")){
                    aItems.map(e => e.setProperty("labelText", ""))
                } else {
                    this.getView().getModel().refresh();
                    this.itemCache = [];
                }
                //TODO save labeltext to local set and make them displayable again
            },
            _createInitialItemCache: function () {
                //TODO this has to be reset on model Change urgh
                this.itemCache = this.getView().byId("spots").getItems();
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

                let spots = this.getView().byId("spots");
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") !== unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowGreens: function () {
                //create item cache with unmodified items if not existent
                this._getItemCache().length ? true : this._createInitialItemCache();

                let spots = this.getView().byId("spots")
                this._resetItemsForSpots(spots);
                spots.getItems()
                    .filter(e => e.getProperty("type") === unstampedType)
                    .map(e => spots.removeItem(e))
                //TODO reset items from global model
            },
            onShowAll: function () {
                let spots = this.getView().byId("spots")
                this._resetItemsForSpots(spots);
            }
        });
    });