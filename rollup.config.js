import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

const config = {
  input: ["./src/index.ts"],
  output: [
    {
      file: "build/index.cjs.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "build/index.esm.js",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "build",
      exclude: ["**/*.test.*", "**/*.stories.*", "./src/test-utils/*"],
    }),
  ],
  external: ["react", "react-dom"],
};

export default config;