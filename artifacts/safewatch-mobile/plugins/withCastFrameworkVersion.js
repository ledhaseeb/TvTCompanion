const { withProjectBuildGradle } = require("expo/config-plugins");

module.exports = function withCastFrameworkVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      const contents = config.modResults.contents;
      if (!contents.includes("play-services-cast-framework")) {
        config.modResults.contents = contents.replace(
          /allprojects\s*\{/,
          `allprojects {
    configurations.all {
        resolutionStrategy {
            force 'com.google.android.gms:play-services-cast-framework:21.5.0'
        }
    }`
        );
      }
    }
    return config;
  });
};
