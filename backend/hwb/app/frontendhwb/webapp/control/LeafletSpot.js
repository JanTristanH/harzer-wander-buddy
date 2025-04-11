sap.ui.define([
  "sap/ui/core/Control"
], function (Control) {
  "use strict";
  const placeholderPrimaryColor = "{placeholderPrimaryColor}"

  return Control.extend("hwb.frontendhwb.LeafletSpot", {
    metadata: {
      properties: {
        position: { type: "string", defaultValue: "0;0" },
        text: { type: "string", defaultValue: "" },
        type: { type: "string", defaultValue: "default" },
        labelText: { type: "string", defaultValue: "" },
        scale: { type: "string", defaultValue: "1;1;1" }
      },
      events: {
        click: {}
      }
    },

    // No renderer needed since the actual rendering happens inside the LeafletMap control.

    getMarker: function () {
      const pos = this._parsePosition(this.getPosition());
      if (pos.some(isNaN)) return;

      const icon = L.divIcon({
        className: '',
        html: this.getHtmlIconForSpot(),
        iconSize: [50, 56],
        iconAnchor: [25, 56]
      });
      const marker = L.marker(pos, { icon });
      if (this.getText()) {
        //marker.bindPopup(oSpot.getText());
      }
      marker.on("click", () => {
        if(this.getType() != "Hidden") {
          this.fireClick()
        }
      });

      this.marker = marker;
      return marker;
    },

    setType: function (sType) {
      if (sType === this.getType()) {
        return this;
      }
      this.setProperty("type", sType, true);
      this.updateMarker();
      return this;
    },

    setPosition: function (sPosition) {
      if (sPosition === this.getPosition()) {
        return this;
      }
      this.setProperty("position", sPosition, true);
      this.updateMarker();
      return this;
    },
    
    setText: function (sText) {
      if (sText === this.getText()) {
        return this;
      }
      this.setProperty("text", sText, true);
      this.updateMarker();
      return this;
    },
    
    setLabelText: function (sLabelText) {
      if (sLabelText === this.getLabelText()) {
        return this;
      }
      this.setProperty("labelText", sLabelText, true);
      this.updateMarker();
      return this;
    },
    
    setScale: function (sScale) {
      if (sScale === this.getScale()) {
        return this;
      }
      this.setProperty("scale", sScale, true);
      this.updateMarker();
      return this;
    },
    
    updateMarker: function newFunction() {
      this.marker?.setIcon(L.divIcon({
        className: '',
        html: this.getHtmlIconForSpot(),
        iconSize: [50, 56],
        iconAnchor: [25, 56]
      }));
    },


    _parsePosition: function (sPosition) {
      var aCoords = sPosition?.split(";") ?? aFallBackCords;
      aCoords = sPosition == 'undefined' ? aFallBackCords : aCoords;
      // Leaflet expects coordinates in [lat, lng] order.
      return [parseFloat(aCoords[1]), parseFloat(aCoords[0])];
    },

    getHtmlIconForSpot: function () {
      const primaryColor = this._typeToColor(this.getType());
      const scale = this.getScale().split(";")[0] || "1";
      const isHidden = this.getType() == "Hidden";


      const baseSvg = this._newLocationIcon.replaceAll(placeholderPrimaryColor, primaryColor);

      const markerTextClass = isHidden ? "marker-text-hidden" : "marker-text";
      const text = `<div class="${markerTextClass}">${this.getText()}</div>`;

      const labelText = this.getLabelText();

      const labelSvg = labelText
        ? `<div class="marker-label">
             <strong>${labelText}</strong>
           </div>`
        : "";

      return `
        <div class="marker-container" style="transform: scale(${scale}); transform-origin: center;">
          <div class="marker-icon-wrapper">
            ${isHidden ? "" : baseSvg}
            ${text}
          </div>
          ${isHidden ? "" : labelSvg}
        </div>`;
    },

    _typeToColor: function (sType) {
      switch (sType) {
        case "Error":
          return "rgb(187,0,0)";
        case "Success":
          return "rgb(43, 125, 43)";
        case "Warning":
          return "rgb(231, 140, 7)";
        default:
          return "rgb(66, 124, 172)";
      }
    },

    _newLocationIcon:
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="50" height="56" viewBox="0 0 1080 1080" xml:space="preserve">
<g transform="matrix(45 0 0 45 540 540)"  >
<path style="stroke: rgb(255,255,255); stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: ${placeholderPrimaryColor}; fill-rule: nonzero; opacity: 1;"  transform=" translate(-12, -12)" d="M 12 11.5 C 10.619288125423017 11.5 9.5 10.380711874576983 9.5 9 C 9.5 7.619288125423017 10.619288125423017 6.5 12 6.5 C 13.380711874576983 6.5 14.5 7.619288125423016 14.5 9 C 14.5 10.380711874576983 13.380711874576983 11.5 12 11.5 M 12 2 C 8.134006751184447 2 5 5.1340067511844465 5 9 C 5 14.25 12 22 12 22 C 12 22 19 14.25 19 9 C 19 5.1340067511844465 15.865993248815553 2 12 2" stroke-linecap="round" />
</g>
</svg>`

  });
});
