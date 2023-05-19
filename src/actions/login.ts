import { envConfig } from "@/config/envConfig";
import { client } from "@/lib/axios";
import { logger } from "@/lib/log";
import { load } from "cheerio";
import { stringify } from "querystring";

export const login = async (url?: string, body?: any) => {
  logger.trace("begin login");

  const obj = {
    ...body,
    passwd: envConfig.get("TVZ_PASSWORD"),
    login: envConfig.get("TVZ_EMAIL"),
  };

  const login = await client.post(url ?? "https://moj.tvz.hr", stringify(obj));
  logger.trace("end login");

  const $ = load(login.data);
  if ($("input[name='passwd']").length > 0) {
    throw new Error("Login failed or invalid credentials!");
  }

  return login;
};
