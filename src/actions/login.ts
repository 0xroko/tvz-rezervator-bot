import { envConfig } from "@/config/envConfig";
import { Page } from "playwright";

export const login = async (
  page: Page,
  initialPage: string = "https://moj.tvz.hr"
) => {
  // await page.route("**/*", (route) => {
  // 	return ["image", "font", "stylesheet"].includes(route.request().resourceType())
  // 		? route.abort()
  // 		: route.continue();
  // });

  await page.goto(initialPage, { waitUntil: "domcontentloaded" });

  await page.locator('input[name="login"]').fill(envConfig.get("TVZ_EMAIL")!);
  await page
    .locator('input[name="passwd"]')
    .fill(envConfig.get("TVZ_PASSWORD")!);

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=Ulogiraj me").click(),
  ]);
};
