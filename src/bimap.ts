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

	deleteKey(key: TKey) {
		const value = this.map.get(key);
		if (value) {
			this.revMap.delete(value);
			this.map.delete(key);
		}
	}

	hasKey = Map.prototype.has.bind(this.map);
	hasValue = Map.prototype.has.bind(this.map);

	get = Map.prototype.get.bind(this.map);
	getv = Map.prototype.get.bind(this.revMap);

    clear() {
        this.map.clear();
        this.revMap.clear();
    }

    entries = Map.prototype.entries.bind(this.map);
    entriesvk = Map.prototype.entries.bind(this.revMap);
}
