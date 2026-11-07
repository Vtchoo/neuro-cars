import { test, expect, type Page } from "@playwright/test";

const track = {
  startingPoint: { x: 0, y: 0 },
  startingDirection: 0,
  closed: false,
  pieces: [
    {
      type: "Spline",
      start: { x: 0, y: 0 },
      control1: { x: 300, y: 0 },
      control2: { x: 700, y: 200 },
      end: { x: 1000, y: 200 },
      width: 120,
    },
  ],
};

async function createSave(page: Page) {
  return page.evaluate(async (data) => {
    // Vite serves the same renderer-free simulation module to both pages.
    const { default: Game } = await import("/src/core/Game.ts");
    const game = new Game();
    game.track = game.createTrack(data);
    game.maxTicks = 30;
    game.setupPopulation(8);
    return game.exportState();
  }, track);
}

async function loadSave(page: Page, save: unknown) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "shared-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(save)),
  });
  await expect(
    page.getByRole("button", { name: "Display: None" }),
  ).toBeVisible();
}

test("2D and 3D use identical menus, save format, and simulation; renderers stay isolated", async ({
  browser,
}) => {
  const page2d = await browser.newPage(),
    page3d = await browser.newPage();
  const errors: string[] = [];
  const requests2d: string[] = [],
    requests3d: string[] = [];
  for (const page of [page2d, page3d])
    page.on("pageerror", (error) => errors.push(error.message));
  page2d.on("request", (request) => requests2d.push(request.url()));
  page3d.on("request", (request) => requests3d.push(request.url()));
  await page2d.goto("/");
  await expect(
    page2d.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  const save = await createSave(page2d);
  await loadSave(page2d, save);
  await page3d.goto("/3d/");
  await expect(page3d.locator("#scene-3d")).toBeVisible();
  await loadSave(page3d, save);
  const menu2d = await page2d.getByRole("button").allTextContents();
  expect(await page3d.getByRole("button").allTextContents()).toEqual(menu2d);
  for (const page of [page2d, page3d]) {
    await page.evaluate(() => {
      const g = (window as any).game;
      g.cycleStartPoint = "off";
      g.increaseMaxTicksIfBestCarIsRunning = false;
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).game.generation))
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Display: None" }).click();
    await expect(
      page.getByRole("button", { name: "Display: Grip circle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: ">", exact: true }).click();
    await page.getByRole("button", { name: "Show Neural Net: Off" }).click();
    await page.getByRole("button", { name: "Display: Grip circle" }).click();
    await expect(
      page.getByRole("button", { name: "Display: Minimap" }),
    ).toBeVisible();
    if (page === page3d)
      await page.screenshot({
        path: ".vite/browser-results/three-minimap.png",
      });
    await page.getByRole("button", { name: "Display: Minimap" }).click();
    await expect(
      page.getByRole("button", { name: "Display: None" }),
    ).toBeVisible();
    const before = await page.evaluate(() => (window as any).game.maxTicks);
    await page.getByRole("button", { name: "+100", exact: true }).click();
    await expect(
      page.getByText(`Ticks: ${before + 100}`, { exact: true }),
    ).toBeVisible();
    const state = await page.evaluate(() => {
      const g = (window as any).game;
      return {
        car: g.population[0].constructor.name,
        track: g.track.constructor.name,
        state: g.exportState(),
      };
    });
    expect(state.state.population).toHaveLength(8);
    expect(state.state.track.pieces[0].type).toBe("Spline");
    expect(state.car).toBe(page === page2d ? "Car2d" : "Car3d");
    expect(state.track).toBe(page === page2d ? "Track2d" : "Track3d");
  }
  expect(
    requests2d.some(
      (url) => url.includes("/renderers/3d/") || url.includes("/deps/three"),
    ),
  ).toBe(false);
  expect(
    requests3d.some(
      (url) => url.includes("/renderers/2d/") || url.includes("/deps/p5"),
    ),
  ).toBe(false);
  await page3d.screenshot({ path: ".vite/browser-results/three-scene.png" });
  expect(errors).toEqual([]);
  await page2d.close();
  await page3d.close();
});

for (const route of ["/", "/3d/"])
  test(`${route} supports the shared track editor and starts a simulation`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const canvas = page.locator(
      route === "/" ? "canvas.p5Canvas" : "#scene-3d",
    );
    await canvas.click({ position: { x: 550, y: 450 } });
    await canvas.click({ position: { x: 700, y: 450 } });
    await expect(
      page.getByRole("button", { name: "Done", exact: true }),
    ).toBeVisible();
    await canvas.click({ position: { x: 900, y: 500 } });
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Display: None" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as any).game.ticks))
      .toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
