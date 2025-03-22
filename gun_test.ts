import { cli } from "jsr:@kazupon/gunshi";

const args = Deno.args;
// run a simple command
cli(args, () => {
  // something logic ...
  console.log("Hello from Gunshi!", args);
});
