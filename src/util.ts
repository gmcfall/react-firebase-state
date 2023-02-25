import { EntityKey } from "./types"

// Copied from: https://github.com/jonschlinkert/is-plain-object
export function isPlainObject(o: any): o is Object {
    if (!hasObjectPrototype(o)) {
      return false
    }
  
    // If has modified constructor
    const ctor = o.constructor
    if (typeof ctor === 'undefined') {
      return true
    }
  
    // If has modified prototype
    const prot = ctor.prototype
    if (!hasObjectPrototype(prot)) {
      return false
    }
  
    // If constructor does not have an Object-specific method
    if (!prot.hasOwnProperty('isPrototypeOf')) {
      return false
    }
  
    // Most likely a plain Object
    return true
  }
  function hasObjectPrototype(o: any): boolean {
    return Object.prototype.toString.call(o) === '[object Object]'
  }

/**
 * Default query keys hash function.
 * Hashes the value into a stable hash.
 * Adapted from https://github.com/TanStack/query/blob/main/packages/query-core/src/utils.ts
 * See `hashQueryKey`.
 */
export function hashEntityKey(entityKey: EntityKey): string {
    return JSON.stringify(entityKey, (_, val) =>
        isPlainObject(val)
        ? Object.keys(val)
            .sort()
            .reduce((result, key) => {
                result[key] = val[key]
                return result
            }, {} as any)
        : simpleType(val),
    )
}

function simpleType(value: any) {
    return value===undefined ? null : value;
}

export function isPromise(data: any)  {
  return (typeof data?.then === 'function');
}

export function asError(err: any, message: string) {
  if (err instanceof Error) {
    return err;
  }

  if (typeof err?.message === 'string') {
    return new Error(err.message);
  }

  return new Error(message);
}


export function toHashValue(key: string | EntityKey) {
  if (typeof(key) === 'string') {
      return key;
  }
  const validKey = validateKey(key);
  return validKey ? hashEntityKey(key) : null;
}

export function validateKey(key: EntityKey) {
  if (!key) {
      return null;
  }
  for (const value of key) {
     if (!isValid(value)) {
      return null;
     }
  }
  return key;
}

function isValid(value: unknown) {

  if (value === undefined) {
      return false;
  }

  if (typeof value === 'object') {
      if (value) {
          const obj = value as any;
          for (const key in obj) {
              if (!isValid(obj[key])) {
                  return false;
              }
          }
      }
  }
  

  return true;
}