# Templ Go to Definition

This VSCode extension implements a definition provider that allows you to jump to the definition of a `templ` function definition from Go files.

If the function's definition is in a generated `*_templ.go` file, it searches for the `templ` function in the associated `.templ` file instead. All other definition lookups fallback to your other providers.

This extension is a workaround for https://github.com/a-h/templ/issues/387 where goToDefinition in vscode will take you to the generated go file instead of the `.templ` file's `templ` definition.

See also: https://github.com/templ-go/templ-vscode

Installation:

```
npm run package
```

Right click the vsix file in vscode and install.
