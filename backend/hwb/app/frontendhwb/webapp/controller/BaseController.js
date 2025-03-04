sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (Controller, History, UIComponent, MessageToast, Filter, FilterOperator, Fragment) {

    "use strict";
    return Controller.extend("hwb.frontendhwb.controller.BaseController", {
        nZoomLevelLabelThreshold: 16,
        nZoomLevelClickThreshold: 11,
        fallBackCords: "10.615779999999972;51.80054",

        onInit: function () {
            this.oMyAvatar = this.getView().byId("idMyAvatar");
            this._oPopover = Fragment.load({
                id: this.getView().getId(),
                name: "hwb.frontendhwb.fragment.userMenuPopover",
                controller: this
            }).then(function (oPopover) {
                this.getView().addDependent(oPopover);
                this._oPopover = oPopover;
            }.bind(this));
        },

        onMyAvatarPress: function (oEvent) {
            var oEventSource = oEvent?.getSource() ?? this.oMyAvatar;
            this.oMyAvatar = oEventSource;
            var bActive = this.oMyAvatar.getActive();

            this.oMyAvatar.setActive(!bActive);

            if (bActive) {
                this._oPopover.close();
            } else {
                this._oPopover.openBy(oEventSource);
            }
        },

        onPopoverClose: function () {
            this.oMyAvatar.setActive(false);
        },

        onUserMenuListItemPress: function () {
            this.oMyAvatar.setActive(false);
            this._oPopover.close();
        },

        onLogoutPress: function () {
            window.location.href = "/logout";
        },

        onMyProfilePress: function () {
            this.getRouter().navTo("Profile", {
                userId: this.getModel("app").getProperty("/currentUser/ID")
            });
            this._oPopover.close();
        },

        onOpenAdminPanelPress: function () {
            this.getRouter().navTo("Admin");
            this._oPopover.close();
        },

        initializeAppModelForMap: function () {
            let sLastZoomLevel = sessionStorage.getItem("lastZoomLevel") ?? this.nZoomLevelLabelThreshold;
            this.getModel("app").setProperty("/zoomlevel", parseInt(sLastZoomLevel));
            this.getModel("app").setProperty("/bShowLabels", true);
            this.getModel("app").setProperty("/bShowParkingSpots", true);
            this.getModel("app").setProperty("/bShowStampedSpots", true);
            this.getModel("app").setProperty("/bShowUnStampedSpots", true);
            this.attachGroupChange();
        },

        stringToBoolean: function (str) {
            return str === "true";
        },

        onButtonSharePress: function () {
            navigator
                .share({
                    title: document.title,
                    text: 'Harzer Wanderbuddy',
                    url: window.location.href
                })
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName) ?? this.getOwnerComponent().getModel(sName);
        },

        getText: function (sKey) {
            //get the i18n resource bundle from core
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        },

        _getPoiById: function (ID) {
            let oModel = this.getModel();
            let oStamp = oModel.getProperty(`/Stampboxes(guid'${ID}')`);
            let oParking = oModel.getProperty(`/ParkingSpots(guid'${ID}')`);
            return oStamp || oParking;
        },

        getStampByNumber: function (sNumber) {
            let aData = Object.values(this.getModel().oData);
            return aData.filter(e => e.number == sNumber).pop();
        },

        formatCleanMeter: function (meters) {
            return `${parseInt(meters)} m`;
        },

        onNavBack: function () {
            var oHistory, sPreviousHash;
            oHistory = History.getInstance();
            sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("appHome", {}, true /*no history*/);
            }
        },

        onNavToMap: function () {
            this.getRouter().navTo("Map");
        },
        onNavToRouting: function () {
            this.getRouter().navTo("Routes");
        },
        onNavToList: function (params) {
            this.getRouter().navTo("Main");
        },

        onNavToFriends: function (params) {
            this.getRouter().navTo("FriendsList");
        },

        onButtonAdminMapPress: function () {
            this.getRouter().navTo("Admin");
        },

        onFormatRouteLineDash: function (travelMode) {
            if (travelMode == "walk") {
                return "9;9"; //dotted line
            }
            return ""; //normal line
        },

        formatMetersToKilometers: function (iMeters) {
            if (!iMeters && iMeters !== 0) {
                return "";
            }

            var kilometers = iMeters / 1000;
            return kilometers.toFixed(2) + " km"; // Show 2 decimal places
        },

        formatSecondsToTime: function (iSeconds) {
            if (!iSeconds && iSeconds !== 0) {
                return "";
            }

            var hours = Math.floor(iSeconds / 3600);
            var minutes = Math.floor((iSeconds % 3600) / 60);
            var seconds = iSeconds % 60;

            var formattedTime = "";

            if (hours > 0) {
                formattedTime += hours + " h ";
            }

            if (minutes > 0 || hours > 0) { // Include minutes if there are hours
                formattedTime += minutes + " min ";
            }

            return formattedTime.trim(); // Remove any trailing whitespace
        },

        _mapTravelTimeToPOIList: function (aPath) {
            if (!Array.isArray(aPath) || !aPath.length) {
                return [];
            }
            if (aPath.filter(p => p.id == "start").length != 0) {
                return aPath;
            }
            let toPoi = aPath[0].fromPoi;
            aPath.unshift({
                "ID": "start",
                "id": "start",
                "name": this._getPoiById(toPoi)?.name || this.getText("start"),
                //"fromPoi": "1e4b7315-a596-4e73-95b6-92fbf79a92a1",
                "toPoi": toPoi,
                "duration": 0,
                "distance": 0,
                "travelMode": "start",
                "toPoiType": "start",
                "rank": 0
            });

            let rank = 2048;
            aPath.reverse();
            aPath = aPath.map(p => {
                p.rank = rank;
                rank = rank * 2;
                return p;
            });
            aPath.reverse();
            aPath = this._addStampedUsers(aPath);
            return aPath;
        },

        _addStampedUsers: function (aPath) {
            let aSelectedGroup = this.getModel("app").getProperty("/aSelectedGroupIds") || [];
            aSelectedGroup = JSON.parse(JSON.stringify(aSelectedGroup));
            let currentUser = this.getModel("app").getProperty("/currentUser");
            aSelectedGroup.push(currentUser.principal);

            aPath.forEach(p => {
                const poi = this._getPoiById(p.toPoi);
                if (poi && poi.stampedUsers) {
                    p.stampedUsers = poi.stampedUsers.filter(u => aSelectedGroup.includes(u.principal));
                }
            });
            return aPath;
        },

        openMapsApp: function (lat, long) {
            if /* if we're on iOS, open in Apple Maps */
                (/iPad|iPhone|iPod/.test(navigator.userAgent))
                window.open(`maps://maps.google.com/maps?daddr=${lat},${long}&amp;ll=`); else /* else use Google */
                window.open(`https://maps.google.com/maps?daddr=${lat},${long}&amp;ll=`);
        },

        loadTourTravelTime: function (sTourId, successCallback) {
            this.getModel().read(`/Tour2TravelTime`, {
                urlParameters: {
                    "$expand": "travelTime",
                    "$orderby": "rank asc"
                },
                filters: [
                    new Filter("tour_ID", FilterOperator.EQ, sTourId)
                ],
                success: function (oRelatedData, oResponse) {
                    const travelTimeData = oRelatedData.results
                        .map(path => {
                            const tt = path.travelTime;
                            if (tt) {
                                const poi = this._getPoiById(tt.toPoi);
                                tt.name = poi ? poi.name : this.getText("start");
                                tt.duration = tt.durationSeconds;
                                tt.distance = tt.distanceMeters;
                                if (tt.elevationProfile) {
                                    let aElevationProfile = tt.elevationProfile.split(";");
                                    for (let i = 0; i < aElevationProfile.length; i++) {
                                        aElevationProfile[i] = { x: i, y: parseFloat(aElevationProfile[i]) };
                                    }
                                    tt.elevationProfile = aElevationProfile;
                                }
                            }
                            return tt;
                        })
                        .filter(p => !!p);

                    // Call the provided success callback with processed data
                    successCallback(travelTimeData);
                }.bind(this),
                error: function (oError) {
                    MessageToast.show("Error loading deferred entity!");
                    console.error(oError);
                }
            });
        },

        onFormatInitialsByName: function(sName){
            if(!sName) {
                return sName;
            }
            if(sName.length <= 3) {
                return sName;
            }
            return sName.split(' ').map(s => s.charAt(0).toUpperCase()).join("").substring(0,3);
        },

        isAdmin: function(roles) {
            if (!roles) return false;
            if (Array.isArray(roles)) {
                return roles.includes("admin");
            }
            return roles.split(",").map(role => role.trim()).includes("admin");
        }        

    });
});