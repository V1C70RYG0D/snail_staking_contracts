module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint/eslint-plugin", "perfectionist"],
  extends: ["plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "perfectionist/sort-array-includes": [
      "error",
      {
        order: "asc",
        "spread-last": true,
        type: "natural",
      },
    ],
    "perfectionist/sort-exports": [
      "error",
      {
        order: "asc",
        type: "line-length",
      },
    ],
    "perfectionist/sort-imports": [
      "error",
      {
        "newlines-between": "always",
        order: "asc",
        type: "line-length",
      },
    ],
    "perfectionist/sort-named-exports": [
      "error",
      {
        order: "asc",
        type: "natural",
      },
    ],
    "perfectionist/sort-named-imports": [
      "error",
      {
        order: "asc",
        type: "natural",
      },
    ],
  },
};
