// #935 spike — hono/jsx 가 자식 문자열을 기본으로 이스케이프하는지, raw() 는 그대로 내보내는지(대조군).
import { raw } from "hono/html";

const input = "<script>alert(1)</script>";
console.log(`child=${(<p>{input}</p>).toString()}`);
console.log(`attr=${(<p title={`"${input}`}>x</p>).toString()}`);
console.log(`raw=${(<p>{raw(input)}</p>).toString()}`);
