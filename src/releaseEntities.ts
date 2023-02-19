import { disownAllLeases } from "./functions";
import { entityApi } from "./components/FirebaseContext/FirebaseContext";

export function releaseEntities(leasee: string) {
    disownAllLeases(entityApi, leasee);
}