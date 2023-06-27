import type Span from "./span";

export const enum Event {
	// text content of a span was updated
	textChanged,
	// a mark was added to a span(s)
	markAdded,
	// a span was replaced by one or more other spans.
	spanReplaced,
	// a span was removed from the document
	spanRemoved,
	// a new span was added to the document
	spanAdded,
}

export interface ReplaceSpanPayload {
	removed: Span[];
	added: Span[];
}

export interface EventPayloadMap {
	[Event.textChanged]: Span;
	[Event.markAdded]: [number, number];
	[Event.spanReplaced]: ReplaceSpanPayload;
	[Event.spanRemoved]: Span;
	[Event.spanAdded]: Span;
}

type Callback<TEvent extends Event> = (eventData: EventPayloadMap[TEvent]) => void;

export interface Emitter {
	on<T extends Event>(event: T, cb: Callback<T>): void;
	emit<T extends Event>(event: T, payload: EventPayloadMap[T]): void;
}

export class Emitter implements Emitter {
	private readonly listenersOfEvent = new Map<Event, Callback<any>[]>();

	/**
	 * Subscribe a callback to a particular event type.
	 */
	on<TEvent extends Event>(event: TEvent, cb: Callback<TEvent>) {
		let listeners = this.listenersOfEvent.get(event);
		if (!listeners) {
			listeners = [];
			this.listenersOfEvent.set(event, listeners);
		}
		listeners.push(cb);
	}

	/**
	 * Emit `event` with `payload`.
	 */
	emit<TEvent extends Event>(event: TEvent, payload: EventPayloadMap[TEvent]) {
		let listeners = this.listenersOfEvent.get(event);
		if (!listeners) return;
		for (const lis of listeners) {
			lis(payload);
		}
	}
}
