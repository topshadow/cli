import { parseArgs } from "jsr:@std/cli@1.0.14";
import {
  doc,
  DocNode,
  DocNodeFunction,
  JsDocTagNamed,
  JsDocTagNamedTyped,
  JsDocTagParam,
} from "jsr:@deno/doc@0.169.1";
import { cli } from "jsr:@kazupon/gunshi@0.8.0";
import type { ArgOptions, Command } from "jsr:@kazupon/gunshi@0.8.0";

import { resolve } from "jsr:@std/path@1.0.8";
let args = parseArgs(Deno.args);
// console.log(args);
let filename: string = args._[0] as string;
if (!filename) {
  throw new Error("please input filename or jsr package name");
}

// let data = await doc(
//   // new URL(resolve(import.meta.dirname as string, filename)).href,
//   filename,{}}
// );
const command = new Deno.Command("deno", {
  args: ["doc", "--json", filename],
  stdout: "piped",
  stderr: "piped",
});
const output = command.outputSync();
const outputText = new TextDecoder().decode(output.stdout);
let schema = JSON.parse(outputText) as Record<string, DocNode[]>;

let funcs = schema.nodes.filter((n) =>
  n.kind == "function"
) as DocNodeFunction[];

function functionNode2Log(func: DocNodeFunction): Command<any> {
  // console.log(`add subcommand:`, func.name);
  // builtin options such as `log`(print function response)
  let options: ArgOptions = { log: { type: "boolean" } };

  let usageOptions: Record<string, string> = {
    "log": "is print function result",
  };
  func.functionDef.params.forEach((p) => {
    options[p.name] = { type: p.tsType?.repr };
    if (func.jsDoc) {
      const tag = func.jsDoc?.tags.find((t) =>
        t.kind == "param" && t.name == p.name
      ) as JsDocTagParam;
      if (tag) {
        usageOptions[p.name] = tag.doc;
      }
    }
  });

  return {
    name: func.name,
    options,
    usage: { options: { ...usageOptions } },

    description: func.jsDoc?.doc,
    run: async (ctx) => {
      // console.log(fun);

      const mod = filename.startsWith("jsr:")
        ? await import(filename)
        : await import(`file://${resolve(Deno.cwd(), filename)}`);
      // console.log(ctx.values);
      // let u = `file://${resolve(Deno.cwd, filename)}`;
      // console.log(u);
      const ps = func.functionDef.params.map((p) => ctx.values[p.name]);
      // console.log("ps values:", ps);
      const callFunc = mod[func.name];
      // console.log(callFunc);
      let rtn = await (callFunc as Function).apply(null, ps);
      if (ctx.values.log) {
        console.log(rtn);
      }
    },
  };
}

const subCommands = new Map();
for (let func of funcs) {
  let cmd = functionNode2Log(func);
  subCommands.set(func.name, cmd);
}

const mainCommand = {
  name: filename,
  description: schema["nodes"].find((n) => n.kind == "moduleDoc")?.jsDoc.doc,
  run: () => {
    console.log(
      "Use one of the sub-commands: ",
      funcs.map((f) => f.name).join(","),
    );
  },
};
if (Deno.args.find((p) => p == "-q")) {
  cli(Deno.args.slice(1), mainCommand, {
    name: "my-app",
    version: "1.0.0",
    subCommands,
  });
} else {
  cli(Deno.args.slice(1), mainCommand, {
    name: "my-app",
    version: "1.0.0",
    subCommands,
  });
}
