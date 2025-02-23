/* @refresh reload */
import "@/styles";
import "@/libs/bootstrap.ts";

import App from "@/app.tsx";
import { render } from "solid-js/web";

const root = document.getElementById("root");

render(() => <App />, root!);
