sap.ui.define([
  "sap/ui/core/Control",
  "hwb/frontendhwb/control/LeafletSpot"
], function (Control, LeafletSpot) {
  "use strict";
  const aFallBackCords = ["10.615779999999972", "51.80054"];
  const fallBackZoomLevel = 15;

  return Control.extend("hwb.frontendhwb.LeafletMap", {
    metadata: {
      properties: {
        initialPosition: { type: "string", defaultValue: "0;0" },  // format: "lng;lat"
        initialZoom: { type: "int", defaultValue: 10 },
        centerPosition: { type: "string", defaultValue: "0;0" },
        zoomlevel: { type: "int", defaultValue: 10 },
        height: { type: "string", defaultValue: "100%" },
        width: { type: "string", defaultValue: "100%" }
      },
      defaultAggregation: "spots",
      aggregations: {
        spots: { type: "hwb.frontendhwb.Spots", multiple: true, singularName: "spot" }
      },
      events: {
        zoomChanged: {},
        centerChanged: {}
      }
    },

    init: function () {

    },

    invalidate: function () {
      // Prevent UI5 from re-rendering this control
      // but allow manual updates to children if needed
      console.debug("LeafletMap: suppressing invalidate()");
    },

    exit: function () {
      debugger
      console.error("LeafletMap: exiting control");
      if (this._oMap) {
        this._oMap.remove();
        this._oMap = null;
      }
    },

    onAfterRendering: function () {
      if (!this._oMap) {
        const oDomRef = this.getDomRef();
        this._oMap = L.map(oDomRef, {
          center: this._parsePosition(this.getInitialPosition()),
          zoom: this.getInitialZoom()
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © OpenStreetMap contributors'
        }).addTo(this._oMap);

        this._oMap.on('zoomend', () => {
          this.fireZoomChanged({ zoomLevel: this._oMap.getZoom() });
        });

        this._oMap.on('moveend', () => {
          const center = this._oMap.getCenter();
          const sCenter = center.lng + ";" + center.lat;
          this.fireCenterChanged({ center: sCenter });
        });
      }

      // After rendering, ensure any bound spots are materialized
      const aSpots = this.getAggregation("spots") || [];

      aSpots.forEach(oSpotGroup => {
        oSpotGroup.attachEvent("_change", this._renderSpots, this);

        if (typeof oSpotGroup.updateItems === "function") {
          oSpotGroup.updateItems();
        }
      });

      this._renderSpots(); // TODO double render?
    },

    updateAggregation: function (sName) {
      Control.prototype.updateAggregation.apply(this, arguments);
      if (sName === "spots") {
        this._renderSpots();
      }
    },

    _parsePosition: function (sPosition) {
      var aCoords = sPosition?.split(";") ?? aFallBackCords;
      aCoords = sPosition == 'undefined' ? aFallBackCords : aCoords;
      // Leaflet expects coordinates in [lat, lng] order.
      return [parseFloat(aCoords[1]), parseFloat(aCoords[0])];
    },

    _renderSpots: function () {
      if (!this._oMap) return;

      // Clear existing markers
      if (this._aMarkers) {
        this._aMarkers.forEach(marker => marker.remove());
      }
      this._aMarkers = [];

      const aSpots = this.getAggregation("spots")?.flatMap(s => s.getAggregation("items")).filter(s => !!s) || [];

      aSpots.forEach(oSpot => {
        const marker = oSpot.getMarker();
        marker.addTo(this._oMap)
        this._aMarkers.push(marker);
      });
    },

    setCenterPosition: function (sPosition) {
      var latlng = this._parsePosition(sPosition);
      this._oMap?.panTo(latlng, {
        animate: true,
        duration: 0.5 // in seconds (optional)
      });
    },

    zoomToGeoPosition: function (sLong, sLat, sZoomLevel) {
      this._oMap?.setView([parseFloat(sLat), parseFloat(sLong)], sZoomLevel || fallBackZoomLevel);
    },

    invalidateSize: function () {
      this._oMap.invalidateSize();
    },

    renderer: {
      render: function (oRm, oControl) {
        oRm.write("<div");
        oRm.writeControlData(oControl);
        oRm.addStyle("height", oControl.getHeight());
        oRm.addStyle("width", oControl.getWidth());
        oRm.writeStyles();
        oRm.write("></div>");
      }
    },
  });
});
