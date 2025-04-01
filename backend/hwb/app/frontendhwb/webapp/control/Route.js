sap.ui.define([
    "sap/ui/core/Control"
], function (Control) {
    "use strict";

    return Control.extend("hwb.frontendhwb.Route", {
        metadata: {
            properties: {
                position: { type: "string", defaultValue: "1;1;0;" },
                //   text: { type: "string", defaultValue: "" },
                //   type: { type: "string", defaultValue: "default" },
                //   labelText: { type: "string", defaultValue: "" },
                //   scale: { type: "string", defaultValue: "1;1;1" }
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

            // Create the white border (bottom layer)
            const borderPolyline = L.polyline(latlngs, {
                color: 'white',
                weight: 6,
                dashArray: '5, 10',
                opacity: 1
            });

            // Create the main colored line (top layer)
            const coloredPolyline = L.polyline(latlngs, {
                color: '#5ebae6',
                weight: 4,
                dashArray: '5, 10',
                opacity: 1
            });

            
const decorator = L.polylineDecorator(coloredPolyline, {
                patterns: [
                  {
                    offset: 0,
                    repeat: 50, // distance between arrows in pixels
                    symbol: L.Symbol.arrowHead({
                      pixelSize: 10,
                      polygon: false,
                      pathOptions: {
                        stroke: true,
                        color: '#5ebae6'
                      }
                    })
                  }
                ]
              })

            // Combine both into a LayerGroup
            this.polyline = L.layerGroup([borderPolyline, coloredPolyline, decorator]);

            return this.polyline;
        }

    });
});
