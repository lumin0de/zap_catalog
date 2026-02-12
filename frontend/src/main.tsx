import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/montserrat/400.css"
import "@fontsource/montserrat/500.css"
import "@fontsource/montserrat/600.css"
import "@fontsource/montserrat/700.css"
import "@fontsource/merriweather/400.css"
import "@fontsource/merriweather/700.css"
import "@fontsource/source-code-pro/400.css"
import "./index.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
