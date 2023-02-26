import { DocListenerOptions } from "./common";
import { EntityApi } from "./EntityApi";
import { AuthOptions, useAuthListener, useDocListener } from "./hooks";
import { CURRENT_USER } from "./common";

/**
 * An {@link EntityApi} implementation which encapsulates 
 * the name of a particular leasee, i.e. a component that holds a claim 
 * on one or more entities.  The `LeaseeApi` is passed to certain event handlers.
 * 
 * A `LeaseeApi` instance is passed to event handlers that are supplied to the {@link useDocListener}
 * hook, including:
 * - {@link DocListenerOptions.transform}
 * - {@link DocListenerOptions.onRemove}
 * - {@link DocListenerOptions.onError}
 * 
 * In these cases the {@link LeaseeApi.leasee} property of the LeaseeApi is set to the
 * value of the `leasee` parameter passed to {@link useDocListener}.
 * 
 * A `LeaseeApi` instance is passed to event handlers supplied to the {@link useAuthListener}
 * hook, including:
 * - {@link AuthOptions.transform}
 * - {@link AuthOptions.onError}
 * - {@link AuthOptions.onSignedOut}
 * 
 * In these cases, the {@link LeaseeApi.leasee} property of the LeaseeApi is set to {@link CURRENT_USER}.
 */
export class LeaseeApi implements EntityApi{

    /** The name of the leasee */
    readonly leasee: string;

    /** @ignore */
    private api: EntityApi;

    /** @ignore */
    constructor(leasee: string, api: EntityApi) {
        this.leasee = leasee;
        this.api = api;
        this.mutate = this.mutate.bind(this);
    }

    /**
     * A [getter function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) 
     * that exposes the FirestoreApp as a readonly property. Hence, you can use it like this:
     * ```typescript
     *  const db = getFirestore(leaseeApi.firebaseApp);
     * ```
     */
    get firebaseApp() {
        return this.api.firebaseApp;
    }
    
    mutate<T>(mutator: (cache: T) => void) {
       this.api.mutate(mutator);
    }

    getClient() {
        return this.api.getClient();
    }
}