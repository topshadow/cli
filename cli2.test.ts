import * as R from "jsr:@rambda/rambda@9.4.2";

const parseFilename = (args: string[]): string =>  R.unless(R.isNotNil,()=>{throw new Error("No filename provided")})(args[0])

Deno.test("parseFilename", () => {
  const result = parseFilename([]);
  console.log(result);
});