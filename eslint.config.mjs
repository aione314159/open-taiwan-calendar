import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

// The Obsidian preset is what the community-plugin review runs, so it is kept
// as the base and only extended below. main.js is the esbuild bundle: linting
// generated third-party code says nothing about this plugin's own source.
export default tseslint.config(
  { ignores: ["main.js", "dist/**", "node_modules/**"] },
  ...obsidianmd.configs.recommended,
  {
    // Obsidian's own API hands out moment objects and this plugin imports
    // `moment/locale/zh-tw` for the Chinese weekday names, so moment is not a
    // dependency that can be swapped for a smaller date library. The generic
    // "prefer something else" advice does not apply inside an Obsidian plugin.
    files: ["package.json"],
    rules: { "depend/ban-dependencies": "off" },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      // Imports are written against tsconfig's baseUrl ("src/i18n" and the
      // like), so the resolver has to read the same tsconfig or every one of
      // them looks unresolved
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ project: "./tsconfig.json" }),
      ],
    },
    rules: {
      // A cycle between modules survives type checking and only shows up at
      // runtime as an undefined import, so it is an error rather than a warning
      "import-x/no-cycle": ["error", { maxDepth: 10 }],
    },
  }
);
