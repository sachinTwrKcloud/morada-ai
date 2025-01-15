import jsEslint from "@eslint/js";
import tsEslint from "typescript-eslint";
import stylisticTs from "@stylistic/eslint-plugin-ts";

export default tsEslint.config(
    {
        ignores: ["dist", ".pnp.*"],
    },
    jsEslint.configs.recommended,
    stylisticTs.configs["all-flat"],
    ...tsEslint.configs.recommended,
    {
        rules: {
            // Styles @see https://eslint.style/packages/ts
            "@stylistic/ts/object-curly-spacing": ["error", "always"],
            "@stylistic/ts/comma-dangle": ["error", "always-multiline"],
            "@stylistic/ts/quote-props": ["error", "as-needed"],
            "@/no-trailing-spaces": "error",
        },
    },
);