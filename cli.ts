import { promptSelect } from "jsr:@std/cli@1.0.14/unstable-prompt-select";
import {
  // doc,

  DocNode,
  DocNodeFunction,
  FunctionDef,
  JsDocTagNamed,
  JsDocTagNamedTyped,
  JsDocTagParam,
  ParamAssignDef,
  ParamDef,
  ParamIdentifierDef,
  ParamRestDef,
  TsTypeDef,
} from "jsr:@deno/doc@0.169.1";
import { cli } from "jsr:@kazupon/gunshi@0.8.0";
import type {
  ArgOptions,
  ArgOptionSchema,
  Command,
} from "jsr:@kazupon/gunshi@0.8.0";
import {
  apply,
  filter,
  flatten,
  identity,
  ifElse,
  isNil,
  isNotNil,
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

/**
@type  ParamAssignDef   example
{
  kind: "assign",
  left: {
    kind: "identifier",
    name: "name",
    optional: false,
    tsType: { repr: "string", kind: "keyword", keyword: "string" }
  },
  right: "default username",
  tsType: null
}

*/
const tsParamTypeToCliType = (tstype?: TsTypeDef) => {
  if (tstype) {
    switch (tstype.repr.toLowerCase()) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "date":
        return "string";
      default:
        return "string";
    }
  } else {
    return "string";
  }
};
const funcParamToArgOptionSchema = (
  p: ParamDef,
): { argSchema: ArgOptionSchema; name?: string } => {
  if (p.kind === "assign") {
    const { left, right } = p as ParamAssignDef;
    console.log("left right:", left, right);
    if (left.kind == "identifier") {
      console.log(`left optional right`, left.optional, right);
      return {
        name: left.name,
        argSchema: {
          // has default value or not optional   will be need param
          required: (left.optional || isNotNil(right)) ? undefined : true,
          type: tsParamTypeToCliType(p.tsType),
          default: right,
          short: left.name.charAt[0],
        },
      };
    }
    // return {argSchema:{name:left.name,required:}}
  } else if (p.kind == "identifier") {
    return {
      name: p.name,
      argSchema: {
        type: tsParamTypeToCliType(p.tsType),
        required: p.optional ? undefined : true,
      } as ArgOptionSchema,
    };
  } else {
    throw new Error("not implements for arrary param  or complex param");
    return {};
  }
};

const readModuleFromUrl = (url) =>
  url.startsWith("jsr:")
    ? import(url)
    : import(`file://${resolve(Deno.cwd(), url)}`);

const funcToSubCommand = (
  filename: string,
  func: DocNodeFunction,
): Command<any> => {
  const options: ArgOptions = { log: { type: "boolean" } };
  const usageOptions: Record<
    string,
    string
  > = {
    "log": "is print function result?",
  };
  const params = func.functionDef.params as ParamIdentifierDef[];
  params.forEach((p) => {
    const { argSchema, name } = funcParamToArgOptionSchema(
      p,
    );

    options[name] = argSchema;
  });

  func.jsDoc?.tags?.filter((t) => t.kind == "param").forEach((t) =>
    usageOptions[t.name] = t.doc
  );
  console.log(options, usageOptions);
  return {
    name: func.name,
    options,
    usage: { options: { ...usageOptions } },

    description: func.jsDoc?.doc,
    run: async (ctx) => {
      const mod = await readModuleFromUrl(filename);
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
  const isShell = Deno.args.some((arg) => arg == "--shell");

  const isApp = Deno.args.some((arg) => arg == "--app");
  const isCli = !isShell && !isApp;
  if (isCli) makeCli(Deno.args);
  if (isShell) {
    makeInteractiveShell(Deno.args.filter((arg) => arg !== "--shell"));
  }
};

// cli mode
const makeCli = (args: string[]) => {
  const filename = parseFilename(args[0]);
  const schema = parseDocFromFile(filename);
  const mainCommand = createMainCommand(filename, schema);

  const subCommand: Map<string, Command> = pipe(
    findSchemaFuncs,
    map((f: DocNodeFunction) => funcToSubCommand(filename, f)),
    map((c: Command) => [c.name, c]),
    (f) => new Map(f),
  )(schema);
  cli(args.slice(1), mainCommand, {
    name: "app",
    version: "0.0.1",
    subCommands: subCommand,
  });
};

// interactive shell mode
const makeInteractiveShell = async (args: string[]) => {
  const filename = parseFilename(args[0]);

  const schema = parseDocFromFile(filename);
  const funcs = findSchemaFuncs(schema);
  const funcChoose = promptSelect(
    "choose function you want call",
    funcs.map((f) => f.name),
    { clear: true },
  ) as string;
  const func = funcs.find((f) => f.name == funcChoose);
  if (!func) throw new Error("please choose func");
  let callParamValues = [];
  const paramDoc = Object.entries(
    func.jsDoc?.tags?.filter((t) => t.kind == "param").map(
      (t) => [t.name, t.doc],
    ),
  );
  for (let p of func.functionDef.params) {
    //
    //
    if (p.kind == "identifier") {
      const pvalue = prompt(
        paramDoc[p.name] ? paramDoc[p.name] : "input param " + p.name,
      );
      callParamValues.push(pvalue);
    }
  }
  const mod = await readModuleFromUrl(filename);
  const result = await (mod[func.name] as Function).apply(
    null,
    callParamValues,
  );
  if (args.includes("--log")) {
    console.log(result);
  }
};

if (import.meta.main) {
  await main();
}
