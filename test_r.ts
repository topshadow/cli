import { compose, filter, map, pipe, sortBy } from "jsr:@rambda/rambda@9.4.2";
const result = compose(
  map((x) => x * 2),
  filter((x) => x > 2),
)([1, 2, 3, 4]);
console.log(result);

let result2 = pipe(
  () => 1,
  (i) => i + "1",
  (a) => a,
  async () => await new Promise((r) => r(4)) as Promise<number>,
  // async (d) => await d,
  (e) => e,
);
console.log(await result2());
// sortBy
