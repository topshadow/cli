import type { DocNode, DocNodeFunction, ParamDef } from "jsr:@deno/doc@0.169.1";
const decoder = new TextDecoder();
const parseDocFromFile = (filename: string) => {
  if (!filename) throw new Error("please input filename");
  return JSON.parse(decoder.decode(
    new Deno.Command("deno", {
      args: ["doc", "--json", filename],
      stdout: "piped",
      stderr: "piped",
    }).outputSync().stdout,
  )) as ISchema;
};
export type ISchema = { nodes: DocNode[] };
export type Func = {
  name: string;
  modName: string;
  params: FuncParam[];
  doc?: string;
};
export type FuncParam = {
  name: string;
  required: boolean;
  doc?: string;
  type?: string;
  isArray: boolean;
  isObject: boolean;
  isGeneric: boolean;
  defaultValue?: any;
};
export type DocWithFuns = {
  url: string;
  funcs: Func[];
  subModules: any[];
  doc?: string;
};

export const parseDoc = async (url): Promise<DocWithFuns> => {
  const schema = parseDocFromFile(url);
  const moduleDoc = schema.nodes.find((n) => n.kind == "moduleDoc")?.jsDoc.doc;
  const funcs = schema.nodes.filter((n) => n.kind == "function").map(
    docNodeFunToFunc,
  );
  return { url, funcs, subModules: [], doc: moduleDoc };
};

export const docNodeFunToFunc = (docfun: DocNodeFunction): Func => {
  const params = docfun.functionDef.params.map((p) =>
    docNodeParamToFuncParam(p, docfun)
  );

  return { name: docfun.name, params, doc: docfun.jsDoc?.doc };
};

export const docNodeParamToFuncParam = (
  docParam: ParamDef,
  docFun: DocNodeFunction,
): FuncParam => {
  // read  param name    has diffrent situation
  // when  param.kind  is identifier    read  param.name
  // when param.kind  is 'assign'  read param.left.name  and param right is  param default value
  if (docParam.kind == "identifier") {
    const doc = docFun.jsDoc?.tags?.filter((t) => t.kind == "param").find((t) =>
      t.name == docParam.name
    )?.doc;
    return {
      name: docParam.name,
      doc,
      required: !docParam.optional,
      isArray: false,
      isObject: false,
      isGeneric: false,
      defaultValue: undefined,
      type: docParam.tsType?.repr,
    };
  } else if (docParam.kind == "assign") {
    const { left, right } = docParam;
    // console.log("left", left);
    if (left.kind == "identifier") {
      const doc = docFun.jsDoc?.tags?.filter((t) => t.kind == "param").find(
        (t) => t.name == left.name,
      )?.doc;
      return {
        name: left.name,
        doc,
        required: !left.optional && !right,
        defaultValue: right,
        type: left.tsType?.repr,
        isGeneric: false,
        isObject: false,
        isArray: false,
      };
    } else {
      throw new Error("not implement for param type: " + docParam.kind);
    }
  } else {
    throw new Error("not implement for param type:" + docParam.kind);
  }
};
/**
  ParamAssignDef   example
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
