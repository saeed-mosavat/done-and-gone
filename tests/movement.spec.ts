import { expect, test, type Page, type Locator } from "@playwright/test";
import { seedBoard } from "./storage-fixture";
import AxeBuilder from "@axe-core/playwright";

const sourceName = "بررسی https://example.com (42)";
const sample = {
  version: 1,
  columns: [
    {
      id: "a",
      name: sourceName,
      cards: [
        {
          id: "one",
          title: "نسخه https://example.com (42)",
          description: "  فارسی UI.\nEnglish 7.\n\nپایان!  ",
        },
        { id: "two", title: "Second" },
        { id: "three", title: "Third" },
      ],
    },
    { id: "b", name: "Queue صف 3", cards: [{ id: "four", title: "Fourth" }] },
    { id: "c", name: "Empty", cards: [] },
  ],
};

test("editor movement and ordering are draft changes until Save and survive reload", async ({
  page,
}) => {
  await seedBoard(page, sample);
  await page
    .getByRole("button", { name: "Edit Second", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: "Edit card", exact: true });
  await dialog.getByLabel("Column", { exact: true }).selectOption("c");
  await dialog
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .press("Enter");
  await expect(
    page
      .getByRole("region", { name: "Empty", exact: true })
      .getByRole("article")
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Second", exact: true })
    .press("Enter");
  await dialog.getByLabel("Position", { exact: true }).selectOption("0");
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Second",
    "نسخه https://example.com (42)",
    "Third",
    "Fourth",
  ]);
});

test("column menu ordering reaches either boundary and persists", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const column = page.getByRole("region", { name: "Queue صف 3", exact: true });
  await column.getByLabel("Column actions", { exact: true }).press("Enter");
  await column
    .getByRole("button", { name: "Move column left", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await column.getByLabel("Column actions", { exact: true }).press("Enter");
  await expect(
    column.getByRole("button", { name: "Move column left", exact: true })
  ).toBeDisabled();
  await column
    .getByRole("button", { name: "Move column right", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await column.getByLabel("Column actions", { exact: true }).press("Enter");
  await column
    .getByRole("button", { name: "Move column right", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    sourceName,
    "Empty",
    "Queue صف 3",
  ]);
});

async function startDrag(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 10,
    box.y + box.height / 2 + 10,
    { steps: 4 }
  );
}

test("cards drag translucently without handles while columns retain their handles", async ({
  page,
}) => {
  await seedBoard(page, sample);
  await expect(page.getByRole("button", { name: /^Drag card / })).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: /^Drag column / })).toHaveCount(
    3
  );
  await startDrag(
    page,
    page.getByRole("button", { name: "Edit Second", exact: true })
  );
  const opacity = Number(
    await page
      .locator(".drag-preview")
      .evaluate((element) => getComputedStyle(element).opacity)
  );
  expect(opacity).toBeGreaterThanOrEqual(0.75);
  expect(opacity).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".drag-preview")).toHaveCount(0);
  await expect(page.getByRole("article").nth(1)).toHaveCSS("opacity", "1");
});

test("ordinary card right-clicks retain native context-menu behavior", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const [prevented] = await Promise.all([
    page.evaluate(
      () =>
        new Promise<boolean>((resolve) =>
          document.addEventListener(
            "contextmenu",
            (event) => resolve(event.defaultPrevented),
            { once: true }
          )
        )
    ),
    page
      .getByRole("button", { name: "Edit Second", exact: true })
      .click({ button: "right" }),
  ]);
  expect(prevented).toBe(false);
  await page.keyboard.press("Escape");
});

test("columns also use a translucent drag preview while keeping the handle", async ({
  page,
}) => {
  await seedBoard(page, sample);
  await startDrag(
    page,
    page.getByRole("button", { name: `Drag column ${sourceName}`, exact: true })
  );
  const preview = page.locator(".drag-preview");
  await expect(preview).toBeVisible();
  const opacity = Number(
    await preview.evaluate((element) => getComputedStyle(element).opacity)
  );
  expect(opacity).toBeGreaterThanOrEqual(0.75);
  expect(opacity).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /^Drag column / })).toHaveCount(
    3
  );
});

test("delete hover follows the visible pointer at the edge of the zone", async ({
  page,
}) => {
  await seedBoard(page, sample);
  await startDrag(
    page,
    page.getByRole("button", { name: "Edit Second", exact: true })
  );
  const zone = page.getByRole("region", {
    name: "Delete drop zone",
    exact: true,
  });
  const box = (await zone.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y - 4);
  await expect(zone).toHaveText("Drop here to delete");
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await expect(zone).toHaveText("Release to delete");
  await page.mouse.up();
  await expect(
    page.getByRole("dialog", { name: "Delete card?", exact: true })
  ).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`dragging keeps the card's size, content, and grabbed point under the pointer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    await seedBoard(page, sample);
    const card = page.getByRole("article").first();
    const original = (await card.boundingBox())!;
    const originalText = await card.textContent();
    const grab = { x: 35, y: 45 };
    await page.mouse.move(original.x + grab.x, original.y + grab.y);
    await page.mouse.down();
    await page.mouse.move(original.x + grab.x + 12, original.y + grab.y + 12);
    const preview = page.locator(".drag-preview");
    await expect(preview).toBeVisible();
    const moved = (await preview.boundingBox())!;
    expect(moved.x).toBeCloseTo(original.x + 12, 0);
    expect(moved.y).toBeCloseTo(original.y + 12, 0);
    expect(moved.width).toBeCloseTo(original.width, 0);
    expect(moved.height).toBeCloseTo(original.height, 0);
    expect(await preview.textContent()).toBe(originalText);
    const zone = page.getByRole("region", {
      name: "Delete drop zone",
      exact: true,
    });
    const target = (await zone.boundingBox())!;
    // Enter near the top of the target: no extra downward travel should be needed.
    const pointer = { x: target.x + target.width / 2, y: target.y + 4 };
    await page.mouse.move(pointer.x, pointer.y, { steps: 8 });
    await expect(zone).toHaveText("Release to delete");
    const overTarget = (await preview.boundingBox())!;
    // Browser input dispatch can round subpixel client coordinates.
    expect(Math.abs(pointer.x - overTarget.x - grab.x)).toBeLessThan(1);
    expect(Math.abs(pointer.y - overTarget.y - grab.y)).toBeLessThan(1);
    await page.mouse.up();
    await expect(
      page.getByRole("dialog", { name: "Delete card?", exact: true })
    ).toBeVisible();
  });
}

test("dragging to delete confirms the title, cancelling preserves order, and confirming persists", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const card = page.getByRole("button", {
    name: "Edit نسخه https://example.com (42)",
    exact: true,
  });
  for (const cancel of [true, false]) {
    await startDrag(page, card);
    const target = page.getByRole("region", {
      name: "Delete drop zone",
      exact: true,
    });
    await expect(target).toHaveText("Drop here to delete");
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 8,
    });
    await expect(target).toHaveText("Release to delete");
    await page.mouse.up();
    await expect(target).toHaveCount(0);
    const dialog = page.getByRole("dialog", {
      name: "Delete card?",
      exact: true,
    });
    await expect(dialog).toContainText("نسخه https://example.com (42)");
    await dialog
      .getByRole("button", {
        name: cancel ? "Cancel" : "Delete permanently",
        exact: true,
      })
      .press("Enter");
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(
      cancel
        ? ["نسخه https://example.com (42)", "Second", "Third", "Fourth"]
        : ["Second", "Third", "Fourth"]
    );
  }
});

test("card drags reorder both directions, move into empty and populated columns, and preserve content", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const source = page.getByRole("region", { name: sourceName, exact: true });
  const first = page.getByRole("button", {
    name: "Edit نسخه https://example.com (42)",
    exact: true,
  });
  await startDrag(page, first);
  let box = (await source.getByRole("article").last().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height - 2, { steps: 8 });
  await page.mouse.up();
  await expect(source.getByRole("heading", { level: 3 })).toHaveText([
    "Second",
    "Third",
    "نسخه https://example.com (42)",
  ]);
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await startDrag(page, first);
  box = (await source.getByRole("article").first().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 2, { steps: 8 });
  await page.mouse.up();
  await expect(source.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه https://example.com (42)",
    "Second",
    "Third",
  ]);
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  for (const name of ["Empty", "Queue صف 3"]) {
    await startDrag(page, first);
    box = (await page
      .getByRole("region", { name, exact: true })
      .boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 350, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
  }
  await page.reload();
  const destination = page.getByRole("region", {
    name: "Queue صف 3",
    exact: true,
  });
  await expect(destination.getByRole("heading", { level: 3 })).toHaveText([
    "Fourth",
    "نسخه https://example.com (42)",
  ]);
  expect(
    await destination.getByRole("article").last().locator("div").textContent()
  ).toBe("  فارسی UI.\nEnglish 7.\n\nپایان!  ");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(
    destination.getByLabel("2 cards", { exact: true })
  ).toBeVisible();
});

test("column dragging changes LTR order in either direction without changing cards", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const handle = page.getByRole("button", {
    name: `Drag column ${sourceName}`,
    exact: true,
  });
  await startDrag(page, handle);
  let box = (await page
    .getByRole("region", { name: "Empty", exact: true })
    .boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + 30, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Queue صف 3",
    "Empty",
    sourceName,
  ]);
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await startDrag(page, handle);
  box = (await page
    .getByRole("region", { name: "Queue صف 3", exact: true })
    .boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 30, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    sourceName,
    "Queue صف 3",
    "Empty",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه https://example.com (42)",
    "Second",
    "Third",
    "Fourth",
  ]);
});

test("Escape, pointer cancellation, and release outside a destination do not mutate or open cards", async ({
  page,
}) => {
  await seedBoard(page, sample);
  for (const action of ["escape", "cancel", "outside"]) {
    await startDrag(
      page,
      page.getByRole("button", { name: "Edit Second", exact: true })
    );
    if (action === "escape") await page.keyboard.press("Escape");
    if (action === "cancel")
      await page
        .getByRole("region", { name: "Board", exact: true })
        .dispatchEvent("pointercancel", { pointerId: 1 });
    await page.mouse.move(10, 10);
    await page.mouse.up();
    await expect(
      page.getByRole("region", { name: "Delete drop zone", exact: true })
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه https://example.com (42)",
    "Second",
    "Third",
    "Fourth",
  ]);
});

test("cancelling a drag never swallows the next unrelated action", async ({
  page,
}) => {
  await seedBoard(page, sample);
  await startDrag(
    page,
    page.getByRole("button", { name: "Edit Second", exact: true })
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "New column", exact: true })
  ).toBeVisible();
});

test("drop hit-testing uses release coordinates rather than the previous move", async ({
  page,
}) => {
  await seedBoard(page, sample);
  const [pointerId] = await Promise.all([
    page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          window.addEventListener(
            "pointerdown",
            (event) => resolve(event.pointerId),
            { once: true }
          )
        )
    ),
    startDrag(
      page,
      page.getByRole("button", { name: "Edit Second", exact: true })
    ),
  ]);
  const target = page.getByRole("region", {
    name: "Delete drop zone",
    exact: true,
  });
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(target).toHaveText("Release to delete");
  // Model a release delivered at a newer position without an intervening move.
  await page
    .getByRole("region", { name: "Board", exact: true })
    .dispatchEvent("pointerup", { pointerId, clientX: 10, clientY: 10 });
  await page.mouse.up();
  await expect(target).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه https://example.com (42)",
    "Second",
    "Third",
    "Fourth",
  ]);
});

test("editor can move to empty columns and first/last positions without losing cards", async ({
  page,
}) => {
  await seedBoard(page, sample);
  for (const [column, position] of [
    ["c", "0"],
    ["b", "0"],
    ["b", "1"],
  ]) {
    await page
      .getByRole("button", { name: "Edit Second", exact: true })
      .press("Enter");
    const dialog = page.getByRole("dialog", { name: "Edit card", exact: true });
    await dialog.getByLabel("Column", { exact: true }).selectOption(column);
    await dialog.getByLabel("Position", { exact: true }).selectOption(position);
    await dialog
      .getByRole("button", { name: "Save", exact: true })
      .press("Enter");
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه https://example.com (42)",
    "Third",
    "Fourth",
    "Second",
  ]);
  await expect(page.getByRole("article")).toHaveCount(4);
});

test.describe("touch movement", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("touch menus and editor move cards and columns on the narrow board", async ({
    page,
  }) => {
    await seedBoard(page, sample);
    await page.getByRole("button", { name: "Edit Second", exact: true }).tap();
    await page.getByLabel("Position", { exact: true }).selectOption("0");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(
      page
        .getByRole("region", { name: sourceName, exact: true })
        .getByRole("heading", { level: 3 })
    ).toHaveText(["Second", "نسخه https://example.com (42)", "Third"]);
    await page.getByRole("button", { name: "Edit Second", exact: true }).tap();
    await page.getByLabel("Column", { exact: true }).selectOption("c");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    const column = page.getByRole("region", { name: "Empty", exact: true });
    await column.getByLabel("Column actions", { exact: true }).tap();
    await column
      .getByRole("button", { name: "Move column left", exact: true })
      .tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      sourceName,
      "Empty",
      "Queue صف 3",
    ]);
    await expect(column.getByRole("heading", { level: 3 })).toHaveText([
      "Second",
    ]);
  });
  test("native touch holds reorder cards, column handles reorder columns, and edge scrolling reaches empty destinations", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Native swipe injection uses Chromium's public input protocol; touch menu ordering runs in every engine."
    );
    await seedBoard(page, sample);
    const input = await context.newCDPSession(page);
    async function move(x: number, y: number) {
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
    }
    async function start(handle: Locator) {
      await handle.scrollIntoViewIfNeeded();
      const box = (await handle.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await input.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await expect(page.locator(".drag-preview")).toHaveCount(0);
      await expect(page.locator(".drag-preview")).toBeVisible();
      await move(x, y + 10);
    }
    async function end() {
      await input.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.getByRole("status")).toHaveText("Saved on this device");
    }
    const source = page.getByRole("region", { name: sourceName, exact: true });
    await start(page.getByRole("button", { name: "Edit Second", exact: true }));
    const first = (await source.getByRole("article").first().boundingBox())!;
    await move(100, first.y + 2);
    await end();
    await expect(source.getByRole("heading", { level: 3 })).toHaveText([
      "Second",
      "نسخه https://example.com (42)",
      "Third",
    ]);
    await start(page.getByRole("button", { name: "Edit Second", exact: true }));
    await move(365, 400);
    const empty = page.getByRole("region", { name: "Empty", exact: true });
    await expect
      .poll(async () => (await empty.boundingBox())!.x)
      .toBeLessThan(250);
    let box = (await empty.boundingBox())!;
    // Leave the edge-scroll strip before releasing in the destination.
    await move(Math.min(330, Math.max(100, box.x + box.width / 2)), 400);
    await end();
    await expect(empty.getByRole("heading", { level: 3 })).toHaveText([
      "Second",
    ]);
    await start(
      page.getByRole("button", {
        name: `Drag column ${sourceName}`,
        exact: true,
      })
    );
    await move(365, 140);
    await expect
      .poll(async () => (await empty.boundingBox())!.x)
      .toBeLessThan(100);
    box = (await empty.boundingBox())!;
    await move(Math.min(360, box.x + box.width - 10), 140);
    await end();
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Queue صف 3",
      "Empty",
      sourceName,
    ]);
    await expect(empty.getByRole("heading", { level: 3 })).toHaveText([
      "Second",
    ]);
    await expect(page.getByRole("article")).toHaveCount(4);
  });
  test("native touch column-handle swipes scroll without starting a delayed drag", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Native swipe injection uses Chromium's public input protocol; touch menus run in every engine."
    );
    await seedBoard(page, sample);
    const handle = page.getByRole("button", {
      name: `Drag column ${sourceName}`,
      exact: true,
    });
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const input = await context.newCDPSession(page);
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (const distance of [30, 60, 90, 120]) {
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - distance, y }],
      });
    }
    await input.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(400);
    await expect(page.locator(".drag-preview")).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await page
            .getByRole("region", { name: sourceName, exact: true })
            .boundingBox())!.x
      )
      .toBeLessThan(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      sourceName,
      "Queue صف 3",
      "Empty",
    ]);
  });

  test("native touch swipes still scroll while holding a card starts delete dragging", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Native swipe injection uses Chromium's public input protocol; touch menu paths run in every engine."
    );
    await seedBoard(page, sample);
    const input = await context.newCDPSession(page);
    await page.getByRole("button", { name: "Edit Second", exact: true }).tap();
    await page.getByRole("button", { name: "Cancel", exact: true }).tap();
    // Exercise expiry of a cancelled hold timer, not just immediate state.
    await page.waitForTimeout(400);
    await expect(page.locator(".drag-preview")).toHaveCount(0);
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 260, y: 390 }],
    });
    for (const x of [220, 180, 140, 100]) {
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: 390 }],
      });
    }
    await input.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(400);
    await expect(
      page.getByRole("region", { name: "Delete drop zone", exact: true })
    ).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await page
            .getByRole("region", { name: sourceName, exact: true })
            .boundingBox())!.x
      )
      .toBeLessThan(0);
    await page
      .getByRole("button", { name: "Edit Second", exact: true })
      .scrollIntoViewIfNeeded();
    const handle = (await page
      .getByRole("button", { name: "Edit Second", exact: true })
      .boundingBox())!;
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      ],
    });
    await expect(
      page.getByRole("region", { name: "Delete drop zone", exact: true })
    ).toBeVisible();
    await input.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: handle.x + handle.width / 2,
          y: handle.y + handle.height / 2 + 20,
        },
      ],
    });
    const target = page.getByRole("region", {
      name: "Delete drop zone",
      exact: true,
    });
    await expect(target).toBeVisible();
    const box = (await target.boundingBox())!;
    await input.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await expect(target).toHaveText("Release to delete");
    await input.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.getByRole("dialog", { name: "Delete card?", exact: true })
    ).toContainText("Second");
    await page.getByRole("button", { name: "Cancel", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 3 })).toHaveText([
      "نسخه https://example.com (42)",
      "Second",
      "Third",
      "Fourth",
    ]);
  });
});

test("narrow-board edge dragging scrolls to a previously offscreen destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedBoard(page, sample);
  await startDrag(
    page,
    page.getByRole("button", { name: "Edit Second", exact: true })
  );
  await page.mouse.move(365, 400, { steps: 8 });
  const empty = page.getByRole("region", { name: "Empty", exact: true });
  await expect
    .poll(async () => (await empty.boundingBox())!.x)
    .toBeLessThan(250);
  const box = (await empty.boundingBox())!;
  await page.mouse.move(Math.max(40, box.x + 25), 400);
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(empty.getByRole("heading", { level: 3 })).toHaveText(["Second"]);
  await expect(page.getByRole("article")).toHaveCount(4);
});

for (const action of ["card", "column", "delete"]) {
  test(`failed ${action} drag writes never report saved or partially mutate persisted order`, async ({
    page,
  }) => {
    await seedBoard(page, sample);
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = original.apply(this, args);
        request.addEventListener("success", () => this.transaction.abort());
        return request;
      };
    });
    await startDrag(
      page,
      page.getByRole("button", {
        name: action === "column" ? `Drag column ${sourceName}` : "Edit Second",
        exact: true,
      })
    );
    const target =
      action === "delete"
        ? page.getByRole("region", { name: "Delete drop zone", exact: true })
        : page.getByRole("region", { name: "Empty", exact: true });
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    if (action === "delete")
      await page
        .getByRole("button", { name: "Delete permanently", exact: true })
        .press("Enter");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be saved"
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      sourceName,
      "Queue صف 3",
      "Empty",
    ]);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText([
      "نسخه https://example.com (42)",
      "Second",
      "Third",
      "Fourth",
    ]);
  });
}

// Visual treatment and mixed-direction behavior follow docs/design/board.md.
test("movement controls and drag states are accessible in both themes and narrow layouts", async ({
  page,
}) => {
  await seedBoard(page, sample);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page
        .getByRole("button", {
          name: "Edit نسخه https://example.com (42)",
          exact: true,
        })
        .press("Enter");
      const editor = page.getByRole("dialog", {
        name: "Edit card",
        exact: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(editor).toHaveScreenshot(
        `movement-editor-${width}-${colorScheme}.png`
      );
      await page.keyboard.press("Escape");
      await startDrag(
        page,
        page.getByRole("button", {
          name: `Drag column ${sourceName}`,
          exact: true,
        })
      );
      const preview = page.locator(".drag-preview");
      await expect(preview).toHaveText(sourceName);
      await expect(preview.locator("bdi")).toHaveCSS("direction", "rtl");
      await expect(preview).toHaveScreenshot(
        `column-preview-${width}-${colorScheme}.png`
      );
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await startDrag(
        page,
        page.getByRole("button", {
          name: "Edit نسخه https://example.com (42)",
          exact: true,
        })
      );
      const target = page.getByRole("region", {
        name: "Delete drop zone",
        exact: true,
      });
      await expect(target).toHaveScreenshot(
        `delete-resting-${width}-${colorScheme}.png`
      );
      const box = (await target.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 8,
      });
      await expect(target).toHaveText("Release to delete");
      await expect(page.getByRole("main")).toHaveScreenshot(
        `delete-active-${width}-${colorScheme}.png`
      );
      expect(
        await page
          .locator(".drag-preview")
          .evaluate((element) => getComputedStyle(element).pointerEvents)
      ).toBe("none");
      expect(
        await target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            document
              .elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2
              )
              ?.closest(".delete-drop-zone") === element
          );
        })
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.mouse.up();
      const confirmation = page.getByRole("dialog", {
        name: "Delete card?",
        exact: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(confirmation).toHaveScreenshot(
        `drag-confirmation-${width}-${colorScheme}.png`
      );
      await page.keyboard.press("Escape");
    }
  }
});
