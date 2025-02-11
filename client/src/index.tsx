/* @refresh reload */
import { render } from "solid-js/web";
import App from "./app.tsx";
import "@picocss/pico/css/pico.blue.css";
import "./global.css";

const root = document.getElementById("root");

render(() => <App />, root!);
