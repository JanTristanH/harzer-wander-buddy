sap.ui.define([
    "sap/ui/core/Control",
    "hwb/frontendhwb/control/LeafletSpot"
  ], function(Control, LeafletSpot) {
    "use strict";
    const aFallBackCords=  ["10.615779999999972","51.80054"];
    const placeholderPrimaryColor = "{placeholderPrimaryColor}"
    const placeholderText = "{placeholderText}";
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
  
      init: function() {

      },

      invalidate: function () {
        // Prevent UI5 from re-rendering this control
        // but allow manual updates to children if needed
        console.debug("LeafletMap: suppressing invalidate()");
      },

      exit: function() {
        debugger
        if (this._oMap) {
          this._oMap.remove();
          this._oMap = null;
        }
      },      
  
      onAfterRendering: function() {
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
            this.fireZoomChanged({ zoom: this._oMap.getZoom() });
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
          oSpotGroup.attachEventOnce("_change", this._renderSpots, this);
        
          if (typeof oSpotGroup.updateItems === "function") {
            oSpotGroup.updateItems();
          }
        });
        
        this._renderSpots(); // TODO double render?
      },

      updateAggregation: function(sName) {
        Control.prototype.updateAggregation.apply(this, arguments);
        if (sName === "spots") {
          this._renderSpots();
        }
      },      
  
      _parsePosition: function(sPosition) {
        var aCoords = sPosition?.split(";") ?? aFallBackCords;
        aCoords = sPosition == 'undefined' ? aFallBackCords : aCoords;
        // Leaflet expects coordinates in [lat, lng] order.
        return [parseFloat(aCoords[1]), parseFloat(aCoords[0])];
      },
  
      _renderSpots: function() {
        if (!this._oMap) return;
      
        // Clear existing markers
        if (this._aMarkers) {
          this._aMarkers.forEach(marker => marker.remove());
        }
        this._aMarkers = [];
      
        const aSpots = this.getAggregation("spots")?.flatMap(s => s.getAggregation("items")).filter( s => !!s) || [];
      
        aSpots.forEach(oSpot => {
          const pos = this._parsePosition(oSpot.getPosition());
          if (pos.some(isNaN)) return;
      
          const icon = L.divIcon({
            className: '',
            html: this.getHtmlIconForSpot(oSpot),
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          const marker = L.marker(pos, { icon }).addTo(this._oMap);
          if (oSpot.getText()) {
            //marker.bindPopup(oSpot.getText());
          }
          marker.on("click", () => oSpot.fireClick());
      
          this._aMarkers.push(marker);
        });
      },      
  
      setCenterPosition: function(sPosition) {
        var latlng = this._parsePosition(sPosition);
        this._oMap?.panTo(latlng, {
            animate: true,
            duration: 0.5 // in seconds (optional)
        });
    },    
  
      zoomToGeoPosition: function(sLong, sLat, sZoomLevel) {
        this._oMap?.setView([sLat, sLong], sZoomLevel || fallBackZoomLevel);
      },

      invalidateSize: function() {
        this._oMap.invalidateSize();
      },
  
      renderer: {
        render: function(oRm, oControl) {
          oRm.write("<div");
          oRm.writeControlData(oControl);
          oRm.addStyle("height", oControl.getHeight());
          oRm.addStyle("width", oControl.getWidth());
          oRm.writeStyles();
          oRm.write("></div>");
        }
      },

      getHtmlIconForSpot: function(oSpot) {
        return this._locationIcon
        .replaceAll(placeholderPrimaryColor, this._typeToColor(oSpot.getType()))
        .replaceAll(placeholderText, oSpot.getText());
      },

      _typeToColor: function(sType) {
        switch (sType) {
          case "Error":
            return this._colorRed;
          case "Success":
              return this._colorGreen;
          default:
            return this._colorBlue;
        }
      },

      _colorRed: "rgb(187,0,0)",
      _colorGreen: "rgb(43, 125, 43)",
      _colorBlue: "rgb(66, 124, 172)",
      _locationIcon: `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="50" height="56" viewBox="187.96 -95.74 1080 1080" xml:space="preserve">
<desc>Created with Fabric.js 5.2.4</desc>
<defs>
</defs>
<rect x="0" y="0" width="100%" height="100%" fill="transparent"></rect>
<g transform="matrix(1 0 0 1 540 540)" id="a425b82f-861a-4485-b1a7-4a5484316a37"  >
<rect style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(255,255,255); fill-rule: nonzero; opacity: 1; visibility: hidden;" vector-effect="non-scaling-stroke"  x="-540" y="-540" rx="0" ry="0" width="1080" height="1080" />
</g>
<g transform="matrix(1 0 0 1 540 540)" id="015343ea-3476-4fe7-965e-b4dd8d479cec"  >
</g>
<g transform="matrix(2.09 0 0 8.97 863.98 403.58)" id="fd7c5c07-9ba2-4025-9979-6561b19e0d8a"  >
<rect style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(255,255,255); fill-rule: nonzero; opacity: 1;" vector-effect="non-scaling-stroke"  x="-37.46" y="-19.415" rx="0" ry="0" width="74.92" height="38.83" />
</g>
<g transform="matrix(45 0 0 45 540 540)"  >
<path style="stroke: rgb(255,255,255); stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: ${placeholderPrimaryColor}; fill-rule: nonzero; opacity: 1;"  transform=" translate(-12, -12)" d="M 12 11.5 C 10.619288125423017 11.5 9.5 10.380711874576983 9.5 9 C 9.5 7.619288125423017 10.619288125423017 6.5 12 6.5 C 13.380711874576983 6.5 14.5 7.619288125423016 14.5 9 C 14.5 10.380711874576983 13.380711874576983 11.5 12 11.5 M 12 2 C 8.134006751184446 2 5 5.134006751184446 5 9 C 5 14.25 12 22 12 22 C 12 22 19 14.25 19 9 C 19 5.134006751184446 15.865993248815554 2 12 2" stroke-linecap="round" />
</g>
<g transform="matrix(5.35 0 0 8.09 722.35 405.76)" id="fd7c5c07-9ba2-4025-9979-6561b19e0d8a"  >
<rect style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: ${placeholderPrimaryColor}; fill-rule: nonzero; opacity: 1;" vector-effect="non-scaling-stroke"  x="-37.46" y="-19.415" rx="0" ry="0" width="74.92" height="38.83" />
</g>
<g transform="matrix(3.94 0 0 3.94 541.69 403.6)" id="5a4f7790-68ef-4f6d-a3af-27ca72cdfb7e"  >
<circle style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(255,255,255); fill-rule: nonzero; opacity: 1;" vector-effect="non-scaling-stroke"  cx="0" cy="0" r="35" />
</g>
<g transform="matrix(4.92 0 0 7.08 716.24 403.63)" id="fd7c5c07-9ba2-4025-9979-6561b19e0d8a"  >
<rect style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(255,255,255); fill-rule: nonzero; opacity: 1;" vector-effect="non-scaling-stroke"  x="-37.46" y="-19.415" rx="0" ry="0" width="74.92" height="38.83" />
</g>
<g transform="matrix(0 0 0 0 0 0)"  >
<g style=""   >
</g>
</g>
<g transform="matrix(0 0 0 0 0 0)"  >
<g style=""   >
</g>
</g>
<g transform="matrix(0.85 0 0 0.85 686.57 398.73)" style="" id="edf5b5b6-510d-49ae-99bf-aea7ddd33846"  >
		<text xml:space="preserve" font-family="Raleway" font-size="250" font-style="normal" font-weight="900" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1; white-space: pre;" ><tspan x="-179.7" y="62.83" >${placeholderText}</tspan></text>
</g>
</svg>`
    });
  });
  