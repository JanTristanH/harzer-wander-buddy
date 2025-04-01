sap.ui.define([
    "sap/ui/core/Control"
  ], function(Control) {
    "use strict";
  
    return Control.extend("hwb.frontendhwb.Routes", {
      metadata: {
        library: "hwb.frontendhwb",
        defaultAggregation: "items",
        aggregations: {
          items: {
            type: "hwb.frontendhwb.Route",
            multiple: true,
            bindable: true,
            singularName: "item"
          }
        },
        events: {
          _change: {} // internal event to notify LeafletMap
        }
      },
  
      init: function () {
        this._bIsUpdatingItems = false; // prevent loops
      },
  
      updateItems: function () {
        if (this._bIsUpdatingItems) {
          return; // prevent recursive call
        }
  
        const oBindingInfo = this.getBindingInfo("items");
        if (!oBindingInfo || !oBindingInfo.template) return;
  
        const oBinding = this.getBinding("items");
        if (!oBinding) return;
  
        const aContexts = oBinding.getContexts();
  
        this._bIsUpdatingItems = true;
  
        // Clear existing items first (but only if count changes)
        const aOldItems = this.getItems();
        if (aOldItems.length !== aContexts.length) {
          this.destroyItems();
          aContexts.forEach(oContext => {
            const oClone = oBindingInfo.template.clone();
            oClone.setBindingContext(oContext, oBindingInfo.model);
            this.addAggregation("items", oClone);
          });
  
          this.fireEvent("_change"); // notify map to re-render
        }
  
        this._bIsUpdatingItems = false;
      },
  
      renderer: null
    });
  });
  