sap.ui.define([
    "sap/ui/core/Control",
    "sap/ui/thirdparty/jquery"
  ], function (Control, jQuery) {
    "use strict";
  
    return Control.extend("hwb.frontendhwb.control.ChartElevation", {
      metadata: {
        properties: {
          elevationProfile: { type: "object" }, // array of {x, y}
          minElevation: { type: "string", defaultValue: 0 }
        }
      },
  
      renderer: function (oRm, oControl) {
        oRm.write("<canvas");
        oRm.writeControlData(oControl);
        oRm.addStyle("width", "100%");
        oRm.addStyle("height", "60px");
        oRm.writeStyles();
        oRm.write("></canvas>");
      },
  
      onAfterRendering: function () {
        const canvas = this.getDomRef();
        if (!canvas || !this.getElevationProfile()) return;
      
        if (this._chart) {
          this._chart.destroy();
        }

        const aProfile = this.getElevationProfile();
        const yValues = aProfile.map(p => p.y);
        const minY = this.getMinElevation() || Math.min(...yValues);
        const maxY = Math.max(...yValues);
      
        this._chart = new Chart(canvas, {
          type: "line",
          data: {
            labels: aProfile.map(p => p.x),
            datasets: [{
              data: yValues,
              fill: true,
              backgroundColor: "rgba(0, 123, 255, 0.2)",
              borderColor: "rgba(0, 123, 255, 1)",
              borderWidth: 1,
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false }
            },
            scales: {
              x: { display: false },
              y: {
                display: true,
                min: minY,
                max: maxY,
                ticks: {
                  callback: (value) => `${Math.round(value)} m`,
                  maxTicksLimit: 2,
                  padding: 4,
                  color: "#666",
                  font: {
                    size: 10
                  }
                },
                grid: {
                  drawTicks: true,
                  drawBorder: false,
                  color: "rgba(0,0,0,0.05)"
                }
              }
            }
          }
        });
      }
      
    });
  });
  