/** Location of normal generated test bundles; no implementation substitution. */
import path from 'node:path';
export const frontendRuntimeRoot = () => path.resolve(process.env.HWS_UI_RUNTIME_ROOT ?? '.local/frontend');
export const frontendRuntime = (name='ui-runtime.mjs') => path.join(frontendRuntimeRoot(),name);
