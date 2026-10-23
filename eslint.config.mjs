import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";

export default [
  {ignores:[".next/**","node_modules/**","scratch/**","seed/**"]},
  {files:["src/**/*.{ts,tsx}"],languageOptions:{parser:tsParser,parserOptions:{ecmaFeatures:{jsx:true},sourceType:"module"}},
    plugins:{"@typescript-eslint":ts,"react-hooks":hooks},
    rules:{...ts.configs.recommended.rules,"@typescript-eslint/no-explicit-any":"off","@typescript-eslint/no-unused-vars":["error",{argsIgnorePattern:"^_",varsIgnorePattern:"^_"}],"react-hooks/rules-of-hooks":"error","react-hooks/exhaustive-deps":"warn"}}
];
