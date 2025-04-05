sap.ui.define([
    "sap/ui/core/Control"
  ], function (Control) {
    "use strict";
  
    return Control.extend("hwb.frontendhwb.control.DonutMicroChart", {
      metadata: {
        properties: {
          value: { type: "int", defaultValue: 0 },
          total: { type: "int", defaultValue: 1 },
          color: { type: "string", defaultValue: "#007aff" } // fallback blue
        }
      },
  
      renderer: function (oRm, oControl) {
        oRm.write("<canvas");
        oRm.writeControlData(oControl);
        oRm.addStyle("width", "48px");
        oRm.addStyle("height", "48px");
        oRm.writeStyles();
        oRm.write("></canvas>");
      },
  
      onAfterRendering: function () {
        const canvas = this.getDomRef();
        if (!canvas) return;
  
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.getContext("2d").scale(dpr, dpr);
  
        const value = this.getValue();
        const total = this.getTotal();
        const color = this.getColor();
        const remaining = Math.max(total - value, 0);
  
        // Clean up old chart
        if (this._chart) {
          this._chart.destroy();
        }
  
        this._chart = new Chart(canvas, {
          type: "doughnut",
          data: {
            datasets: [{
              data: [value, remaining],
              backgroundColor: [color, "#e0e0e0"],
              borderWidth: 0
            }]
          },
          options: {
            cutout: "75%", // Thickness of ring
            responsive: true,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false }
            }
          }
        });
      }
    });
  });
  