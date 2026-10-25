import { openSqliteLibraryStore, openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { defineAuthStoreContract } from "./auth-store.contract.js";
import { defineLibraryStoreContract } from "./library-store.contract.js";

defineLibraryStoreContract("sqlite", async () => openSqliteLibraryStore(":memory:"));
defineAuthStoreContract("sqlite", async () => openSqliteStores(":memory:"));
