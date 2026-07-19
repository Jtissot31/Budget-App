import assert from 'node:assert/strict';
import { createAbortError, isAbortError } from './abortError';

const abortError = createAbortError();
assert.equal(abortError.name, 'AbortError');
assert.equal(isAbortError(abortError), true);

const genericError = new Error('network failed');
assert.equal(isAbortError(genericError), false);
assert.equal(isAbortError(null), false);
