import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import iconv from "iconv-lite";
import { CookieJar } from "tough-cookie";

export const defaultHeaders = {
  "Content-Type": "application/x-www-form-urlencoded",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "en-US,en;q=0.9,hr-HR;q=0.8,hr;q=0.7,bs;q=0.6",
  "cache-control": "max-age=0",
  "content-type": "application/x-www-form-urlencoded",
  "sec-ch-ua":
    '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24";"Samo testam bota nije nista maliciozno ionako znate tko sam :D";v="0"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  Referer: "https://moj.tvz.hr/",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
export const decodeAxiosResponseData = (data: any) => {
  const decoded = iconv.decode(data, "cp1250");
  return decoded;
};

export const jar = new CookieJar();
export const axiosInstance = axios.create({
  jar,
  withCredentials: true,
  responseEncoding: "binary",
  responseType: "blob",
});
export const client = wrapper(axiosInstance);

client.interceptors.request.use((config) => {
  const TVZ_COOKIE = config.jar?.getCookieStringSync(config.url!).split("=")[0];
  let Referer = config.headers?.Referer ?? config.url!;
  Referer += `?TVZ=${TVZ_COOKIE}`;

  config.withCredentials = true;
  config.headers = {
    ...config.headers,
    ...defaultHeaders,
    Referer: Referer,
  } as any;

  config.responseType = "blob";
  config.responseEncoding = "binary";

  return config;
});

client.interceptors.response.use((response) => {
  response.data = decodeAxiosResponseData(response.data);

  return response;
});

declare module "axios" {
  interface AxiosRequestConfig {
    jar?: CookieJar;
  }
}
