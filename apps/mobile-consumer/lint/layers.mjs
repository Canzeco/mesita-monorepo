// The layer rule (Notion Docs › Apps › A2 §4):
//
//   app  →  features  →  components · theme · lib · generated
//
// Every zone below is generated from FEATURES, the one ordered list: a feature
// imports only features above it, and only through their index.ts.
// `layers(dir)` takes the source folder, so lint/check-fixture.mjs holds the
// deliberately wrong fixture to the very same rules.

export const FEATURES = [
  "auth",
  "identity",
  "place",
  "discovery",
  "reservations",
  "offers",
  "wallet",
  "pay",
  "tickets",
  "social",
  "notifications",
  "settings",
];

function zones(src) {
  const at = (path) => `${src}/${path}`;
  const out = [
    ...FEATURES.map((name) => ({
      target: at("app"),
      from: at(`features/${name}`),
      except: ["./screens", "./index.ts"],
      message: `A route imports @/features/${name}/screens/… or @/features/${name}, nothing else of a feature.`,
    })),
    {
      target: at("components"),
      from: src,
      except: ["./components", "./theme.ts"],
      message: "components may import only components and theme: pass the data in as props.",
    },
    {
      target: at("theme.ts"),
      from: src,
      except: ["./generated/brand.ts"],
      message: "theme.ts may import only generated/brand.ts.",
    },
    ...["lib", "generated"].flatMap((target) =>
      ["app", "features", "components"].map((from) => ({
        target: at(target),
        from: at(from),
        message: `${target} may not import ${from}: a feature listens to lib instead (onRefusal in lib/edge.ts).`,
      })),
    ),
  ];
  FEATURES.forEach((name, i) => {
    out.push({
      target: at(`features/${name}`),
      from: at("app"),
      message: `features/${name} may not import app: routes import features, never the reverse.`,
    });
    FEATURES.forEach((other, j) => {
      if (i === j) return;
      out.push(
        j > i
          ? {
              target: at(`features/${name}`),
              from: at(`features/${other}`),
              message: `features/${name} may not import features/${other}: it comes later in FEATURES (lint/layers.mjs). Move the shared rule up, or the screen down.`,
            }
          : {
              target: at(`features/${name}`),
              from: at(`features/${other}`),
              except: ["./index.ts"],
              message: `features/${name} may not import inside features/${other}: import from @/features/${other}.`,
            },
      );
    });
  });
  return out;
}

const COLOR = "/^(#[0-9a-fA-F]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch)a?\\(.*)$/";
const COLOR_MESSAGE = "A color literal lives only in src/theme.ts: use a token from @/theme.";
const SIZE_MESSAGE = "A raw font size lives only in src/theme.ts: spread a type role from @/theme.";

/** The flat-config entries that enforce the layer rule under `src`. */
export function layers(src) {
  const files = (glob) => [
    `${src}/${glob}/*.ts`,
    `${src}/${glob}/*.tsx`,
    `${src}/${glob}/**/*.ts`,
    `${src}/${glob}/**/*.tsx`,
  ];
  return [
    {
      files: [`${src}/**/*.ts`, `${src}/**/*.tsx`],
      // No eslint-disable: a layer rule has no exceptions.
      linterOptions: { noInlineConfig: true },
      rules: {
        "import/no-restricted-paths": ["error", { zones: zones(src) }],
        "import/no-cycle": ["error", { ignoreExternal: true }],
        "import/no-unresolved": "error",
      },
    },
    {
      files: [`${src}/**/*.ts`, `${src}/**/*.tsx`],
      ignores: [`${src}/theme.ts`],
      rules: {
        "no-restricted-syntax": [
          "error",
          { selector: `Literal[value=${COLOR}]`, message: COLOR_MESSAGE },
          { selector: `TemplateElement[value.raw=${COLOR}]`, message: COLOR_MESSAGE },
          {
            selector: "Property[key.name=/[cC]olor$/] > Literal[value=/^(?!transparent$)[a-z]+$/]",
            message: COLOR_MESSAGE,
          },
          {
            selector: "JSXAttribute[name.name=/[cC]olor$/] > Literal[value=/^(?!transparent$)[a-z]+$/]",
            message: COLOR_MESSAGE,
          },
          { selector: "Property[key.name=/^(fontSize|lineHeight)$/] > Literal", message: SIZE_MESSAGE },
        ],
      },
    },
    // Another feature, only through its index.ts (the alias form; the zones
    // above hold the relative form).
    ...FEATURES.map((name) => ({
      files: files(`features/${name}`),
      ignores: [`${src}/features/${name}/index.ts`],
      rules: {
        "no-restricted-imports": ["error", { patterns: otherFeatures(name) }],
      },
    })),
    ...FEATURES.map((name) => ({
      files: [`${src}/features/${name}/index.ts`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              ...otherFeatures(name),
              {
                regex: "(^|/)screens(/|$)",
                message: `features/${name}/index.ts never exports screens: routes import them from screens/.`,
              },
            ],
          },
        ],
      },
    })),
    {
      // A route file reads params and renders one screen. Layouts and Expo
      // Router's own + files may also import chrome and providers.
      files: files("app"),
      ignores: [`${src}/app/**/_layout.tsx`, `${src}/app/_layout.tsx`, `${src}/app/**/+*`, `${src}/app/+*`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex: "^(@|(\\.\\./)+)/?(components|lib|generated)(/|$)",
                message:
                  "A route renders one screen from a feature: components and lib belong in that screen, or in a layout.",
              },
            ],
          },
        ],
      },
    },
  ];
}

function otherFeatures(name) {
  return FEATURES.filter((other) => other !== name).map((other) => ({
    group: [`@/features/${other}/*`],
    message: `features/${name} may not import inside features/${other}: import from @/features/${other}.`,
  }));
}
