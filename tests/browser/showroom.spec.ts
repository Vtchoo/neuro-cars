import { test, expect } from "@playwright/test";

test("car showroom previews production models and exports a PNG", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/3d/debug");
  await expect(page).toHaveURL(/\/3d\/debug\/$/);
  await expect(page.locator("#car-preview")).toBeVisible();
  await expect(page.locator("#stats")).toContainText("Uno + ladder");
  for (const preset of ["supercar", "formula1", "uno"]) {
    await page.getByLabel("Car preset").selectOption(preset);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).carShowroom.cars
            .filter((car: any) => car.object.visible)
            .map((car: any) => car.modelKey),
        ),
      )
      .toEqual([preset]);
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.locator("#steering").fill("20");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).carShowroom.cars.find(
              (car: any) => car.object.visible,
            ).steeringAngle,
        ),
      )
      .toBeCloseTo((20 * Math.PI) / 180);
    await page.getByLabel("Wireframe").check();
    await page.getByLabel("Wireframe").uncheck();
    await page.getByRole("button", { name: "Isometric", exact: true }).click();
    await page.screenshot({ path: `.vite/browser-results/car-${preset}.png` });
  }
  for (const view of ["Front", "Rear", "Top"])
    await page.getByRole("button", { name: view, exact: true }).click();
  await page.getByRole("button", { name: "Isometric", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  expect((await download).suggestedFilename()).toBe("cars-uno.png");
  await page.getByLabel("Car preset").selectOption("all");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).carShowroom.cars.filter(
            (car: any) => car.object.visible,
          ).length,
      ),
    )
    .toBe(3);
  await page.screenshot({ path: ".vite/browser-results/car-showroom.png" });
  expect(errors).toEqual([]);
});
