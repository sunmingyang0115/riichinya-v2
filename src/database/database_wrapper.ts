import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import * as fs from 'fs';


export class DatabaseWrapper {
    private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

    private filename: string;
    private initDB: (db: Database) => void;

    constructor(filename: string, initDB: (db: Database) => void) {
        this.filename = filename;
        this.initDB = initDB;
    }

    public async ensureDatabaseExists(): Promise<void> {
        if (!this.db) {
            this.db = await open({
                filename: this.filename,
                driver: sqlite3.Database
            })
        }

        await this.initDB(this.db);
    }


    public async deleteTableEntryByID(table: string, keys: Record<string, unknown>): Promise<void> {
        const keyColumns = Object.keys(keys);
        if (keyColumns.length === 0) {
            throw new Error("Safe-guard: You must provide an ID key to delete, otherwise the table will be cleared.");
        }

        const whereClause = keyColumns.map(key => `${key} = ?`).join(' AND ');
        const query = `DELETE FROM ${table} WHERE ${whereClause}`;

        const values = keyColumns.map(key => keys[key]);

        await this.ensureDatabaseExists();
        await this.db!.run(query, values);
    }

    public async getTableEntryByID<T>(table: string, criteria: Partial<Record<keyof T, unknown>>): Promise<T | null> {
        await this.ensureDatabaseExists();

        const columns = Object.keys(criteria);
        if (columns.length === 0) {
            throw new Error("Generic Get Error: Criteria object cannot be empty.");
        }

        const whereClause = columns.map(col => `${col} = ?`).join(' AND ');
        const query = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
        const values = columns.map(col => (criteria as any)[col]);

        const result = await this.db!.get<T>(query, values);
        return result || null;
    }

    public async addEntryToTable<T>(table: string, data: T): Promise<void> {
        await this.ensureDatabaseExists();

        const columns = Object.keys(data as any);
        if (columns.length === 0) {
            throw new Error("Generic Add Error: Data object cannot be empty.");
        }

        const columnNames = columns.join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`;
        const values = columns.map(col => (data as any)[col]);

        await this.db!.run(query, values);
    }

    // public static async setConfig(key: string, value: string): Promise<void> {
    //         const query = `
    //             insert or replace into ConfigTable (key, value) 
    //             values (?, ?)
    //         `;
    //         await this.init();
    //         await this.db!.run(query, [key, value]);
    //     }
    
    // public static async getConfig(key: string): Promise<string | null> {
    //     const query = `
    //         select value from ConfigTable where key = ?
    //     `;
    //     await this.init();
    //     const row = await this.db!.get<{ value: string }>(query, [key]);
    //     return row ? row.value : null;
    // }

};

