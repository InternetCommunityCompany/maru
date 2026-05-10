import "@/assets/styles/tokens.css";
import "@/assets/styles/options.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { installWordmarkFont } from "@/assets/install-wordmark-font";
import { Options } from "@/ui/options/Options";

installWordmarkFont();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
