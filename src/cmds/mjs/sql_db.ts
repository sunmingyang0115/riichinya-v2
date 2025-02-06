import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

export type UserIdData = {
    discordId: string,
    mjsNickname?: string,
    amaeId: string
}

export class UsersDatabase {
    private static db: Database | null = null;
    private static isInitiated: boolean = false;
    private static async openDB(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
        return open({
            filename: "usernames.sql",
            driver: sqlite3.Database,
        });
    }

    static async init() {
        if (this.db == null) {
            this.db = await this.openDB();
        }
        if (!this.isInitiated) {
            this.db = await this.openDB();
            await this.db!.run(`
                CREATE TABLE IF NOT EXISTS Users
                (discord_id TEXT NOT NULL UNIQUE,
                mjs_nickname TEXT NOT NULL UNIQUE,
                amae_id TEXT NOT NULL UNIQUE)`);
            this.isInitiated = true;
        } 
    }

    static async getUser(discordId: string): Promise<UserIdData | null> {
        await this.init();
        const stmt = await this.db!.prepare(`
            SELECT discord_id, mjs_nickname, amae_id
            FROM Users
            WHERE discord_id=?`, discordId);

        const result = await stmt.get();

        return result && {
            discordId: result.discord_id,
            mjsNickname: result.mjs_nickname,
            amaeId: result.amae_id
        }
    }

    static async setUser(discordId: string, mjsNickname: string, amaeId: string) {
        await this.init();
        const stmt = await this.db!.prepare(`
            INSERT OR REPLACE INTO
            Users(discord_id, mjs_nickname, amae_id)
            VALUES
            (?, ?, ?)`, discordId, mjsNickname, amaeId);

        await stmt.run();
    }

    static async deleteUser(discordId: string) {
        await this.init();
        const stmt = await this.db!.prepare(`
            DELETE FROM Users
            WHERE discord_id=?`, discordId);

        await stmt.run();
    }
}