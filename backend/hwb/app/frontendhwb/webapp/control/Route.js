sap.ui.define([
    "sap/ui/core/Control"
  ], function (Control) {
    "use strict";
  
    return Control.extend("hwb.frontendhwb.Route", {
      metadata: {
        properties: {
            position: { type: "string", defaultValue: "0;0" },
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
        let latlngs = this.getPosition().split(";0;")
            .map( cords => cords.split(";") );
  
            latlngs = [
                [45.51, -122.68],
                [37.77, -122.43],
                [34.04, -118.2]
            ];

         this.polyline = L.polyline(latlngs, {color: 'red'});
        return this.polyline;
    }

    });
  });
  