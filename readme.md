
### **Zero-Code CLI Tool (or Interactive Shell) Creation**  
# Generate and Invoke CLI from Files/Modules via JSDoc  



English | [简体中文](./readme_zh.md)
### **Installation**  

deno install -A -g --name cli jsr:@24wings/cli/cli.ts


---


### **Example**  
Your code (`my_hello.ts`):  

// my_hello.ts
```typescript
/**
@param name  You can set the name you use.
*/
export function hello(name: string) {
  return { msg: `hello ${name}` };
}

/**
@param name  You can set the name you use (variant 2).
*/
export function hello2(name: string) {
  return { msg: `hello ${name}` };
}
  
**Note**: `@param name` is optional. If included, it becomes the parameter documentation (and CLI argument help text).  
```
---

### **Usage**  
#### **1. Run as CLI**  
```cmd
cli ./my-hello.ts --help
```
# Or launch interactive shell mode:
```cmd
cli ./my-hello.ts --shell --log
```
![hello.jpeg](./hello.jpeg)  
Lists all functions in the module as subcommands.  

#### **2. View Subcommand Help**  
```cmd
cli ./my-hello.ts hello --help
```
![hello-help.jpeg](./hello-help.jpeg)  

#### **3. Execute with Logging (`-log`)**  
`-log` is a built-in flag to print function results:  
```cmd
cli ./my-hello.ts hello --name zhangsan -log
```
![hello-exec-result.jpeg](./hello-exec-result.jpeg)  

#### **4. Use with JSR Modules**  
```cmd
cli jsr:@std/path dirname --help
```
![jsr-help.jpeg](./jsr-help.jpeg)  

---

### **How It Works**  
Converts module documentation (via `deno doc --json`) into CLI arguments using `gunshi`.  

---

### **Planned Features**  
- [x] Map optional parameters to CLI flags.  
- [ ] Support complex object parameters.  
- [ ] Output formats: JSON, XML, JSONL.  
- [ ] Structured logging (e.g., `logtap`-style).  
- [ ] Better integration with NuShell.  
- [x] Interactive shell mode.  
- [x] Auto-generated shorthand flags.  
- [ ]  load more modules ,complex ui  (app mode)

--- 

Let me know if you'd like any refinements!
