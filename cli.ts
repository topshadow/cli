import { promptSelect } from "jsr:@std/cli@1.0.14/unstable-prompt-select";
import { type DocWithFuns, type Func, parseDoc } from "./parseDoc.ts";
import { cli } from "jsr:@kazupon/gunshi@0.8.0";
import type { ArgOptions, Command } from "jsr:@kazupon/gunshi@0.8.0";
import { identity, ifElse, isNil } from "jsr:@rambda/rambda@9.4.2";
import { resolve } from "jsr:@std/path@1.0.8";
const parseFilename = ifElse(isNil, () => {
  throw new Error("filename must point");
}, identity);

const readModuleFromUrl = (url: string) =>
  url.startsWith("jsr:")
    ? import(url)
    : import(`file://${resolve(Deno.cwd(), url)}`);

const funcToSubCommand = (func: Func, doc: DocWithFuns): Command => {
  const options: ArgOptions = { log: { type: "boolean" } };
  const usageOptions: Record<
    string,
    string
  > = {
    "log": "is print function result?",
  };

  func.params.forEach((p) => {
    options[p.name] = {
      type: p.type || "string",
      required: p.required ? p.required : undefined,
      short: p.name.charAt(0),
    };

    usageOptions[p.name] = p.doc || "";
  });
  return {
    name: func.name,
    options,
    usage: { options: { ...usageOptions } },

    description: func.doc,
    run: async (ctx) => {
      const mod = await readModuleFromUrl(doc.url);
      const ps = func.params.map((p) => ctx.values[p.name]);

      const callFunc = mod[func.name];
      const rtn = await (callFunc as Function).apply(null, ps);
      if (ctx.values.log) {
        console.log(rtn);
      }
    },
  };
};

const createMainCommand = (
  doc: DocWithFuns,
): Command => {
  return {
    name: doc.url,
    description: doc.doc,
    run: () =>
      console.log(
        "Use one of the sub-commands: ",
        doc.funcs.map((f) => f.name).join(","),
      ),
  };
};
export const main = async () => {
  const isShell = Deno.args.some((arg) => arg == "--shell");

  const isApp = Deno.args.some((arg) => arg == "--app");
  const isCli = !isShell && !isApp;
  if (isCli) await makeCli(Deno.args);
  if (isShell) {
    await makeInteractiveShell(Deno.args.filter((arg) => arg !== "--shell"));
  }
};

// cli mode
export const makeCli = async (args: string[]) => {
  const filename = parseFilename(args[0]);
  const doc = await parseDoc(filename);
  const mainCommand = createMainCommand(doc);
  const subCommand: Map<string, Command> = new Map();
  doc.funcs.forEach((f) => subCommand.set(f.name, funcToSubCommand(f, doc)));
  cli(args.slice(1), mainCommand, {
    name: "app",
    version: "0.0.1",
    subCommands: subCommand,
  });
};

// interactive shell mode
export const makeInteractiveShell = async (args: string[]) => {
  const filename = parseFilename(args[0]);

  const doc = await parseDoc(filename);
  // console.log(doc);
  const funcChoose = promptSelect(
    "choose function you want call",
    doc.funcs.map((f) => f.name),
    { clear: true },
  ) as string;
  const func = doc.funcs.find((f) => f.name == funcChoose);
  if (!func) throw new Error("please choose func");
  const callParamValues: unknown[] = [];
  for (const p of func.params) {
    const tip = (p.doc || "input param " + p.name) +
      ` (${p.required ? "required" : "optional"})`;
    if (p.type == "boolean") {
      callParamValues.push(confirm(tip));
    } else {
      let pvalue: unknown = prompt(tip);
      pvalue = pvalue || p.defaultValue;
      switch (p.type) {
        case "number":
          pvalue = Number(pvalue);
          break;
        case "Date":
          pvalue = new Date(pvalue as string);
          break;
        default:
          break;
      }
      callParamValues.push(pvalue);
    }
  }
  const mod = await readModuleFromUrl(filename);
  // deno-lint-ignore ban-types
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
