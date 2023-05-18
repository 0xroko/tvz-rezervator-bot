import { envConfig } from "@/config/envConfig";
import { Page } from "playwright";
import { client } from "../../main";
import { load } from "cheerio";
import { logger } from "@/lib/log";

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

export const loginNew = async (url?: string) => {
  logger.trace("begin login");
  const login = await client.post(
    url ?? "https://moj.tvz.hr",
    `passwd=${envConfig.get("TVZ_PASSWORD")}&login=${envConfig.get(
      "TVZ_EMAIL"
    )}`
  );
  logger.trace("end login");

  const $ = load(login.data);
  if ($("input[name='passwd']").length > 0) {
    throw new Error("Login failed or invalid credentials!");
  }

  return login;
};
