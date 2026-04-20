const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve } = require("metro-resolver");

const config = getDefaultConfig(__dirname);
const baseResolveRequest = config.resolver.resolveRequest || resolve;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "web/react-native-maps.tsx"),
    };
  }

  return baseResolveRequest(context, moduleName, platform);
};

module.exports = config;
