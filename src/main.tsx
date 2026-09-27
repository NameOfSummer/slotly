import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "@/App.tsx"
import { installPreviewApi } from "@/lib/preview-api"
import "./index.css"
import "./fonts.css"

installPreviewApi()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
