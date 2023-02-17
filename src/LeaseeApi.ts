import { EntityApi } from "./EntityApi";

export class LeaseeApi implements EntityApi{
    readonly leasee: string;
    private api: EntityApi;

    constructor(leasee: string, api: EntityApi) {
        this.leasee = leasee;
        this.api = api;
        this.mutate = this.mutate.bind(this);
    }
    
    mutate<T>(recipe: (state: T) => void) {
       this.api.mutate(recipe);
    }

    getClient() {
        return this.api.getClient();
    }
}