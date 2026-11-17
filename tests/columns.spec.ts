import { expect, test } from "@playwright/test";
import { seedBoard } from "./storage-fixture";
import AxeBuilder from "@axe-core/playwright";

const populatedBoard = {
  version: 1,
  columns: [
    {
      id: "source",
      name: "بررسی https://example.com (42)",
      cards: [
        {
          id: "a",
          title: "نسخه UI 42",
          description:
            "  فارسی UI.\nEnglish https://example.com (7).\n\nپایان!  ",
        },
        { id: "b", title: "Next قدم 2", description: "<b>Plain text</b>" },
      ],
    },
    {
      id: "destination",
      name: "Queue صف 3",
      cards: [{ id: "c", title: "Already here" }],
    },
    { id: "empty", name: "Empty", cards: [] },
  ],
};

for (const action of ["transfer", "delete all"]) {
  test(`keyboard-only ${action} supports choice, cancellation, confirmation, and focus return`, async ({
    page,
  }) => {
    await seedBoard(page, populatedBoard);
    const source = page.getByRole("region", {
      name: "بررسی https://example.com (42)",
      exact: true,
    });
    for (const cancel of [true, false]) {
      await source.getByLabel("Column actions", { exact: true }).press("Enter");
      await page.keyboard.press("Tab");
      await expect(
        source.getByRole("button", { name: "Rename column", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        source.getByRole("button", { name: "Delete column", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", {
        name: "Delete column?",
        exact: true,
      });
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole("radio", {
          name: "Move cards to another column",
          exact: true,
        })
      ).toBeFocused();
      await page.keyboard.press("Space");
      if (action === "transfer") {
        await page.keyboard.press("Tab");
        await expect(
          dialog.getByLabel("Destination column", { exact: true })
        ).toBeFocused();
        // Native type-to-select avoids relying on macOS popup automation.
        await page.keyboard.press("2");
        await expect(
          dialog.getByLabel("Destination column", { exact: true })
        ).toHaveValue("destination");
      } else {
        await page.keyboard.press("ArrowRight");
        await expect(
          dialog.getByRole("radio", {
            name: "Delete column and all its cards",
            exact: true,
          })
        ).toBeChecked();
      }
      if (cancel) {
        await page.keyboard.press("Escape");
        await expect(
          source.getByLabel("Column actions", { exact: true })
        ).toBeFocused();
        await expect(source.getByRole("article")).toHaveCount(2);
      } else {
        await page.keyboard.press("Tab");
        await expect(
          dialog.getByRole("button", { name: "Cancel", exact: true })
        ).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(
          dialog.getByRole("button", { name: "Delete column", exact: true })
        ).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("status")).toHaveText(
          "Saved on this device"
        );
        const target =
          action === "transfer"
            ? page
                .getByRole("region", { name: "Queue صف 3", exact: true })
                .getByLabel("Column actions", { exact: true })
            : page.getByRole("button", { name: "Add column", exact: true });
        await expect(target).toBeFocused();
      }
    }
    await page.reload();
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(
      action === "transfer"
        ? ["Already here", "نسخه UI 42", "Next قدم 2"]
        : ["Already here"]
    );
  });
}

test("column dialogs and transferred mixed-direction content stay accessible in both themes and narrow layouts", async ({
  page,
}) => {
  await seedBoard(page, populatedBoard);
  const source = page.getByRole("region", {
    name: "بررسی https://example.com (42)",
    exact: true,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await source.getByLabel("Column actions", { exact: true }).press("Enter");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await source
        .getByRole("button", { name: "Rename column", exact: true })
        .press("Enter");
      const rename = page.getByRole("dialog", { name: "Rename column" });
      await expect(rename.getByLabel("Column name", { exact: true })).toHaveCSS(
        "direction",
        "rtl"
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(rename).toHaveScreenshot(
        `rename-${width}-${colorScheme}.png`
      );
      await rename.getByRole("button", { name: "Save", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(
        rename.getByRole("button", { name: "Close", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(
        source.getByLabel("Column actions", { exact: true })
      ).toBeFocused();
      await source.getByLabel("Column actions", { exact: true }).press("Enter");
      await source
        .getByRole("button", { name: "Delete column", exact: true })
        .press("Enter");
      const deletion = page.getByRole("dialog", {
        name: "Delete column?",
        exact: true,
      });
      await deletion
        .getByRole("radio", {
          name: "Move cards to another column",
          exact: true,
        })
        .check();
      await deletion
        .getByLabel("Destination column", { exact: true })
        .selectOption({ label: "2. Queue صف 3" });
      await expect(deletion.locator("bdi")).toHaveCSS("direction", "rtl");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(deletion).toHaveScreenshot(
        `deletion-${width}-${colorScheme}.png`
      );
      await deletion
        .getByRole("button", { name: "Delete column", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      await expect(
        deletion.getByRole("radio", {
          name: "Move cards to another column",
          exact: true,
        })
      ).toBeFocused();
      await page.keyboard.press("Escape");
    }
  }
  await source.getByLabel("Column actions", { exact: true }).press("Enter");
  await source
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  const deletion = page.getByRole("dialog", {
    name: "Delete column?",
    exact: true,
  });
  await deletion
    .getByRole("radio", { name: "Move cards to another column", exact: true })
    .check();
  await deletion
    .getByLabel("Destination column", { exact: true })
    .selectOption({ label: "2. Queue صف 3" });
  await deletion
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  const destination = page.getByRole("region", {
    name: "Queue صف 3",
    exact: true,
  });
  const paragraphs = destination.getByRole("article").nth(1).locator("p");
  await expect(paragraphs.nth(0)).toHaveCSS("direction", "rtl");
  await expect(paragraphs.nth(1)).toHaveCSS("direction", "ltr");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(page.getByRole("main")).toHaveScreenshot(
        `transferred-${width}-${colorScheme}.png`
      );
    }
  }
});

test("column name drafts can be cancelled without changing saved data", async ({
  page,
}) => {
  await page.goto("/");
  const add = page.getByRole("button", { name: "Add column", exact: true });
  await add.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New column" });
  await dialog.getByLabel("Column name", { exact: true }).fill("Unsaved");
  await dialog
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await expect(add).toBeFocused();
  const source = page.getByRole("region", { name: "Todo", exact: true });
  await source.getByLabel("Column actions", { exact: true }).press("Enter");
  await source
    .getByRole("button", { name: "Rename column", exact: true })
    .press("Enter");
  await page.getByLabel("Column name", { exact: true }).fill("Also unsaved");
  await page.getByRole("button", { name: "Close", exact: true }).press("Enter");
  await expect(
    source.getByLabel("Column actions", { exact: true })
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
});

test.describe("touch column controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("adding, renaming, and deleting remain usable on a horizontally scrolling board", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add column", exact: true }).tap();
    await page.getByLabel("Column name", { exact: true }).fill("Touch column");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    const column = page.getByRole("region", {
      name: "Touch column",
      exact: true,
    });
    await column.getByLabel("Column actions", { exact: true }).tap();
    await column
      .getByRole("button", { name: "Rename column", exact: true })
      .tap();
    await page
      .getByLabel("Column name", { exact: true })
      .fill("Renamed by touch");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    const renamed = page.getByRole("region", {
      name: "Renamed by touch",
      exact: true,
    });
    await renamed.getByLabel("Column actions", { exact: true }).tap();
    await renamed
      .getByRole("button", { name: "Delete column", exact: true })
      .tap();
    await page
      .getByRole("dialog", { name: "Delete column?", exact: true })
      .getByRole("button", { name: "Delete column", exact: true })
      .tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Todo",
      "Doing",
      "Done",
    ]);
    const board = page.getByRole("region", { name: "Board", exact: true });
    expect(
      await board.evaluate(
        (element) => element.scrollWidth > element.clientWidth
      )
    ).toBe(true);
  });
});

test("delete-all requires an explicit choice and confirmation, preserving other columns", async ({
  page,
}) => {
  await seedBoard(page, populatedBoard);
  const source = page.getByRole("region", {
    name: "بررسی https://example.com (42)",
    exact: true,
  });
  for (const cancel of [true, false]) {
    await source.getByLabel("Column actions", { exact: true }).press("Enter");
    await source
      .getByRole("button", { name: "Delete column", exact: true })
      .press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Delete column?",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Delete column", exact: true })
    ).toBeDisabled();
    await dialog
      .getByRole("radio", {
        name: "Delete column and all its cards",
        exact: true,
      })
      .check();
    if (cancel) {
      await dialog
        .getByRole("button", { name: "Cancel", exact: true })
        .press("Enter");
      await page.reload();
      await expect(source.getByRole("article")).toHaveCount(2);
    } else {
      await dialog
        .getByRole("button", { name: "Delete column", exact: true })
        .press("Enter");
      await expect(page.getByRole("status")).toHaveText("Saved on this device");
    }
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Queue صف 3",
    "Empty",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Already here",
  ]);
  await expect(page.getByLabel("1 cards", { exact: true })).toHaveText("1");
  await expect(page.getByLabel("0 cards", { exact: true })).toHaveText("0");
});

test("transfer to an empty column also preserves every card", async ({
  page,
}) => {
  await seedBoard(page, populatedBoard);
  const source = page.getByRole("region", {
    name: "بررسی https://example.com (42)",
    exact: true,
  });
  await source.getByLabel("Column actions", { exact: true }).click();
  await source
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Delete column?",
    exact: true,
  });
  await dialog
    .getByRole("radio", { name: "Move cards to another column", exact: true })
    .check();
  await dialog
    .getByLabel("Destination column", { exact: true })
    .selectOption({ label: "3. Empty" });
  await dialog
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Empty", exact: true })
      .getByRole("heading", { level: 3 })
  ).toHaveText(["نسخه UI 42", "Next قدم 2"]);
  await expect(page.getByRole("article")).toHaveCount(3);
});

for (const action of [
  "add",
  "rename",
  "delete empty",
  "transfer",
  "delete all",
]) {
  test(`a failed ${action} never reports saved or partially replaces persisted data`, async ({
    page,
  }) => {
    await seedBoard(page, populatedBoard);
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = original.apply(this, args);
        request.addEventListener("success", () => this.transaction.abort());
        return request;
      };
    });
    if (action === "add") {
      await page
        .getByRole("button", { name: "Add column", exact: true })
        .click();
      await page.getByLabel("Column name", { exact: true }).fill("Not saved");
      await page.getByRole("button", { name: "Save", exact: true }).click();
    } else {
      const column = page.getByRole("region", {
        name:
          action === "delete empty"
            ? "Empty"
            : "بررسی https://example.com (42)",
        exact: true,
      });
      await column.getByLabel("Column actions", { exact: true }).click();
      await column
        .getByRole("button", {
          name: action === "rename" ? "Rename column" : "Delete column",
          exact: true,
        })
        .click();
      if (action === "rename") {
        await page.getByLabel("Column name", { exact: true }).fill("Not saved");
        await page.getByRole("button", { name: "Save", exact: true }).click();
      } else {
        const dialog = page.getByRole("dialog", {
          name: "Delete column?",
          exact: true,
        });
        if (action === "transfer") {
          await dialog
            .getByRole("radio", {
              name: "Move cards to another column",
              exact: true,
            })
            .check();
          await dialog
            .getByLabel("Destination column", { exact: true })
            .selectOption({ label: "2. Queue صف 3" });
        } else if (action === "delete all")
          await dialog
            .getByRole("radio", {
              name: "Delete column and all its cards",
              exact: true,
            })
            .check();
        await dialog
          .getByRole("button", { name: "Delete column", exact: true })
          .click();
      }
    }
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be saved"
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "بررسی https://example.com (42)",
      "Queue صف 3",
      "Empty",
    ]);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText([
      "نسخه UI 42",
      "Next قدم 2",
      "Already here",
    ]);
    await expect(
      page
        .getByRole("region", { name: "Queue صف 3", exact: true })
        .getByLabel("1 cards", { exact: true })
    ).toBeVisible();
  });
}

test("populated-column transfer requires a choice and appends cards without losing order or content", async ({
  page,
}) => {
  await seedBoard(page, populatedBoard);
  const source = page.getByRole("region", {
    name: "بررسی https://example.com (42)",
    exact: true,
  });
  await source.getByLabel("Column actions", { exact: true }).press("Enter");
  await source
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Delete column?",
    exact: true,
  });
  const confirm = dialog.getByRole("button", {
    name: "Delete column",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole("radio", { name: "Move cards to another column", exact: true })
    .check();
  await expect(confirm).toBeDisabled();
  await dialog
    .getByLabel("Destination column", { exact: true })
    .selectOption({ label: "2. Queue صف 3" });
  await dialog
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await page.reload();
  await expect(source.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه UI 42",
    "Next قدم 2",
  ]);
  await source.getByLabel("Column actions", { exact: true }).press("Enter");
  await source
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  await expect(
    dialog.getByRole("radio", {
      name: "Move cards to another column",
      exact: true,
    })
  ).not.toBeChecked();
  await dialog
    .getByRole("radio", { name: "Move cards to another column", exact: true })
    .check();
  await dialog
    .getByLabel("Destination column", { exact: true })
    .selectOption({ label: "2. Queue صف 3" });
  await confirm.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(source).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Queue صف 3",
    "Empty",
  ]);
  const destination = page.getByRole("region", {
    name: "Queue صف 3",
    exact: true,
  });
  await expect(destination.getByRole("heading", { level: 3 })).toHaveText([
    "Already here",
    "نسخه UI 42",
    "Next قدم 2",
  ]);
  await expect(destination.getByLabel("3 cards", { exact: true })).toHaveText(
    "3"
  );
  expect(
    await destination.getByRole("article").nth(1).locator("div").textContent()
  ).toBe("  فارسی UI.\nEnglish https://example.com (7).\n\nپایان!  ");
  expect(
    await destination.getByRole("article").nth(2).locator("div").textContent()
  ).toBe("<b>Plain text</b>");
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("the final column cannot be deleted, whether populated or empty", async ({
  page,
}) => {
  for (const cards of [[{ id: "safe", title: "Keep this card" }], []]) {
    await seedBoard(page, {
      version: 1,
      columns: [{ id: "only", name: "Only column", cards }],
    });
    const column = page.getByRole("region", {
      name: "Only column",
      exact: true,
    });
    await column.getByLabel("Column actions", { exact: true }).click();
    await expect(
      column.getByRole("button", { name: "Delete column", exact: true })
    ).toBeDisabled();
    await expect(column).toContainText("Keep at least one column.");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Only column",
    ]);
    await expect(page.getByRole("article")).toHaveCount(cards.length);
  }
});

test("even an empty column requires confirmation and cancellation leaves the board unchanged", async ({
  page,
}) => {
  await page.goto("/");
  const column = page.getByRole("region", { name: "Doing", exact: true });
  const actions = column.getByLabel("Column actions", { exact: true });
  await actions.press("Enter");
  await column
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Delete column?",
    exact: true,
  });
  await expect(dialog).toContainText("Doing");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true })
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
  await actions.press("Enter");
  await column
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  await dialog
    .getByRole("button", { name: "Delete column", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(
    page.getByRole("button", { name: "Add column", exact: true })
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Done",
  ]);
  await expect(page.getByRole("article")).toContainText("Welcome to Doneward");
});

for (const action of ["New column", "Rename column"]) {
  test(`${action} validates names and accepts the exact 80-character limit`, async ({
    page,
  }) => {
    await page.goto("/");
    if (action === "New column")
      await page
        .getByRole("button", { name: "Add column", exact: true })
        .click();
    else {
      const column = page.getByRole("region", { name: "Todo", exact: true });
      await column.getByLabel("Column actions", { exact: true }).click();
      await column
        .getByRole("button", { name: "Rename column", exact: true })
        .click();
    }
    const dialog = page.getByRole("dialog", { name: action });
    for (const invalid of ["", " \t ", "x".repeat(81)]) {
      await dialog.getByLabel("Column name", { exact: true }).fill(invalid);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog.getByRole("alert")).toHaveText(
        "Column name must contain 1–80 characters."
      );
      await expect(
        dialog.getByLabel("Column name", { exact: true })
      ).toHaveValue(invalid);
    }
    await dialog
      .getByLabel("Column name", { exact: true })
      .fill(`  ${"x".repeat(80)}  `);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 2, name: "x".repeat(80), exact: true })
    ).toBeVisible();
  });
}

test("contextual renaming preserves cards and accepts duplicate column names", async ({
  page,
}) => {
  await page.goto("/");
  const column = page.getByRole("region", { name: "Todo", exact: true });
  const actions = column.getByLabel("Column actions", { exact: true });
  await actions.press("Enter");
  await column
    .getByRole("button", { name: "Rename column", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: "Rename column" });
  await expect(dialog.getByLabel("Column name", { exact: true })).toHaveValue(
    "Todo"
  );
  await dialog.getByLabel("Column name", { exact: true }).fill("  Done  ");
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Done",
    "Doing",
    "Done",
  ]);
  await expect(page.getByRole("article")).toContainText("Welcome to Doneward");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Done",
    "Doing",
    "Done",
  ]);
  await expect(page.getByRole("article")).toContainText("Welcome to Doneward");
});

// Behavioral and visual coverage follows docs/design/board.md.
test("adding a column appends it on the right and saves a trimmed name", async ({
  page,
}) => {
  await page.goto("/");
  const add = page.getByRole("button", { name: "Add column", exact: true });
  await add.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New column" });
  await expect(dialog.getByLabel("Column name", { exact: true })).toBeFocused();
  await dialog
    .getByLabel("Column name", { exact: true })
    .fill("  بررسی UI 42  ");
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
    "بررسی UI 42",
  ]);
  const last = page.getByRole("region", { name: "بررسی UI 42", exact: true });
  await expect(last.getByLabel("0 cards", { exact: true })).toBeVisible();
  const columnBox = await last.boundingBox();
  const addBox = await add.boundingBox();
  expect(addBox!.x).toBeGreaterThan(columnBox!.x + columnBox!.width);
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
    "بررسی UI 42",
  ]);
});
