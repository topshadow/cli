import type{ DocNode, DocNodeFunction, JsDocTagParam } from "jsr:@deno/doc@0.169.1";
import { cli } from "jsr:@kazupon/gunshi@0.8.0";
import type { ArgOptions, Command } from "jsr:@kazupon/gunshi@0.8.0";
import { resolve } from "jsr:@std/path@1.0.8";
import * as R from "jsr:@rambda/rambda@9.4.2";

const {unless,isNotNil,ifElse,identity}=R;
// import * as R from "https://deno.land/x/ramda@v0.27.2/mod.ts";


const decoder=new TextDecoder()
const parseFilename =  ifElse(R.isNil,()=>{throw new Error("No filename provided")},identity);
type ISchema=Record<string,DocNode[]>;
const getSchema = (filename: string): ISchema => JSON.parse(decoder.decode(new Deno.Command("deno", {
    args: ["doc", "--json", filename],
    stdout: "piped",
    stderr: "piped",
  }).outputSync().stdout)) as ISchema;

const createUsageOptions = (
  paramName: string,
  tags: JsDocTagParam[],
): string => tags.find((t) => t.name === paramName)?.doc || "";

const buildOptions = (
  func: DocNodeFunction,
): [ArgOptions, Record<string, string>] =>
  func.functionDef.params.reduce(
    ([options, usageOptions], param) => {
      const paramDoc = func.jsDoc?.tags
        ? createUsageOptions(
          param.name,
          func.jsDoc.tags.filter((t): t is JsDocTagParam => t.kind === "param"),
        )
        : "";
      return [
        { ...options, [param.name]: { type: param.tsType?.repr } },
        { ...usageOptions, [param.name]: paramDoc },
      ];
    },
    [{ log: { type: "boolean" } }, { log: "Print function result" }] as [
      ArgOptions,
      Record<string, string>,
    ],
  );

const createCommand =
  // deno-lint-ignore no-explicit-any
  (filename: string) => (func: DocNodeFunction): Command<any> => {
    const [options, usageOptions] = buildOptions(func);

    return {
      name: func.name,
      options,
      usage: { options: usageOptions },
      description: func.jsDoc?.doc,
      run: async (ctx) => {
        const mod =
          await (filename.startsWith("jsr:")
            ? import(filename)
            : import(`file://${resolve(Deno.cwd(), filename)}`));

        const result = await (mod[func.name] as Function)(
          ...func.functionDef.params.map((p) => ctx.values[p.name]),
        );
        if (ctx.values.log) console.log(result);
      },
    };
  };

const getMainCommand = (
  schema: Record<string, DocNode[]>,
  filename: string,
) => ({
  name: filename,
  description: schema.nodes.find((n) => n.kind === "moduleDoc")?.jsDoc.doc,
  run: () =>
    console.log(
      "Available sub-commands:",
      schema.nodes
        .filter((n): n is DocNodeFunction => n.kind === "function")
        .map((f) => f.name).join(", "),
    ),
});
const funcsToSubCommands= (filename:string)=> R.pipe(
  R.map(createCommand(filename)),
  R.map((cmd)=>[cmd.name,cmd] as [string,Command])
  ,R.fromPairs,p=>new Map(Object.entries(p) as any as Map<string,Command>)
)
const main = async () => {
  const filename = parseFilename(Deno.args[0]);
  const schema = getSchema(filename);
  const funcs = schema.nodes.filter((n): n is DocNodeFunction =>
    n.kind === "function"
  );

  const subCommands = new Map();
  for (let sc of funcs.map(createCommand(filename))) {
    subCommands.set(sc.name, sc);
  }

  const mainCommand = getMainCommand(schema, filename);

  cli(Deno.args.slice(1), mainCommand, {
    name: "my-app",
    version: "1.0.0",
    subCommands:funcsToSubCommands(filename)(funcs),
  });
};

await main();
