const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  "react-native-web-webview": path.resolve(
    __dirname,
    "node_modules/react-native-web-webview"
  ),
};

module.exports = config;
