// Gera tests/fixtures/sample.srt com BOM e CRLF — características que um
// editor de texto normal não preserva e que o parser precisa suportar.
import { writeFileSync } from "node:fs";

const lines = [
  "1",
  "00:00:01,000 --> 00:00:03,500",
  "All right, so here we are.",
  "",
  "2",
  "00:00:03,500 --> 00:00:06,000",
  "In front of the <i>elephants</i>.",
  "",
  "3",
  "00:00:06,000 --> 00:00:09,200",
  String.raw`{\an8}The cool thing about these guys`,
  "is that they have really long trunks.",
  "",
  "4",
  "00:00:09,200 --> 00:00:11,000",
  'Jack &amp; Jill said "hi".',
  "",
];

writeFileSync(
  new URL("./sample.srt", import.meta.url),
  "﻿" + lines.join("\r\n"),
);
