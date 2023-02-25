import produce from "immer";
import { EntityApi } from "./EntityApi";
import { EntityClient } from "./EntityClient";

const NOT_INITIALIZED = "EntityClient not initialized";

export class MutableEntityApi implements EntityApi {

    
    private client?: EntityClient;

    constructor() {
        this.mutate = this.mutate.bind(this);
    }

    get firebaseApp() {
        const client = this.client;
        if (!client) {
            throw new Error(NOT_INITIALIZED)
        }
        return client.firebaseApp;
    }

    mutate<T>(mutator: (state: T) => void) {
        const client = this.client;
        if (!client) {
            throw new Error(NOT_INITIALIZED)
        }
        
        client.setCache(
            oldCache => {
                return produce(oldCache, draft => mutator(draft as T));
            }
        )
    }

    getClient() {
        if (!this.client) {
            throw new Error(NOT_INITIALIZED)
        }
        return this.client;
    }

    setClient(client: EntityClient) {
        this.client = client;
    }
}