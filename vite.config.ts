import fs from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * この設定ファイルがあるディレクトリ。
 */
const root = import.meta.dirname
/**
 * GAS の画面で読み込むフォントの CSS。
 */
const fontLinks = [
  "https://cdn.jsdelivr.net/npm/@fontsource/line-seed-jp@5.3.1/400.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/line-seed-jp@5.3.1/700.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/line-seed-jp@5.3.1/800.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/poiret-one@5.3.0/index.css",
]

export default defineConfig(({ mode }) => {
  const gas = mode === "gas"
  return {
    base: gas ? "./" : "/",
    plugins: [react(), tailwindcss(), gas ? gasHtmlPlugin(root) : null].filter(
      (plugin) => plugin !== null
    ),
    resolve: {
      alias: [{ find: "@", replacement: path.resolve(root, "src") }],
    },
    server: {
      host: "127.0.0.1",
      port: 3456,
    },
    build: gas
      ? {
          outDir: "gas-dist",
          emptyOutDir: true,
          cssCodeSplit: false,
          assetsInlineLimit: 1024 * 1024,
        }
      : undefined,
  }
})

/**
 * GAS 向けビルドで、HTML を1枚にまとめる。
 * @param projectRoot リポジトリのルート。
 * @returns Vite のプラグイン。
 */
function gasHtmlPlugin(projectRoot: string): Plugin {
  return {
    name: "gas-html",
    apply: "build",
    enforce: "pre",
    resolveId(source) {
      if (source === "./fonts.css" || source.endsWith("/fonts.css")) {
        return path.resolve(projectRoot, "src/fonts-gas.css")
      }
      return null
    },
    transformIndexHtml(html) {
      const links = fontLinks
        .map((href) => `    <link rel="stylesheet" href="${href}" />`)
        .join("\n")
      return html
        .replace(/\s*<link rel="icon"[^>]*>\s*/i, "\n")
        .replace(/<title>[\s\S]*?<\/title>/, "<title><?!= pageTitle ?></title>")
        .replace(
          /<script id="bootstrap"[^>]*>[\s\S]*?<\/script>/,
          '<script id="bootstrap" type="application/json"><?!= bootstrapJson ?></script>'
        )
        .replace("</head>", `${links}\n  </head>`)
    },
    closeBundle() {
      const outDir = path.resolve(projectRoot, "gas-dist")
      const htmlPath = path.join(outDir, "index.html")
      if (!fs.existsSync(htmlPath)) {
        return
      }
      const html = inlineBuiltHtml(fs.readFileSync(htmlPath, "utf8"), outDir)
      fs.writeFileSync(path.resolve(projectRoot, "WebApp.html"), html)
    },
  }
}

/**
 * ビルド結果の CSS とスクリプトを HTML に埋め込む。
 * @param html ビルドされた HTML。
 * @param outDir ビルド出力ディレクトリ。
 * @returns 1枚にまとめた HTML。
 */
function inlineBuiltHtml(html: string, outDir: string): string {
  let script = ""
  let next = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
  next = next.replace(
    /<link rel="stylesheet"(?![^>]*https?:)[^>]*href="([^"]+)"[^>]*>/g,
    (_match, href: string) => {
      const css = readBuiltFile(outDir, href).replace(/<\/style/gi, "<\\/style")
      return `<style>${css}</style>`
    }
  )
  next = next.replace(
    /<script type="module"[^>]*src="([^"]+)"><\/script>\s*/g,
    (_match, href: string) => {
      script = `<script>${escapeForGasScript(readBuiltFile(outDir, href))}</script>`
      return ""
    }
  )
  if (script) {
    next = next.replace("</body>", () => `${script}\n  </body>`)
  }
  return next
}

/**
 * Apps Script が // を行コメントとして切らないよう、スラッシュをエスケープする。
 * @param js 埋め込むスクリプト。
 * @returns 画面に載せられるスクリプト。
 */
function escapeForGasScript(js: string): string {
  return js
    .replace(/<\/script/gi, "<\\/script")
    .replace(/(^|[^\\])\/\//g, "$1\\/\\/")
}

/**
 * ビルド出力から、HTML が参照するファイルを読む。
 * @param outDir ビルド出力ディレクトリ。
 * @param href HTML 内の参照パス。
 * @returns ファイルの中身。
 */
function readBuiltFile(outDir: string, href: string): string {
  const relative = href.replace(/^\.\//, "").replace(/^\//, "")
  return fs.readFileSync(path.join(outDir, relative), "utf8")
}
