import {
  doc,
  DocNode,
  DocNodeFunction,
  FunctionDef,
  JsDocTagNamed,
  JsDocTagNamedTyped,
  JsDocTagParam,
  ParamIdentifierDef,
  TsTypeDef,
} from "jsr:@deno/doc@0.169.1";
import { cli } from "jsr:@kazupon/gunshi@0.8.0";
import type { ArgOptions, Command } from "jsr:@kazupon/gunshi@0.8.0";
import {
  apply,
  filter,
  flatten,
  identity,
  ifElse,
  isNil,
  map,
  pipe,
  propIs,
  tryCatch,
  unless,
} from "jsr:@rambda/rambda@9.4.2";
import { resolve } from "jsr:@std/path@1.0.8";
const decoder = new TextDecoder();
const parseFilename = ifElse(isNil, () => {
  throw new Error("filename must point");
}, identity);
type ISchema = Record<string, DocNode[]>;
const parseDocFromFile = (filename: string) => {
  console.log(filename);
  return JSON.parse(decoder.decode(
    new Deno.Command("deno", {
      args: ["doc", "--json", filename],
      stdout: "piped",
      stderr: "piped",
    }).outputSync().stdout,
  )) as ISchema;
};
const findSchemaFuncs = (s: ISchema) =>
  s["nodes"].filter((n) => n.kind == "function") as DocNodeFunction[];
// todo add more type such as boolean,select
const tsParamTypeToCliType = (tstype?: TsTypeDef) =>
  tstype ? (tstype.repr == "string" ? "string" : "number") : "string";
const funcToSubCommand = (
  filename: string,
  func: DocNodeFunction,
): Command<any> => {
  const options: ArgOptions = { log: { type: "boolean" } };
  const usageOptions: Record<
    string,
    string
  > = {
    "log": "is print function result",
  };

  (func.functionDef.params as ParamIdentifierDef[]).forEach((p) => {
    options[p.name] = { type: tsParamTypeToCliType(p.tsType) };
    if (func.jsDoc) {
      const tag = func.jsDoc?.tags?.find((t) =>
        t.kind == "param" && t.name == p.name
      ) as JsDocTagParam;
      if (tag) {
        usageOptions[p.name] = tag.doc || "";
      }
    }
  });

  return {
    name: func.name,
    options,
    usage: { options: { ...usageOptions } },

    description: func.jsDoc?.doc,
    run: async (ctx) => {
      const mod = filename.startsWith("jsr:")
        ? await import(filename)
        : await import(`file://${resolve(Deno.cwd(), filename)}`);
      const ps = (func.functionDef.params as ParamIdentifierDef[]).map((p) =>
        ctx.values[p.name]
      );
      const callFunc = mod[func.name];
      let rtn = await (callFunc as Function).apply(null, ps);
      if (ctx.values.log) {
        console.log(rtn);
      }
    },
  };
};

const createMainCommand = (
  filename: string,
  schema: ISchema,
): Command<any> => {
  return {
    name: filename,
    description: schema["nodes"].find((n) => n.kind == "moduleDoc")?.jsDoc.doc,
    run: () => {
      console.log(
        "Use one of the sub-commands: ",
        findSchemaFuncs(schema).map((f: DocNodeFunction) => f.name).join(","),
      );
    },
  };
};
export const main = () => {
  const filename = parseFilename(Deno.args[0]);
  const schema = parseDocFromFile(filename);
  const mainCommand = pipe(
    (f) => [f, schema],
    apply(createMainCommand),
  )(filename);

  const subCommand = pipe(
    findSchemaFuncs,
    map((f) => funcToSubCommand(filename, f)),
    map((c: Command) => [c.name, c]),
    (f) => new Map(f),
  )(schema);
  cli(Deno.args.slice(1), mainCommand, {
    name: "app",
    version: "0.0.1",
    subCommands: subCommand,
  });
};

if (import.meta.main) {
  await main();
}
