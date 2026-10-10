import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // Every page and layout here is an async Server Component that runs once
    // per request, so reading the clock in one is not the unstable re-render
    // the purity rule is guarding against. Client components keep the rule.
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
