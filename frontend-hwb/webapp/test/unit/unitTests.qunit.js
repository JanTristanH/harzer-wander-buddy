/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"hwb/frontend-hwb/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
