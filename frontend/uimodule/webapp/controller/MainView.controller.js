sap.ui.define(
  ["./BaseController"],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (Controller) {
    "use strict";

    return Controller.extend("hwb.harzerWanderBuddy.controller.MainView", {
      onInit: function () {
        this.oMap = this.byId("gmap");
        this.init = true;
      },

      onMapReady: function (oEvent) {
        // open all info dialogs
        if (this.init) {
          this.oMap.getMarkers().forEach(function (oMarker) {
            oMarker.infoWindowOpen();
          });
          this.init = false;
        }
      }
    });
  }
);