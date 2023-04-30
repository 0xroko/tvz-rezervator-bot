import { logger } from "@/lib/log";
import { Appointment } from "@/types/bot";
import { chromium } from "playwright";
import { config } from "../config";
import { login } from "./login";

interface Add {
	onSuccess: () => Promise<void>;
	onError: (error: unknown) => Promise<void>;
}

interface PrepareForReserve {
	appointment: Appointment;
	onPrepareError: (error: unknown) => Promise<void>;
}

// this will open browser instance, login and return `enroll` function
// using post requests would be faster, but requires wayyy more work
export const prepareForReserve = async ({
	onPrepareError: onPrepareError,
	appointment,
}: PrepareForReserve) => {
	const startTimestamp = Date.now();

	const browser = await chromium.launch({
		headless: true,
	});

	const page = await browser.newPage();

	try {
		await login(page, appointment.url);
		await page.locator("text=Rezervacija labosa").click();
	} catch (error) {
		await onPrepareError(error);
		return { enroll: null };
	}

	const time = Date.now() - startTimestamp;

	logger.info(`Login/setup took ${time}ms`);

	return {
		reserve: async ({ onError, onSuccess }: Add) => {
			const startTimestamp = Date.now();
			try {
				const labosElement = page
					.locator(`text=${appointment.groupText}`)
					.locator("xpath=ancestor::*[contains(@class, 'panel-body')]")
					.last();

				const alreadyReserved = await labosElement
					.locator("text=prijavljeni ste")
					.isVisible();

				logger.debug(`Already reserved: ${alreadyReserved}`);

				if (alreadyReserved) {
					throw new Error(config.errors.ALREADY_RESERVED);
				}

				// find the input submit button and click it
				await labosElement.locator("text=Odaberi").click();

				const AppointmentsElement = page
					.locator(`text=${appointment.appointmentText}`)
					.locator("xpath=ancestor::*[contains(@class, 'panel-default')]")
					.last();

				// await appointment.highlight();

				// find input type submit inside appointment and click it
				await AppointmentsElement.locator("input[type=submit]").click();

				await AppointmentsElement.screenshot({ path: config.paths.img.latest });

				await page.screenshot({
					path: config.paths.img.latestFull,
					fullPage: true,
				});

				await onSuccess();
			} catch (error) {
				await onError(error);
			} finally {
				logger.info("Enrollment took " + (Date.now() - startTimestamp) + "ms");
				await browser.close();
			}
		},
	};
};
