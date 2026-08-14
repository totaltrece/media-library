import "dotenv/config";

function requireEnv(name: string): string {
    const value = process.env[name];

    if (value === undefined || value.length === 0) {
        throw new Error(`${name} environment variable is required.`);
    }

    return value;
}

function optionalEnv(name: string): string | undefined {
    const value = process.env[name];

    if (value === undefined || value.length === 0) {
        return undefined;
    }

    return value;
}

export const config = {
    libraryPath: requireEnv("LIBRARY_PATH"),
    port: Number(process.env.PORT ?? "3000"),
    sqlitePath: optionalEnv("SQLITE_PATH"),
};