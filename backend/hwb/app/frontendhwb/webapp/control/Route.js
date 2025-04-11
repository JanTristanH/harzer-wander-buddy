sap.ui.define([
    "sap/ui/core/Control"
], function (Control) {
    "use strict";

    return Control.extend("hwb.frontendhwb.Route", {
        metadata: {
            properties: {
                position: { type: "string", defaultValue: "1;1;0;" },
                lineDash: { type: "string", defaultValue: "" },
                labelText: { type: "string", defaultValue: "" },
                color: { type: "string", defaultValue: "5ebae6" },
                colorBorder: { type: "string", defaultValue: "#ffffff" },
                directionIndicator: { type: "boolean", defaultValue: "" },
            },
            events: {
                click: {}
            }
        },

        // No renderer needed since the actual rendering happens inside the LeafletMap control.

        getPolyline: function () {
            const latlngs = this.getPosition().split(";0;")
                .map(cords => cords.split(";"))
                .filter(cords => cords.length === 2)
                .map(cords => [parseFloat(cords[1]), parseFloat(cords[0])]);
            const dashArray = this.getLineDash().split(";").join(",");

            // Create the white border (bottom layer)
            const borderPolyline = L.polyline(latlngs, {
                color: this.getColorBorder(),
                weight: 6,
                dashArray,
                opacity: 1
            });

            // Create the main colored line (top layer)
            const coloredPolyline = L.polyline(latlngs, {
                color: this.getColor(),
                weight: 4,
                dashArray,
                opacity: 1
            });

            const group = [borderPolyline, coloredPolyline];

            if (this.getDirectionIndicator()) {
              const [lineLengthStr, gapLengthStr] = this.getLineDash().split(";");
              const lineLength = parseFloat(lineLengthStr);
              const gapLength = parseFloat(gapLengthStr);
              const totalLength = lineLength + gapLength > 0 ? lineLength + gapLength + 1 : 10; // Avoid division by zero
            
              const decorator = L.polylineDecorator(coloredPolyline, {
                patterns: [
                  {
                    // Move arrow to the end of each stroke by offsetting from the start of the segment
                    offset: `${lineLength - 1}px`, // 1px back from the end for visibility
                    repeat: `${totalLength * 7}px`,
                    symbol: L.Symbol.arrowHead({
                      pixelSize: 10,
                      polygon: false,
                      pathOptions: {
                        stroke: true,
                        color: this.getColor(),
                      }
                    })
                  }
                ]
              });
            
              group.push(decorator);
            }            

            // Combine both into a LayerGroup
            this.polyline = L.layerGroup(group);

            return this.polyline;
        }

    });
});
