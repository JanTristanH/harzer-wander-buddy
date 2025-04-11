sap.ui.define([
  "sap/ui/core/Control",
  "hwb/frontendhwb/control/LeafletSpot"
], function (Control, LeafletSpot) {
  "use strict";
  const aFallBackCords = ["10.615779999999972", "51.80054"];
  const fallBackZoomLevel = 15;

  return Control.extend("hwb.frontendhwb.LeafletMap", {
    _oMap: null,
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
        spots: { type: "hwb.frontendhwb.Spots", multiple: true, singularName: "spot" },
        routes: { type: "hwb.frontendhwb.Routes", multiple: true, singularName: "route" }
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
      console.debug("LeafletMap: suppressing invalidate()");
    
      clearTimeout(this._invalidateTimeout);
      this._invalidateTimeout = setTimeout(() => {
        this._renderSpots();
        this._renderRoutes();
      }, 250); // Adjust delay (ms) as needed
    },

    exit: function () {
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
          this.fireCenterChanged({ centerPoint: sCenter });
          clearTimeout(this._invalidateTimeout);
        });

        this._oMap.on('movestart', () => {
          clearTimeout(this._invalidateTimeout);
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

      
      // After rendering, ensure any bound routes are materialized
      const aRoutes = this.getAggregation("routes") || [];

      aRoutes.forEach(oRouteGroup => {
        oRouteGroup.attachEvent("_change", this._renderRoutes, this);

        if (typeof oRouteGroup.updateItems === "function") {
          oRouteGroup.updateItems();
        }
      });

      this._renderRoutes(); // TODO double render?
    },

    updateAggregation: function (sName) {
      Control.prototype.updateAggregation.apply(this, arguments);
      if (sName === "spots") {
        this._renderSpots();
      }
      if (sName === "routes") {
        this._renderRoutes();
      }
    },

    updateItems: function () {
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
        if(!marker) {
          console.warn("LeafletMap: No marker found for spot");
          return;
        }
        marker.addTo(this._oMap)
        this._aMarkers.push(marker);
      });
    },

    _renderRoutes: function () {
      if (!this._oMap) return;

      // Clear existing markers
      if (this._aPolyline) {
        this._aPolyline.forEach(polyline => polyline.remove());
      }
      this._aPolyline = [];

      const aRoutes = this.getAggregation("routes")?.flatMap(s => s.getAggregation("items")).filter(s => !!s) || [];

      aRoutes.forEach(oRoute => {
        const polyline = oRoute.getPolyline();
        if(!polyline) {
          console.warn("LeafletMap: No polyline found for route");
          return;
        }
        polyline.addTo(this._oMap)
        this._aPolyline.push(polyline);
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
      this._oMap?.setView([parseFloat(sLat) - 0.004, parseFloat(sLong)], sZoomLevel ?? this.getZoomlevel());
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
