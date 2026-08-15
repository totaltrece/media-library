import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".avi"]);

export interface IndexedVideo {
    videoPath: string;
    metadataPath?: string;
    thumbnailPath?: string;
    tags: string[];
    recordedAt?: string | null;
}

/**
 * Discovers video files below a library directory without reading TagSpaces sidecars.
 */
export async function discoverVideoPaths(libraryPath: string): Promise<string[]> {
    return findVideoPaths(libraryPath);
}

/**
 * Indexes video files below a library directory without modifying the library.
 * TagSpaces sidecars are expected at <library>/.ts/<video-file-name>.<extension>.
 */
export async function indexLibrary(libraryPath: string): Promise<IndexedVideo[]> {
    const videoPaths = await discoverVideoPaths(libraryPath);

    return Promise.all(
        videoPaths.map(async (videoPath) => {
            const sidecarBasePath = join(libraryPath, ".ts", basename(videoPath));
            const metadataPath = await existingFilePath(`${sidecarBasePath}.json`);

            return {
                videoPath,
                metadataPath,
                thumbnailPath: await existingFilePath(`${sidecarBasePath}.jpg`),
                tags: await extractTagTitles(metadataPath),
            };
        }),
    );
}

async function extractTagTitles(metadataPath: string | undefined): Promise<string[]> {
    if (metadataPath === undefined) {
        return [];
    }

    try {
        //const metadata: unknown = JSON.parse(await readFile(metadataPath, "utf8"));

        const content = removeUtf8Bom(await readFile(metadataPath, "utf8"));
        const metadata = JSON.parse(content);

        if (!isRecord(metadata) || !Array.isArray(metadata.tags)) {
            return [];
        }

        return metadata.tags.flatMap((tag: unknown) =>
            isRecord(tag) && typeof tag.title === "string" ? [tag.title] : [],
        );
    } catch (error: unknown) {
        console.log(`Failed to read or parse metadata file at ${metadataPath}`);
        console.error(error);
        return [];
    }
}

async function findVideoPaths(directoryPath: string): Promise<string[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const videoPaths: string[] = [];

    for (const entry of entries) {
        const entryPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            videoPaths.push(...(await findVideoPaths(entryPath)));
            continue;
        }

        if (entry.isFile() && videoExtensions.has(extname(entry.name).toLowerCase())) {
            videoPaths.push(entryPath);
        }
    }

    return videoPaths.sort((firstPath, secondPath) => firstPath.localeCompare(secondPath));
}

async function existingFilePath(path: string): Promise<string | undefined> {
    try {
        return (await stat(path)).isFile() ? path : undefined;
    } catch (error: unknown) {
        if (isMissingFileError(error)) {
            return undefined;
        }

        throw error;
    }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}


function removeUtf8Bom(text: string): string {

    return text.startsWith("\uFEFF")
        ? text.slice(1)
        : text;
}