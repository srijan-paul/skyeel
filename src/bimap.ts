// A Bi-directional mapping between keys and values.
// This is like a regular javascript Map, except keys can be looked up using values (`map.getv`).
// This data structure mandates a strict 1-to-1 mapping between the key-set and value-set.
// i.e: no two keys can be mapped to the same value, and vice-versa.
export default class BiMap<TKey, TValue> {
  private readonly map = new Map<Readonly<TKey>, TValue>();
  private readonly revMap = new Map<Readonly<TValue>, TKey>();

  set(key: Readonly<TKey>, value: Readonly<TValue>) {
    this.map.set(key, value);
    this.revMap.set(value, key);
  }

  setv(value: Readonly<TValue>, key: Readonly<TKey>) {
    this.map.set(key, value);
    this.revMap.set(value, key);
  }

  delete(key: Readonly<TKey>) {
    const value = this.map.get(key);
    if (value) {
      this.revMap.delete(value);
      this.map.delete(key);
    }
  }

  deletev(value: Readonly<TValue>) {
    const key = this.revMap.get(value);
    if (key) {
      this.revMap.delete(value);
      this.map.delete(key);
    }
  }

  hasKey = this.map.has.bind(this.map);
  hasValue = this.revMap.has.bind(this.revMap);

  get = this.map.get.bind(this.map);
  getv = this.revMap.get.bind(this.revMap);

  clear() {
    this.map.clear();
    this.revMap.clear();
  }

  entries = this.map.entries.bind(this.map);
  entriesvk = this.revMap.entries.bind(this.revMap);
}
