import { LeaseOptions, Unsubscribe } from "./types";

/**
 * A Lease for some entity stored in the local cache.
 * 
 * Each Lease maintains a ledger of the components that depend on the entity.
 * A component listed in the ledger is called a *leasee*, and we say that
 * it holds a claim on the entity.  When a component is removed from the ledger 
 * we say that the claim has been released.
 * 
 * When the number of claims on an entity drops to zero (i.e. when the Lease's ledger is empty),
 * we say that the entity as been *abandoned*.  Abandoned entities are not evicted from the
 * cache immediately.  The time to live after being abandoned is given by the `abandonTime` 
 * option. The [EntityClient](../interfaces/EntityClient.html) contains a default `abandonTime` 
 * value, but each Lease may override this default with its own value.
 * 
 * #### Using Leases
 * Applications don't manipulate leases directly. Certain hooks and functions will create
 * leases and make claims on behalf of a component.  These functions include:
 * - [useAuthListener](../functions/useAuthListener.html)
 * - [useDocListener](../functions/useDocListener.html)
 * - [setLeasedEntity](../functions/setLeasedEntity.html)
 * 
 * Utilize the [useReleaseAllClaims](../functions/useReleaseAllClaims.html) hook to release 
 * all claims held by a given component.
 * 
 * Use [releaseClaim](../functions/releaseClaim.html) to release the claim on a specific 
 * entity.
 */
export class Lease {

    /** 
     * The key under which the leased entity is stored in the cache.
     * If the entity is identified by an [EntityKey](../types/EntityKey.html),
     * then this is the stringified representation of the key.
     */
    readonly entityKey: string;

    /** 
     * The set of names for individuals (typically React components) that hold
     * a claim on the leased entity.
     */
    readonly ledger: Set<string> = new Set<string>();

    /**
     * The unsubscribe function for the leased entity.
     * 
     * Typically this is the return value from the call to Firestore `onSnapshot`
     * that established a listener for the entity.  For the auth user, this is the
     * return value from `onAuthStateChanged`.
     */
    unsubscribe?: Unsubscribe;

    
    /**
     * Options provided when the Lease was created
     */
    readonly options?: LeaseOptions;

    /**
     * The id for a timer that will fire when it is time to
     * evict the entity from the cache.  That timer is started by EntityClient
     * when the entity is abandoned.
     */
    evictionToken?: ReturnType<typeof setTimeout>;

    /**
     * Create a new Lease.
     * 
     * Applications do not create Leases directly. Instead, they
     * use functions supported by the [EntityApi](../interface/EntityApi.html)
     * to create leases.
     * @param entityKey The stringified value for the entitie's key
     * @param options Optinal configuration parameters for the Lease
     */
    constructor(entityKey: string, options?: LeaseOptions) {
        this.entityKey = entityKey;
        this.options = options;
    }

    /**
     * Add a leasee to the ledger. This method should be called only by EntityClient.
     * @param leasee The name of the leasee
     */
    addLeasee(leasee: string) {
        this.ledger.add(leasee);

        if (this.evictionToken) {
            clearTimeout(this.evictionToken);
            delete this.evictionToken;
        }
    }

    /**
     * Remove a leasee from the ledger. This method should be called only by EntityClient.
     * @param leasee The name of the leasee
     */
    removeLeasee(leasee: string) {
        this.ledger.delete(leasee);
        if (this.ledger.size === 0) {
            if (this.evictionToken) {
                // In theory, we should never get here, but just in case...
                clearTimeout(this.evictionToken);
                delete this.evictionToken;
            }
        }
    }
}