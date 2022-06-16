sap.ui.define(
    ["sap/ui/test/Opa5"],
    /**
     * @param {typeof sap.ui.test.Opa5} Opa5
     */
    function (Opa5) {
        "use strict";

        return Opa5.extend("hwb.harzerWanderBuddy.test.integration.arrangements.Startup", {
            iStartMyApp: function () {
                this.iStartMyUIComponent({
                    componentConfig: {
                        name: "hwb.harzerWanderBuddy",
                        async: true,
                        manifest: true,
                    },
                });
            },
        });
    }
);
