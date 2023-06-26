// A Bi-directional mapping between keys and values.
// This is like a regular javascript Map, except keys can be looked up using values (`map.getv`).
// This data structure mandates a strict 1-to-1 mapping between the key-set and value-set.
// i.e: no two keys can be mapped to the same value, and vice-versa.
export default class BiMap<TKey, TValue> {
	private readonly map = new Map<TKey, TValue>();
	private readonly revMap = new Map<TValue, TKey>();

	set(key: TKey, value: TValue) {
		this.map.set(key, value);
		this.revMap.set(value, key);
	}


	setv(value: TValue, key: TKey) {
		this.map.set(key, value);
		this.revMap.set(value, key);
	}

	delete(key: TKey) {
		const value = this.map.get(key);
		if (value) {
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

    entries = Map.prototype.entries.bind(this.map);
    entriesvk = Map.prototype.entries.bind(this.revMap);
}
