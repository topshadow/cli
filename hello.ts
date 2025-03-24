/**
测试模块
@module test
*/

/**

@param name  you can set the name you use
say hello by name
*/
export function hello(name: string = "default username") {
  let str = `hello ${name}`;
  return { msg: str };
}

/**

@param name  you can set the name you use2
say hello by name
*/
export function hello2(name: string) {
  return `hello ${name}`;
}

/**
@param age  your age
*/
export function howOldAreYou(age: number) {
  return `your age is ${age}`;
}
