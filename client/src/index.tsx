/* @refresh reload */
import { render } from "solid-js/web";
import App from "./app.tsx";
import "./styles";
import "bootstrap/dist/js/bootstrap.js";

const root = document.getElementById("root");

render(() => <App />, root!);
