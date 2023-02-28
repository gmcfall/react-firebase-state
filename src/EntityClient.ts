import { FirebaseApp } from "firebase/app";
import { Unsubscribe } from "firebase/auth";
import produce from "immer";
import { Lease } from "./Lease";
import { MutableEntityApi } from "./MutableEntityApi";
import { setEntity } from "./setEntity";
import { Cache, EntityApiOptions, LeaseOptions } from "./types";

const DEFAULT_ABANDON_TIME = 300000;

export function createEntityClient(
    firebaseApp: FirebaseApp,
    cache: Cache,
    setCache: React.Dispatch<React.SetStateAction<Cache>>,
    options?: EntityApiOptions
) {
    return new EntityClient(
        firebaseApp,
        cache,
        setCache,
        new Map<string, Lease>(),
        new Map<string, Set<Lease>>(),
        new MutableEntityApi(),
        options
    )
}

export function updateEntityClient(client: EntityClient, cache: Cache) {
    return (cache === client.cache) ? client : new EntityClient(
        client.firebaseApp,
        cache,
        client.setCache,
        client.leases,
        client.leaseeLeases,
        client.api,
        client.options
    )
}

/**
 * A class responsible for managing the local cache of entities and
 * any leases associated with those entities.
 * 
 * There is one active EntityClient in an app at a time.
 * If new entities are added to, removed from, or updated in the cache,
 * then a new EntityClient will be created during the next render cycle.
 * 
 * Applications do not use the `EntityClient` directly. Instead,
 * they use an [EntityApi](../interfaces/EntityApi.html) instance.
 * The EntityApi uses the client internally to do its work.
 * 
 * #### Cache
 * 
 * There is one, application-wide cache that stores server-side and client-side 
 * entities. The EntityClient manages this cache.
 * 
 * #### Leases
 * Each entity within the cache *may* be governed by a {@link Lease} which dictates 
 * when the entity should be evicted from the cache. The EntityClient manages the 
 * leases and enforces their eviction policies.
 * 
 * See the {@link Lease | Lease class documentation} for details about 
 * how to use leases.
 */
export class EntityClient {

    /** 
     * The FirebaseApp used to access Firebase Auth and Firestore. 
     */
    readonly firebaseApp: FirebaseApp;

    /** 
     * The function used to set a new revision of the cache
     * @ignore
     */
    readonly setCache: React.Dispatch<React.SetStateAction<Cache>>;
    
    /** 
     * The current state of the cache 
     * @ignore
     */
    readonly cache: Cache;

    /** 
     * A Map where the key is the hash of an EntityKey and the value is the Lease for the entity
     * @ignore
     */
    readonly leases: Map<string, Lease>;

    /**
     * A Map where the key is the name for a leasee, and the value is the set of
     * Leases owned by the leasee. This is used when releasing all claims held by the leasee.
     * @ignore
     */
    readonly leaseeLeases: Map<string, Set<Lease>>;

    /** 
     * The EntityApi used by the application 
     * @ignore
     */
    api: MutableEntityApi;

    /** 
     * Options for managing expiry of entities in the cache.
     * If the `abandonTime` property is not configured explicitly, a default
     * of 5 minutes will be used as the `abandonTime` value.
     */
    options: EntityApiOptions;

    /** @ignore */
    constructor(
        firebaseApp: FirebaseApp,
        cache: Cache,
        setCache: React.Dispatch<React.SetStateAction<Cache>>,
        leases: Map<string, Lease>,
        leaseeLeases: Map<string, Set<Lease>>,
        api: MutableEntityApi,
        options?: EntityApiOptions
    ) {
        this.firebaseApp = firebaseApp;
        this.cache = cache;
        this.setCache = setCache;
        this.leases = leases;
        this.leaseeLeases = leaseeLeases;
        this.api = api;
        this.options = options || {};
        api.setClient(this);        
    }

    /**
     * @ignore
     */
    getAbandonTime(lease: Lease) {
        return lease.options?.abandonTime || this.options.abandonTime || DEFAULT_ABANDON_TIME;
    }


    /**
     * Remove a given leasee from all leases that it currently claims.
     * @param leasee The name of the leasee
     * 
     * @ignore
     */
    disownAllLeases(leasee: string) {
        const set = this.leaseeLeases.get(leasee);
        if (set) {
            set.forEach(lease => {
                removeLeaseeFromLease(this, lease, leasee);
            })
            this.leaseeLeases.delete(leasee);
        }
    }
}

export function removeLeaseeFromLease(client: EntityClient, lease: Lease, leasee: string) {

    lease.removeLeasee(leasee);
   
    if (lease.ledger.size===0) {

        // Create a timer to evict the entity after the `abandonTime` as elapsed.

        const abandonTime = client.getAbandonTime(lease);
        lease.evictionToken = setTimeout(() => {

            if (lease.ledger.size === 0) {
                const entityKey = lease.entityKey;

                // If there is a listener for entity state changes, then
                // cancel that listener.

                if (lease.unsubscribe) {
                    lease.unsubscribe();
                }

                // Remove the lease
                client.leases.delete(entityKey);                

                // Remove the entity from the cache
                client.setCache(
                    oldCache => {
                        if (oldCache[entityKey]) {
                            const newCache = {...oldCache};
                            delete newCache[entityKey];
                            return newCache;
                        }
                        return oldCache;
                    }
                )
            }

        }, abandonTime)
    }
}


/**
 * Add a given entity to the cache on behalf of a given leasee.
 * @param key The hash of the EntityKey
 * @param entity The entity to be added
 * @param leasee The name of the leasee adding the entity
 * @param cache The cache proxy to which the entity will be added
 */
export function createLeasedEntity(
    client: EntityClient, 
    unsubscribe: Unsubscribe | undefined,
    key: string,
    leasee: string, 
    options?: LeaseOptions
) {
    setEntity(client.api, key, undefined);
    const lease = claimLease(client, key, leasee, options);
    lease.unsubscribe = unsubscribe;
}


export function claimLease(client: EntityClient, entityKey: string, leasee: string, options?: LeaseOptions) {

    let lease = client.leases.get(entityKey);
    if (!lease) {
        lease = new Lease(entityKey, options);
        client.leases.set(entityKey, lease);
    }
    if (!lease.ledger.has(leasee)) {
        lease.addLeasee(leasee);
        let set = client.leaseeLeases.get(leasee);
        if (!set) {
            set = new Set<Lease>();
            client.leaseeLeases.set(leasee, set);
        }
        if (!set.has(lease)) {
            set.add(lease);
        }
    }
    return lease;
}