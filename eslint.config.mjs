import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/*", "node_modules/*", "out/*", "public/*.js"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Disable overly strict react-hooks rules that flag legitimate patterns
      // (hydration, localStorage init, state reset on prop change, dynamic icons)
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      // Allow underscore-prefixed variables (intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
