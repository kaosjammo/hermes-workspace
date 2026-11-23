/** Keep CommonJS dependencies on Hermes's ESM-provided React singleton. */
export function sharedReact() {
  return {
    name: 'workspace-shared-react',
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, args => args.kind === 'require-call'
        ? { path: 'react', namespace: 'workspace-shared-react' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'workspace-shared-react' }, () => ({
        contents: 'import * as React from "react"; module.exports = React;',
        loader: 'js',
      }));
    },
  };
}
