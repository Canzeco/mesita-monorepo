// Stripe's Android module names a Google library that is on no public server,
// and the release lint of React Native 0.87 and later tries to download it
// (stripe/stripe-react-native#2728). It serves Issuing push provisioning, which
// Mesita does not use, so it is taken out. Delete this file when the Stripe
// version Expo pins builds without it.
const { withProjectBuildGradle } = require("expo/config-plugins");

const RULE = `
subprojects { p ->
  if (p.name == "stripe_stripe-react-native") {
    p.dependencies.components.withModule("com.stripe:stripe-android-issuing-push-provisioning") { details ->
      details.allVariants {
        withDependencies { deps ->
          deps.removeAll { it.group == "com.google.android.gms" && it.name == "play-services-tapandpay" }
        }
      }
    }
  }
}
`;

module.exports = (config) =>
  withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") throw new Error("with-stripe-release-lint: build.gradle is not Groovy");
    if (!mod.modResults.contents.includes(RULE)) mod.modResults.contents += RULE;
    return mod;
  });
