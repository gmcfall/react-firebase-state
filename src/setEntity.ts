import produce from "immer";
import { EntityApi } from "./EntityApi";
import { EntityClient } from "./EntityClient";
import { EntityKey } from "./types";
import { hashEntityKey } from "./util";

/**
 * Set a value into the cache managed by a given EntityClient.
 * @param apiOrClient The EntityClient that manages the cache, or an EntityApi that provides the client
 * @param key The key under which the value is stored in the cache
 * @param value The value to be added to the cache
 */
export function setEntity(
    apiOrClient: EntityApi | EntityClient,
    key: string | EntityKey,
    value: unknown
) {
 
    const hashValue = Array.isArray(key) ? hashEntityKey(key) : key as string;
    
    const client = (
        ("getClient" in apiOrClient && (apiOrClient as EntityApi).getClient()) ||
        (apiOrClient as EntityClient) 
    )
    
    client.setCache(
        oldCache => {
            const nextCache = produce(oldCache, draftCache => {
                draftCache[hashValue] = value;
            })

            return nextCache;
        }
    )

}