import {EntityClient} from "./EntityClient";

export interface EntityApi {
    mutate<T>(recipe: (state: T) => void): void;
    getClient() : EntityClient;
}