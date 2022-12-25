/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

import { Toucan } from "toucan-js";

export interface Env {
    DISCORD_API_TOKEN: string;
    DISCORD_GUILD_ID: string;
    GOOGLE_SHEETS_API_TOKEN: string;
    GOOGLE_SHEETS_SPREADSHEET_ID: string;
    GOOGLE_SHEETS_SHEET_ID: string;
    DISCORD_ANNOUNCEMENTS_CHANNEL_ID: string;
    SENTRY_DSN: string;
}

export interface SpreadsheetResults {
    values: string[][];
}

export default {
    async scheduled(
        controller: ScheduledController,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        console.log(`Starting the bot...`);
        const sentry = new Toucan({
            dsn: env.SENTRY_DSN,
        });
        sentry.addBreadcrumb({
            message: "Loading environment variables...",
            category: "log",
        });

        const range = "A2:C";
        const birthdays_url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_SPREADSHEET_ID}/values/${range}`;
        const birthdays_response = await fetch(birthdays_url, {
            headers: {
                "X-goog-api-key": env.GOOGLE_SHEETS_API_TOKEN,
                "Content-Type": "application/json",
            },
        });
        if (!birthdays_response.ok) {
            const error = await birthdays_response.text();
            sentry.addBreadcrumb({
                message: error,
                category: "error",
            });
            sentry.captureException(birthdays_response);
            throw new Error(`Failed to retrieve spreadsheet: ${error}`);
        }
        const spreadsheet_rows =
            (await birthdays_response.json()) as SpreadsheetResults;
        const values = spreadsheet_rows.values;

        const now = new Date();
        for (const value of values) {
            const date = new Date(value[1]);
            const username = new Date(value[2]);
            if (
                date.getUTCMonth() === now.getUTCMonth() &&
                date.getUTCDate() === now.getUTCDate()
            ) {
                let content = `Hey all! It's @${username}'s birthday today! Let's all wish them a happy birthday! 🥳`;

                const message_announcements_url = `https://discord.com/api/v10/channels/${env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID}/messages`;
                const message_response = await fetch(
                    message_announcements_url,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bot ${env.DISCORD_API_TOKEN}`,
                        },
                        method: "POST",
                        body: JSON.stringify({
                            content: content,
                        }),
                    }
                );
                if (!message_response.ok) {
                    const error = await message_response.text();
                    sentry.addBreadcrumb({
                        message: error,
                        category: "error",
                    });
                    sentry.captureException(message_response);
                    throw new Error(`Failed to post message: ${error}`);
                }
            }
        }
    },
};
