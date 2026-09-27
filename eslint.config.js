import js from "@eslint/js"
import jsdoc from "eslint-plugin-jsdoc"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

/**
 * ファイル直下の定数・型に JSDoc を求めるセレクタ。
 */
const fileLevelDocs = [
  "Program > VariableDeclaration",
  "ExportNamedDeclaration[declaration.type='VariableDeclaration']",
  "Program > TSTypeAliasDeclaration",
  "ExportNamedDeclaration[declaration.type='TSTypeAliasDeclaration']",
]

/**
 * JSDoc の共通ルール。
 */
const jsdocRules = {
  "jsdoc/require-jsdoc": [
    "error",
    {
      enableFixer: false,
      publicOnly: false,
      require: {
        ArrowFunctionExpression: false,
        ClassDeclaration: false,
        ClassExpression: false,
        FunctionDeclaration: true,
        FunctionExpression: false,
        MethodDefinition: false,
      },
      contexts: fileLevelDocs,
      checkConstructors: false,
      checkGetters: false,
      checkSetters: false,
    },
  ],
  "jsdoc/require-description": [
    "error",
    {
      contexts: [
        "FunctionDeclaration",
        "TSTypeAliasDeclaration",
        "VariableDeclaration",
      ],
    },
  ],
  "jsdoc/require-param": [
    "error",
    {
      checkDestructured: false,
      checkDestructuredRoots: true,
      checkRestProperty: false,
      unnamedRootBase: ["props"],
      enableFixer: false,
    },
  ],
  "jsdoc/require-param-description": "error",
  "jsdoc/require-param-name": "error",
  "jsdoc/check-param-names": [
    "error",
    {
      checkDestructured: false,
      disableExtraPropertyReporting: true,
    },
  ],
  "jsdoc/require-returns": [
    "error",
    {
      forceRequireReturn: true,
    },
  ],
  "jsdoc/require-param-type": "off",
  "jsdoc/require-returns-type": "off",
  "jsdoc/require-returns-description": "off",
  "jsdoc/no-undefined-types": "off",
}

/**
 * 直前の JSDoc 本文を返す。
 * @param sourceCode ESLint の sourceCode。
 * @param node 対象ノード。
 * @returns JSDoc 本文。なければ空。
 */
function jsdocText(sourceCode, node) {
  let target = node
  if (
    node.parent?.type === "ExportNamedDeclaration" ||
    node.parent?.type === "ExportDefaultDeclaration"
  ) {
    target = node.parent
  }
  const comments = sourceCode.getCommentsBefore(target)
  const block = [...comments]
    .reverse()
    .find((comment) => comment.type === "Block" && comment.value.startsWith("*"))
  return block ? block.value : ""
}

/**
 * 入れ子の関数を除き、値付き return があるか。
 * @param node 関数ノード。
 * @returns 戻り値があれば true。
 */
function returnsValue(node) {
  if (node.returnType?.typeAnnotation?.type === "TSVoidKeyword") {
    return false
  }
  let found = false
  /**
   * ノードをたどる。
   * @param current いまのノード。
   * @returns {void}
   */
  function visit(current) {
    if (!current || found || typeof current !== "object") return
    if (
      current !== node &&
      (current.type === "FunctionDeclaration" ||
        current.type === "FunctionExpression" ||
        current.type === "ArrowFunctionExpression")
    ) {
      return
    }
    if (current.type === "ReturnStatement" && current.argument) {
      found = true
      return
    }
    for (const key of Object.keys(current)) {
      if (key === "parent" || key === "range" || key === "loc") continue
      const child = current[key]
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === "object" && child.type) visit(child)
    }
  }
  visit(node.body)
  return found
}

/**
 * 戻り値がない関数に @returns {void} を求める。
 */
const slotlyJsdoc = {
  rules: {
    "void-returns": {
      meta: {
        type: "problem",
        docs: {
          description: "戻り値がない関数は @returns {void} と書く。",
        },
      },
      /**
       * ルール本体。
       * @param context ESLint の context。
       * @returns ビジター。
       */
      create(context) {
        /**
         * 関数宣言を調べる。
         * @param node 関数宣言。
         * @returns {void}
         */
        function check(node) {
          if (returnsValue(node)) return
          const text = jsdocText(context.sourceCode, node)
          if (!text) return
          if (!/@returns\s*\{void\}/.test(text)) {
            context.report({
              node,
              message: "戻り値がない関数は @returns {void} と書いてください。",
            })
          }
        }
        return { FunctionDeclaration: check }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(["dist", "gas-dist", "WebApp.html", "eslint.config.js"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      jsdoc,
      slotly: slotlyJsdoc,
    },
    rules: {
      ...jsdocRules,
      "slotly/void-returns": "error",
    },
  },
  {
    files: ["*.js", "tools/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: globals.node,
    },
    plugins: {
      jsdoc,
      slotly: slotlyJsdoc,
    },
    rules: {
      ...jsdocRules,
      "slotly/void-returns": "error",
    },
  },
  {
    files: ["tools/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
])
