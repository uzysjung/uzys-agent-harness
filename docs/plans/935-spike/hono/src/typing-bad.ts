// #935 spike — 라우트를 따로 등록하면(체이닝 없음) testClient 에 경로 타입이 없다. tsc 가 아래 두 줄에서 실패해야 한다.
import { Hono } from "hono";
import { testClient } from "hono/testing";

const items = new Hono();
items.get("/search", (c) => c.html("<li></li>"));
const app = new Hono();
app.route("/items", new Hono().get("/search", (c) => c.html("<li></li>")));

export const badSeparate = () => testClient(items).search.$get();
export const badMount = () => testClient(app).items.search.$get();
