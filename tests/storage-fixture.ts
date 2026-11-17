import type { Page } from "@playwright/test";

// Seed at the browser storage boundary: no editing UI exists in this slice.
export async function seedBoard(page: Page, value: unknown) {
  await page.goto("/");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  await page.evaluate(async (board) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("doneward", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("boards", "readwrite");
        transaction.objectStore("boards").put(board, "current");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  }, value);
  await page.reload();
}
