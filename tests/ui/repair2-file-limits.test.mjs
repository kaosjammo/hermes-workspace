import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileBase64,
  backupFileBase64,
  MAX_BACKUP_FILE_BYTES,
} from "../../frontend/editor.mjs";
test("backup file reader has its own exact full-archive bound; ordinary readers retain 20MiB", async () => {
  const original = globalThis.FileReader;
  let reads = 0;
  globalThis.FileReader = class {
    readAsDataURL() {
      reads++;
      this.result = "data:application/zip;base64,YQ==";
      this.onload();
    }
  };
  try {
    assert.equal(MAX_BACKUP_FILE_BYTES, 64_069_632);
    assert.equal(await backupFileBase64({ size: 25_192_315 }), "YQ==");
    assert.equal(await backupFileBase64({ size: 64_069_632 }), "YQ==");
    assert.equal(reads, 2);
    await assert.rejects(backupFileBase64({ size: 64_069_633 }), /64,069,632/);
    await assert.rejects(fileBase64({ size: 20 * 1024 * 1024 + 1 }), /20 MB/);
    assert.equal(reads, 2);
    assert.equal(await fileBase64({ size: 20 * 1024 * 1024 }), "YQ==");
  } finally {
    globalThis.FileReader = original;
  }
});
