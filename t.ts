const a = (filename: string) =>
  filename ? filename : (() => {
    throw new Error("no filename");
  })();
