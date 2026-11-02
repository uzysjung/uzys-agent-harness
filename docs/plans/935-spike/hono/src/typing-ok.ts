// #935 spike — 라우트를 체이닝하면(서브앱 .route() 포함) testClient 에 경로 타입이 잡힌다. tsc 가 통과해야 한다.
import { Hono } from "hono";
import { testClient } from "hono/testing";

const items = new Hono().get("/search", (c) => c.html(`<li>${c.req.query("q") ?? ""}</li>`));
export const app = new Hono().route("/items", items);
export type AppType = typeof app;

export const ok = () => testClient(app).items.search.$get();
