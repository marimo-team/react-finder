import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

const src = fileURLToPath(new URL("src", import.meta.url));

// Demo base path. Locally the gallery lives at /demo/; the GitHub Pages workflow sets
// DEMO_BASE_PATH from `actions/configure-pages` ("" for a root site, "/<repo>" otherwise).
const demoBase = process.env.DEMO_BASE_PATH ?? "/demo";

export default defineConfig({
  // The Vite app is the demo gallery; the library itself is built with `vp pack`.
  root: process.env.VITEST ? "." : "demo",
  base: `${demoBase}/`,
  resolve: {
    alias: {
      "@marimo-team/react-finder/adapters/s3": `${src}/adapters/s3/index.ts`,
      "@marimo-team/react-finder": `${src}/index.ts`,
    },
  },

  test: {
    environment: "node",
    globals: true,
    watch: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/adapters/testing/**"],
    },
  },

  // Library build (tsdown/rolldown). Output layout matches package.json "exports".
  pack: {
    entry: {
      index: "src/index.ts",
      "adapters/s3/index": "src/adapters/s3/index.ts",
    },
    format: ["esm"],
    platform: "browser",
    target: "es2022",
    dts: { tsconfig: "tsconfig.build.json" },
    sourcemap: true,
    clean: true,
    treeshake: true,
  },

  // Oxfmt
  fmt: {
    printWidth: 100,
    sortImports: {},
    sortPackageJson: true,
    ignorePatterns: ["dist/**", "demo/dist/**", "pnpm-lock.yaml"],
  },

  // Oxlint: everything except nursery, type-aware, warnings are failures.
  lint: {
    ignorePatterns: ["dist/**", "demo/dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: [
      "typescript",
      "oxc",
      "unicorn",
      "import",
      "promise",
      "react",
      "react-perf",
      "jsx-a11y",
      "vitest",
    ],
    categories: {
      correctness: "error",
      suspicious: "error",
      pedantic: "error",
      perf: "error",
      style: "error",
      restriction: "error",
      nursery: "off",
    },
    env: { browser: true, es2024: true },
    settings: {
      "jsx-a11y": { components: { Button: "button", Input: "input" } },
    },
    rules: {
      // Rules that ban modern JavaScript or fight the architecture of a headless library.
      "one-var": "off",
      "import/no-relative-parent-imports": "off",
      "oxc/no-async-await": "off",
      "oxc/no-optional-chaining": "off",
      "oxc/no-rest-spread-properties": "off",
      "vitest/require-test-timeout": "off",
      "vitest/no-importing-vitest-globals": "off",
      "vitest/prefer-describe-function-title": "off",
      "vitest/no-conditional-in-test": "off",
      "vitest/require-hook": "off",
      "vitest/require-mock-type-parameters": "off",
      // Contradict prefer-strict-boolean-matchers (toBe(true)/toBe(false) is the house style).
      "vitest/prefer-to-be-truthy": "off",
      "vitest/prefer-to-be-falsy": "off",
      "vitest/prefer-called-once": "off",
      "react/jsx-props-no-spreading": "off",
      "react/jsx-handler-names": "off",
      "react/only-export-components": "off",
      "react/no-clone-element": "off",
      "react/function-component-definition": "off",
      "react-perf/jsx-no-new-function-as-prop": "off",
      "react-perf/jsx-no-new-object-as-prop": "off",
      "react-perf/jsx-no-new-array-as-prop": "off",
      "promise/avoid-new": "off",
      "promise/prefer-await-to-callbacks": "off",
      "typescript/promise-function-async": "off",
      "typescript/require-await": "off",
      "require-await": "off",
      "typescript/non-nullable-type-assertion-style": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/no-dynamic-delete": "off",
      "unicorn/no-array-sort": "off",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-await-expression-member": "off",
      // Restriction rules that fight the design of this library.
      "typescript/explicit-function-return-type": "off",
      "typescript/explicit-module-boundary-types": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-global-this": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-nested-ternary": "off",
      "no-undefined": "off",
      "no-ternary": "off",
      "no-void": "off",
      "no-warning-comments": "off",
      "no-magic-numbers": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-params": "off",
      "max-depth": "off",
      "max-classes-per-file": "off",
      "id-length": "off",
      "sort-keys": "off",
      "sort-imports": "off",
      "func-style": "off",
      "no-inline-comments": "off",
      "init-declarations": "off",
      "no-plusplus": "off",
      "no-continue": "off",
      "no-await-in-loop": "off",
      "no-underscore-dangle": "off",
      "prefer-destructuring": "off",
      "capitalized-comments": "off",
      "no-negated-condition": "off",
      "no-param-reassign": "off",
      "no-labels": "off",
      "import/no-namespace": "off",
      "import/exports-last": "off",
      "import/group-exports": "off",
      "import/no-default-export": "off",
      "import/prefer-default-export": "off",
      "import/no-unassigned-import": "off",
      "import/max-dependencies": "off",
      "import/no-named-export": "off",
      "import/no-anonymous-default-export": "off",
      "react/jsx-no-literals": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-filename-extension": "off",
      "react/no-multi-comp": "off",
      "react/jsx-max-depth": "off",
      "react/forbid-component-props": "off",
      "react/forbid-dom-props": "off",
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      "typescript/prefer-readonly-parameter-types": "off",
      "typescript/no-magic-numbers": "off",
      "typescript/parameter-properties": "off",
      "typescript/max-params": "off",
      "typescript/method-signature-style": "off",
      "typescript/explicit-member-accessibility": "off",
      "typescript/class-methods-use-this": "off",
      // Enabled with tuned options.
      // Split `import` / `import type` pairs are intentional (verbatimModuleSyntax); import/no-duplicates still runs.
      "no-duplicate-imports": "off",
      "typescript/no-use-before-define": [
        "error",
        { functions: false, classes: false, variables: false, typedefs: false },
      ],
      "unicorn/filename-case": [
        "error",
        { cases: { camelCase: true, pascalCase: true, kebabCase: true } },
      ],
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "typescript/strict-boolean-expressions": [
        "error",
        {
          allowString: true,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: true,
          allowNullableString: true,
          allowNullableNumber: false,
          allowNullableEnum: false,
          allowAny: false,
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "vitest", message: 'Import test APIs from "vite-plus/test".' }],
          patterns: [
            {
              group: ["**/adapters/s3", "**/adapters/s3/**"],
              message: "The S3 adapter is a subpath export; never import it from the root graph.",
            },
          ],
        },
      ],
      "typescript/no-non-null-assertion": "error",
      "typescript/no-floating-promises": ["error", { ignoreVoid: true }],
      "typescript/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
      "typescript/switch-exhaustiveness-check": "error",
      "no-console": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "multi-line"],
    },
    overrides: [
      {
        files: ["**/*.test.{ts,tsx}", "src/test/**", "src/adapters/testing/**"],
        rules: {
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-return": "off",
          "typescript/no-empty-function": "off",
          "unicorn/consistent-function-scoping": "off",
          "unicorn/no-await-expression-member": "off",
          "no-console": "off",
          "max-nested-callbacks": "off",
          "vitest/no-conditional-expect": "off",
          "vitest/require-top-level-describe": "off",
          "vitest/prefer-expect-assertions": "off",
          "vitest/no-hooks": "off",
          "vitest/max-expects": "off",
          "vitest/require-to-throw-message": "off",
          "vitest/prefer-strict-equal": "off",
          "vitest/prefer-lowercase-title": "off",
          "vitest/no-large-snapshots": "off",
          "vitest/consistent-test-it": "off",
        },
      },
      {
        files: ["src/**"],
        rules: { "import/no-default-export": "error" },
      },
      {
        files: ["src/adapters/s3/**"],
        rules: { "no-restricted-imports": "off" },
      },
      {
        files: ["vite.config.ts"],
        rules: { "import/no-nodejs-modules": "off" },
      },
      {
        files: ["demo/**"],
        rules: {
          "no-console": "off",
          "no-alert": "off",
          "react-perf/jsx-no-new-object-as-prop": "off",
          "react-perf/jsx-no-new-array-as-prop": "off",
          "react-perf/jsx-no-new-function-as-prop": "off",
          "react-perf/jsx-no-jsx-as-prop": "off",
        },
      },
    ],
  },

  // `vp run <script>` / `vpr <script>` caches script results keyed on the files they read.
  run: { cache: { scripts: true } },

  // Pre-commit checks for staged files.
  staged: {
    "*.{ts,tsx,js,mjs,json,md}": "vp check --fix",
  },
});
