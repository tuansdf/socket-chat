import { Navigate, Router as ARouter } from "@solidjs/router";
import { lazy } from "solid-js";

const routes = [
  {
    path: "/",
    component: lazy(() => import("./pages/index.page.tsx")),
  },
  {
    path: "/chat/:roomId",
    component: lazy(() => import("./pages/chat.page.tsx")),
  },
  {
    path: "/*",
    component: () => <Navigate href="/" />,
  },
];

export const Router = () => {
  return <ARouter>{routes}</ARouter>;
};
