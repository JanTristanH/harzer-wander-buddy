sap.ui.define([
    "sap/ui/core/Control"
  ], function(Control) {
    "use strict";
  
    return Control.extend("hwb.frontendhwb.LeafletSpot", {
      metadata: {
        properties: {
          position: { type: "string", defaultValue: "0;0" },  // format: "lng;lat"
          text: { type: "string", defaultValue: "" }
        },
        events: {
          click: {}
        }
      }
      // No renderer needed since the actual rendering happens inside the LeafletMap control.
    });
  });
  