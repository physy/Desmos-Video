/**
 * オブジェクトのディープコピーを行うユーティリティ関数
 */
export function deepCopy<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepCopy(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const copiedObj = {} as { [K in keyof T]: T[K] };
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copiedObj[key] = deepCopy(obj[key]);
      }
    }
    return copiedObj;
  }

  return obj;
}

/**
 * オブジェクトの特定のパスに値を安全に設定する
 */
export function setNestedProperty<T>(obj: T, path: string, value: unknown): T {
  const result = deepCopy(obj);
  const keys = path.split(".");
  let current = result as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * オブジェクトの特定のパスから値を安全に取得する
 */
export function getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * オブジェクトの特定のパスのプロパティを安全に削除する
 */
export function deleteNestedProperty<T>(obj: T, path: string): T {
  const result = deepCopy(obj);
  const keys = path.split(".");
  let current = result as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      return result; // パスが存在しない場合はそのまま返す
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
  }

  return result;
}
